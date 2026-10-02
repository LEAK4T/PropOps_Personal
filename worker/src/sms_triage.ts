import { Env, json, newId } from './lib';

// POST /api/sms/webhook — Twilio's inbound-SMS webhook target.
// Configure in the Twilio Console under the phone number's
// "Messaging" config: "A MESSAGE COMES IN" -> Webhook -> this URL,
// HTTP POST. Twilio posts application/x-www-form-urlencoded with
// (at minimum) From, To, Body, MessageSid.
//
// Flow:
//   1. Tenant texts in a complaint ("AC is broken").
//   2. We look for an open conversation for that phone number less than
//      CONVERSATION_TIMEOUT_MINUTES old. If none, start one and ask a
//      clarifying question before creating any maintenance ticket.
//   3. Tenant's reply is stored as the clarifying answer, the conversation
//      is marked done, and a maintenance_requests row is created with
//      source='sms_triage' and both the original wording and the
//      diagnostic answer preserved in diagnostic_notes.
//
// This deliberately works with Twilio alone (TwiML reply inline) — no
// separate Cloudflare-side scheduling or state needed beyond the D1 row.

const CONVERSATION_TIMEOUT_MINUTES = 30;

// Very small keyword-based clarifying-question picker. Good enough to
// catch the common "tenant blows up a minor issue" cases (AC, "nothing
// works", leaks, "it's broken") and ask one targeted follow-up instead of
// dispatching a vendor for what might be a thermostat setting or a tripped
// breaker. Falls back to a generic "what exactly is happening" question.
function pickClarifyingQuestion(complaint: string): string {
  const text = complaint.toLowerCase();
  if (/\bac\b|air ?condition|a\/c/.test(text)) {
    return 'Thanks — to send the right help: is it that the AC isn\'t cooling at all, the thermostat display/dial isn\'t responding, or you hear a noise/leak from the unit itself? Reply with whichever fits best.';
  }
  if (/heat(er|ing)?\b/.test(text)) {
    return 'Got it — is the heat not turning on at all, or does it turn on but not get warm enough? And is the thermostat display working?';
  }
  if (/leak|water|flood/.test(text)) {
    return 'Thanks for flagging that — is the water actively leaking right now, and can you tell where it\'s coming from (ceiling, under a sink, around a toilet, etc.)?';
  }
  if (/clog|toilet|drain|sink/.test(text)) {
    return 'Is it fully clogged/not draining at all, or just draining slowly? And is it one fixture or more than one?';
  }
  if (/power|electric|outlet|breaker/.test(text)) {
    return 'Is it the whole unit without power, just one room/outlet, or have you already checked the breaker panel?';
  }
  if (/lock|key|door/.test(text)) {
    return 'Are you locked out right now (needs immediate help), or is the lock/door just not working properly when you do have your key?';
  }
  return 'Thanks for letting us know — can you give a bit more detail on exactly what\'s happening, so we send the right help the first time?';
}

function twimlReply(message: string): Response {
  const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function handleSmsWebhook(req: Request, env: Env): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) return twimlReply('Sorry, we couldn\'t read that message — please try again.');

  const from = String(form.get('From') || '');
  const body = String(form.get('Body') || '').trim();
  const messageSid = String(form.get('MessageSid') || '');
  if (!from || !body) return twimlReply('Sorry, we couldn\'t read that message — please try again.');

  // Best-effort link to a known tenant/unit by phone number (not required —
  // triage still works for an unrecognized number, just without unit/tenant ids).
  const tenant = await env.DB.prepare(`SELECT id, unit_id FROM tenants WHERE phone = ? LIMIT 1`)
    .bind(from)
    .first<{ id: string; unit_id: string }>();

  // Log the inbound message in the shared messages table regardless of
  // triage outcome, same as the rest of the sandbox's message history.
  await env.DB.prepare(
    `INSERT INTO messages (id, unit_id, channel, direction, to_address, body, provider, provider_message_id, status)
     VALUES (?, ?, 'sms', 'inbound', ?, ?, 'twilio', ?, 'received')`,
  )
    .bind(newId('msg'), tenant?.unit_id || null, from, body, messageSid || null)
    .run();

  const cutoff = new Date(Date.now() - CONVERSATION_TIMEOUT_MINUTES * 60 * 1000).toISOString();
  const openConvo = await env.DB.prepare(
    `SELECT * FROM sms_conversations WHERE phone_number = ? AND status = 'open' AND last_message_at >= ? ORDER BY last_message_at DESC LIMIT 1`,
  )
    .bind(from, cutoff)
    .first<any>();

  // Expire any stale open conversation for this number so a later, unrelated
  // text can't get misattributed as the answer to an old question.
  await env.DB.prepare(
    `UPDATE sms_conversations SET status = 'expired' WHERE phone_number = ? AND status = 'open' AND last_message_at < ?`,
  )
    .bind(from, cutoff)
    .run();

  if (openConvo && openConvo.stage === 'clarifying') {
    // This is the tenant's answer to our clarifying question — create the
    // maintenance ticket with both the original complaint and the
    // clarified detail preserved, then close out the conversation.
    const maintId = newId('maint');
    await env.DB.prepare(
      `INSERT INTO maintenance_requests (id, unit_id, description, status, source, diagnostic_notes)
       VALUES (?, ?, ?, 'open', 'sms_triage', ?)`,
    )
      .bind(
        maintId,
        openConvo.unit_id || tenant?.unit_id || null,
        openConvo.initial_complaint,
        `Tenant initially reported: "${openConvo.initial_complaint}". Clarifying Q: "${openConvo.clarifying_question}". Tenant answer: "${body}"`,
      )
      .run();

    await env.DB.prepare(
      `UPDATE sms_conversations SET status = 'closed', stage = 'done', clarifying_answer = ?,
         resulting_maintenance_id = ?, last_message_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(body, maintId, openConvo.id)
      .run();

    return twimlReply('Got it, thank you — that detail helps a lot. We\'ve logged a maintenance request and will follow up with next steps shortly.');
  }

  // No open conversation (or one that just expired) — this is a fresh
  // complaint. Ask a clarifying question before creating any ticket.
  const question = pickClarifyingQuestion(body);
  const convoId = newId('conv');
  await env.DB.prepare(
    `INSERT INTO sms_conversations (id, phone_number, unit_id, tenant_id, status, stage, initial_complaint, clarifying_question)
     VALUES (?, ?, ?, ?, 'open', 'clarifying', ?, ?)`,
  )
    .bind(convoId, from, tenant?.unit_id || null, tenant?.id || null, body, question)
    .run();

  return twimlReply(question);
}

// GET /api/sms/conversations?phoneNumber=... (optional filter) — lets the
// dashboard show open/closed diagnostic conversations for visibility.
export async function listSmsConversations(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const phoneNumber = url.searchParams.get('phoneNumber');
  const rows = phoneNumber
    ? await env.DB.prepare(`SELECT * FROM sms_conversations WHERE phone_number = ? ORDER BY last_message_at DESC`).bind(phoneNumber).all()
    : await env.DB.prepare(`SELECT * FROM sms_conversations ORDER BY last_message_at DESC LIMIT 100`).all();
  return json({ ok: true, conversations: rows.results }, env);
}
