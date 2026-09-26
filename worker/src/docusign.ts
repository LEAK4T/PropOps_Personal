import { Env, json, notConfigured, newId, signJwtRS256, bytesToBase64 } from './lib';

const JWT_AUD: Record<string, string> = {
  'https://demo.docusign.net': 'account-d.docusign.com',
  'https://na1.docusign.net': 'account.docusign.com',
  'https://na2.docusign.net': 'account.docusign.com',
  'https://na3.docusign.net': 'account.docusign.com',
  'https://eu.docusign.net': 'account.docusign.com',
};

function docusignMissing(env: Env): string[] {
  const missing: string[] = [];
  if (!env.DOCUSIGN_INTEGRATION_KEY) missing.push('DOCUSIGN_INTEGRATION_KEY');
  if (!env.DOCUSIGN_USER_ID) missing.push('DOCUSIGN_USER_ID');
  if (!env.DOCUSIGN_ACCOUNT_ID) missing.push('DOCUSIGN_ACCOUNT_ID');
  if (!env.DOCUSIGN_PRIVATE_KEY) missing.push('DOCUSIGN_PRIVATE_KEY');
  return missing;
}

// JWT Grant flow — server-to-server auth, no user login popup needed.
// Requires one-time manual consent: visit the consent URL printed in the
// setup guide once per integration key, logged in as the impersonated user.
async function getAccessToken(env: Env): Promise<{ token?: string; error?: string }> {
  const aud = JWT_AUD[env.DOCUSIGN_BASE_URL] || 'account-d.docusign.com';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: env.DOCUSIGN_INTEGRATION_KEY,
    sub: env.DOCUSIGN_USER_ID,
    aud,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  };

  let assertion: string;
  try {
    assertion = await signJwtRS256(payload, env.DOCUSIGN_PRIVATE_KEY!);
  } catch (err: any) {
    return { error: `Failed to sign JWT — check DOCUSIGN_PRIVATE_KEY is a PKCS#8 PEM ("-----BEGIN PRIVATE KEY-----"), not PKCS#1 ("BEGIN RSA PRIVATE KEY"). Convert with: openssl pkcs8 -topk8 -inform PEM -outform PEM -in key.pem -out key_pkcs8.pem -nocrypt. Error: ${err?.message || err}` };
  }

  const res = await fetch(`https://${aud}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  const data: any = await res.json();
  if (!res.ok) {
    if (data.error === 'consent_required') {
      const consentUrl = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${env.DOCUSIGN_INTEGRATION_KEY}&redirect_uri=https://www.docusign.com`;
      return { error: `consent_required — open this URL once, logged in as the DocuSign user matching DOCUSIGN_USER_ID, click Allow, then retry: ${consentUrl}` };
    }
    return { error: data.error_description || data.error || `DocuSign token HTTP ${res.status}` };
  }
  return { token: data.access_token };
}

