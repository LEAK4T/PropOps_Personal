import { Env, json, notConfigured, newId } from './lib';

// POST /api/sms/send  { to: "+13055551234", body: "text" }
export async function sendSms(req: Request, env: Env): Promise<Response> {
  const missing: string[] = [];
  if (!env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
  if (!env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
  if (!env.TWILIO_FROM_NUMBER) missing.push('TWILIO_FROM_NUMBER (var in wrangler.toml)');
  if (missing.length) return notConfigured(env, missing);

  let body: { to?: string; body?: string; unitId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, env, { status: 400 });
  }
  if (!body.to || !body.body) {
    return json({ ok: false, error: 'Both "to" (E.164 phone, e.g. +13055551234) and "body" are required' }, env, { status: 400 });
  }

  const id = newId('msg');
  const sid = env.TWILIO_ACCOUNT_SID!;
  const auth = btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`);
  const form = new URLSearchParams({
    To: body.to,
    From: env.TWILIO_FROM_NUMBER,
    Body: body.body,
  });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data: any = await res.json();

    await env.DB.prepare(
      `INSERT INTO messages (id, unit_id, channel, direction, to_address, body, provider, provider_message_id, status, error)
       VALUES (?, ?, 'sms', 'outbound', ?, ?, 'twilio', ?, ?, ?)`,
    )
      .bind(
        id,
        body.unitId || null,
        body.to,
        body.body,
        data.sid || null,
        res.ok ? (data.status || 'sent') : 'failed',
        res.ok ? null : (data.message || `Twilio HTTP ${res.status}`),
      )
      .run();

    if (!res.ok) {
      return json({ ok: false, error: data.message || 'Twilio rejected the request', twilioCode: data.code, twilioStatus: res.status }, env, { status: 200 });
    }
    return json({ ok: true, id, twilioSid: data.sid, status: data.status }, env);
  } catch (err: any) {
    await env.DB.prepare(
      `INSERT INTO messages (id, unit_id, channel, direction, to_address, body, provider, status, error)
       VALUES (?, ?, 'sms', 'outbound', ?, ?, 'twilio', 'failed', ?)`,
    )
      .bind(id, body.unitId || null, body.to, body.body, String(err?.message || err))
      .run();
    return json({ ok: false, error: `Network/Twilio error: ${err?.message || err}` }, env, { status: 200 });
  }
}

// POST /api/email/send  { to, subject, body, unitId? }
// Uses Twilio's native Email API (comms.twilio.com) — same Account SID /
// Auth Token as SMS, no separate Resend account needed. Still requires a
// Verified Sender (an approved sending domain) set up in the Twilio
// Console before this will actually deliver.
export async function sendEmail(req: Request, env: Env): Promise<Response> {
  const missing: string[] = [];
  if (!env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
  if (!env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
  if (!env.TWILIO_FROM_EMAIL) missing.push('TWILIO_FROM_EMAIL (var in wrangler.toml — must match a Verified Sender in the Twilio Console)');
  if (missing.length) return notConfigured(env, missing);

  let body: { to?: string; subject?: string; body?: string; unitId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, env, { status: 400 });
  }
  if (!body.to || !body.subject || !body.body) {
    return json({ ok: false, error: '"to", "subject", and "body" are all required' }, env, { status: 400 });
  }

  const id = newId('msg');
  const sid = env.TWILIO_ACCOUNT_SID!;
  const auth = btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`);

  try {
    const res = await fetch('https://comms.twilio.com/v1/Emails', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { address: env.TWILIO_FROM_EMAIL },
        to: [{ address: body.to }],
        content: {
          subject: body.subject,
          text: body.body,
        },
      }),
    });
    const data: any = await res.json();

    // Twilio Email is async: a 202 means "queued," not "delivered." We
    // store the operationId so /api/docusign-style status polling could be
    // added later; for now the sandbox just reports queued vs. rejected.
    await env.DB.prepare(
      `INSERT INTO messages (id, unit_id, channel, direction, to_address, subject, body, provider, provider_message_id, status, error)
       VALUES (?, ?, 'email', 'outbound', ?, ?, ?, 'twilio_email', ?, ?, ?)`,
    )
      .bind(
        id,
        body.unitId || null,
        body.to,
        body.subject,
        body.body,
        data.operationId || null,
        res.status === 202 ? 'queued' : 'failed',
        res.status === 202 ? null : (data.detail || data.message || `Twilio Email HTTP ${res.status}`),
      )
      .run();

    if (res.status !== 202) {
      return json({ ok: false, error: data.detail || data.message || 'Twilio Email rejected the request', details: data }, env, { status: 200 });
    }
    return json({ ok: true, id, operationId: data.operationId, status: 'queued' }, env);
  } catch (err: any) {
    await env.DB.prepare(
      `INSERT INTO messages (id, unit_id, channel, direction, to_address, subject, body, provider, status, error)
       VALUES (?, ?, 'email', 'outbound', ?, ?, ?, 'twilio_email', 'failed', ?)`,
    )
      .bind(id, body.unitId || null, body.to, body.subject, body.body, String(err?.message || err))
      .run();
    return json({ ok: false, error: `Network/Twilio Email error: ${err?.message || err}` }, env, { status: 200 });
  }
}
