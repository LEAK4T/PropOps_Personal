// Shared helpers: CORS, JSON responses, id generation, D1 access.

export interface Env {
  DB: D1Database;
  AI: Ai;
  ALLOWED_ORIGIN: string;
  DOCUSIGN_BASE_URL: string;
  TWILIO_FROM_NUMBER: string;
  TWILIO_FROM_EMAIL: string;
  GOOGLE_PLACE_ID: string;

  // Secrets — set via `wrangler secret put <NAME>`, never in wrangler.toml.
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  GOOGLE_PLACES_API_KEY?: string;
  DOCUSIGN_INTEGRATION_KEY?: string; // Client ID
  DOCUSIGN_USER_ID?: string;         // Impersonated user's GUID
  DOCUSIGN_ACCOUNT_ID?: string;
  DOCUSIGN_PRIVATE_KEY?: string;     // RSA private key, PEM format
  DOCUSIGN_HMAC_KEY?: string;        // optional Connect webhook HMAC secret
}

export function corsHeaders(env: Env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export function json(data: unknown, env: Env, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
      ...(init.headers || {}),
    },
  });
}

// A "not configured" response is distinct from a hard error: it tells the
// caller (and the dashboard UI) exactly which secret is missing, per the
// "tell me if something isn't working" requirement, instead of failing
// silently or throwing a generic 500.
export function notConfigured(env: Env, missing: string[]) {
  return json(
    {
      ok: false,
      configured: false,
      missing,
      message: `Not configured: missing ${missing.join(', ')}. Set with "wrangler secret put <NAME>" then redeploy.`,
    },
    env,
    { status: 200 },
  );
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64url(input: ArrayBuffer | string): string {
  let base64: string;
  if (typeof input === 'string') {
    base64 = btoa(input);
  } else {
    base64 = bytesToBase64(new Uint8Array(input));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Signs a JWT with an RSA private key (PEM, PKCS#8) using RS256, entirely
// with the Workers-native Web Crypto API — no jsonwebtoken package needed.
export async function signJwtRS256(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encHeader}.${encPayload}`;

  const pemBody = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const keyBytes = base64ToBytes(pemBody);

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64url(signature)}`;
}