async function createEnvelope(env: Env, opts: {
  subject: string;
  documentName: string;
  documentText: string;
  signerEmail: string;
  signerName: string;
}) {
  const { token, error } = await getAccessToken(env);
  if (!token) return { ok: false, error };

  // Plain-text document with an anchor string DocuSign finds and replaces
  // with a Sign Here tab — no fixed x/y coordinates to maintain.
  const docWithAnchor = `${opts.documentText}\n\n\nSigned: /sig1/\t\tDate: /date1/`;
  const docBase64 = bytesToBase64(new TextEncoder().encode(docWithAnchor));

  const envelopeDef = {
    emailSubject: opts.subject,
    status: 'sent',
    documents: [
      {
        documentBase64: docBase64,
        name: opts.documentName,
        fileExtension: 'txt',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: opts.signerEmail,
          name: opts.signerName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [{ anchorString: '/sig1/', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
            dateSignedTabs: [{ anchorString: '/date1/', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
          },
        },
      ],
    },
  };

  const res = await fetch(`${env.DOCUSIGN_BASE_URL}/restapi/v2.1/accounts/${env.DOCUSIGN_ACCOUNT_ID}/envelopes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelopeDef),
  });
  const data: any = await res.json();
  if (!res.ok) return { ok: false, error: data.message || `DocuSign envelope HTTP ${res.status}`, details: data };
  return { ok: true, envelopeId: data.envelopeId, status: data.status };
}

// POST /api/docusign/lease  { leaseId, unitId, documentText, signerEmail, signerName, unitLabel }
export async function sendLeaseForSignature(req: Request, env: Env): Promise<Response> {
  const missing = docusignMissing(env);
  if (missing.length) return notConfigured(env, missing);

  const body: any = await req.json().catch(() => ({}));
  if (!body.leaseId || !body.documentText || !body.signerEmail || !body.signerName) {
    return json({ ok: false, error: 'leaseId, documentText, signerEmail, and signerName are required' }, env, { status: 400 });
  }

  const result = await createEnvelope(env, {
    subject: `Please sign: Lease for ${body.unitLabel || 'your unit'}`,
    documentName: `Lease_${body.leaseId}.txt`,
    documentText: body.documentText,
    signerEmail: body.signerEmail,
    signerName: body.signerName,
  });

  if (!result.ok) return json(result, env);

  await env.DB.prepare(`UPDATE leases SET docusign_envelope_id = ?, status = 'sent' WHERE id = ?`)
    .bind(result.envelopeId, body.leaseId)
    .run();
  await env.DB.prepare(
    `INSERT INTO docusign_envelopes (id, kind, related_id, status) VALUES (?, 'lease', ?, 'sent')`,
  ).bind(result.envelopeId, body.leaseId).run();

  return json({ ok: true, envelopeId: result.envelopeId, status: result.status }, env);
}

// POST /api/docusign/vendor-contract  { vendorId, contractText, signerEmail, signerName, vendorName }
export async function sendVendorContractForSignature(req: Request, env: Env): Promise<Response> {
  const missing = docusignMissing(env);
  if (missing.length) return notConfigured(env, missing);

  const body: any = await req.json().catch(() => ({}));
  if (!body.vendorId || !body.contractText || !body.signerEmail || !body.signerName) {
    return json({ ok: false, error: 'vendorId, contractText, signerEmail, and signerName are required' }, env, { status: 400 });
  }

  const result = await createEnvelope(env, {
    subject: `Please sign: Service Agreement — ${body.vendorName || body.vendorId}`,
    documentName: `Contract_${body.vendorId}.txt`,
    documentText: body.contractText,
    signerEmail: body.signerEmail,
    signerName: body.signerName,
  });

  if (!result.ok) return json(result, env);

  await env.DB.prepare(`UPDATE vendors SET contract_id = ?, contract_status = 'sent' WHERE id = ?`)
    .bind(result.envelopeId, body.vendorId)
    .run();
  await env.DB.prepare(
    `INSERT INTO docusign_envelopes (id, kind, related_id, status) VALUES (?, 'vendor_contract', ?, 'sent')`,
  ).bind(result.envelopeId, body.vendorId).run();

  return json({ ok: true, envelopeId: result.envelopeId, status: result.status }, env);
}

// POST /api/docusign/webhook — DocuSign Connect delivers status changes here
// (envelope sent/delivered/completed/declined/voided). Configure the Connect
// listener in DocuSign admin to POST to this URL with the JSON (aeg) format.
// Optional HMAC verification if DOCUSIGN_HMAC_KEY is set.
export async function docusignWebhook(req: Request, env: Env): Promise<Response> {
  const raw = await req.text();

  if (env.DOCUSIGN_HMAC_KEY) {
    const sig = req.headers.get('X-DocuSign-Signature-1');
    if (!sig) return json({ ok: false, error: 'Missing HMAC signature header' }, env, { status: 401 });
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.DOCUSIGN_HMAC_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    if (expected !== sig) return json({ ok: false, error: 'HMAC signature mismatch' }, env, { status: 401 });
  }

  let envelopeId: string | null = null;
  let status: string | null = null;

  try {
    const data = JSON.parse(raw);
    envelopeId = data.data?.envelopeId || data.envelopeId || null;
    status = data.data?.envelopeSummary?.status || data.status || null;
  } catch {
    // Fall back to classic XML Connect format.
    const idMatch = raw.match(/<EnvelopeID>([^<]+)<\/EnvelopeID>/);
    const statusMatch = raw.match(/<Status>([^<]+)<\/Status>/);
    envelopeId = idMatch?.[1] || null;
    status = statusMatch?.[1] || null;
  }

  if (!envelopeId || !status) {
    return json({ ok: false, error: 'Could not parse envelopeId/status from webhook payload' }, env, { status: 400 });
  }

  await env.DB.prepare(`UPDATE docusign_envelopes SET status = ?, last_event_at = datetime('now') WHERE id = ?`)
    .bind(status.toLowerCase(), envelopeId)
    .run();

  const envRow: any = await env.DB.prepare(`SELECT * FROM docusign_envelopes WHERE id = ?`).bind(envelopeId).first();
  if (envRow) {
    if (envRow.kind === 'lease') {
      await env.DB.prepare(`UPDATE leases SET status = ? WHERE id = ?`).bind(status.toLowerCase(), envRow.related_id).run();
    } else if (envRow.kind === 'vendor_contract') {
      await env.DB.prepare(`UPDATE vendors SET contract_status = ? WHERE id = ?`).bind(status.toLowerCase(), envRow.related_id).run();
    }
  }

  return json({ ok: true }, env);
}

// GET /api/docusign/status?envelopeId=...
export async function docusignStatus(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const envelopeId = url.searchParams.get('envelopeId');
  if (!envelopeId) return json({ ok: false, error: 'envelopeId query param required' }, env, { status: 400 });
  const row = await env.DB.prepare(`SELECT * FROM docusign_envelopes WHERE id = ?`).bind(envelopeId).first();
  return json({ ok: true, envelope: row || null }, env);
}
