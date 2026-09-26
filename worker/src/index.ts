import { Env, json, corsHeaders } from './lib';
import { sendSms, sendEmail } from './twilio';
import { fetchReviews, getCachedReviews } from './reviews';
import { sendLeaseForSignature, sendVendorContractForSignature, docusignWebhook, docusignStatus } from './docusign';
import { scanLease } from './leasescan';
import {
  listProperties, createProperty,
  listUnits, createUnit,
  listTenants, createTenant,
  listLeases, createLease,
  listVendors, createVendor,
  listMaintenance, createMaintenance,
  listMessages,
} from './crud';

// GET /api/health — tells the dashboard (and you) exactly which live
// integrations are wired up with real credentials vs. still needing setup,
// without ever exposing the secret values themselves.
function health(env: Env): Response {
  const status = {
    twilio: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER),
    twilioEmail: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_EMAIL),
    googleReviews: Boolean(env.GOOGLE_PLACES_API_KEY && env.GOOGLE_PLACE_ID),
    docusign: Boolean(env.DOCUSIGN_INTEGRATION_KEY && env.DOCUSIGN_USER_ID && env.DOCUSIGN_ACCOUNT_ID && env.DOCUSIGN_PRIVATE_KEY),
    workersAi: true, // native to the account, no key needed
    d1: true,
  };
  return json({ ok: true, integrations: status }, env);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (pathname === '/api/health' && method === 'GET') return health(env);

      if (pathname === '/api/sms/send' && method === 'POST') return await sendSms(request, env);
      if (pathname === '/api/email/send' && method === 'POST') return await sendEmail(request, env);

      if (pathname === '/api/reviews/fetch' && method === 'POST') return await fetchReviews(request, env);
      if (pathname === '/api/reviews/cached' && method === 'GET') return await getCachedReviews(request, env);

      if (pathname === '/api/docusign/lease' && method === 'POST') return await sendLeaseForSignature(request, env);
      if (pathname === '/api/docusign/vendor-contract' && method === 'POST') return await sendVendorContractForSignature(request, env);
      if (pathname === '/api/docusign/webhook' && method === 'POST') return await docusignWebhook(request, env);
      if (pathname === '/api/docusign/status' && method === 'GET') return await docusignStatus(request, env);

      if (pathname === '/api/lease/scan' && method === 'POST') return await scanLease(request, env);

      if (pathname === '/api/properties' && method === 'GET') return await listProperties(env);
      if (pathname === '/api/properties' && method === 'POST') return await createProperty(request, env);

      if (pathname === '/api/units' && method === 'GET') return await listUnits(request, env);
      if (pathname === '/api/units' && method === 'POST') return await createUnit(request, env);

      if (pathname === '/api/tenants' && method === 'GET') return await listTenants(request, env);
      if (pathname === '/api/tenants' && method === 'POST') return await createTenant(request, env);

      if (pathname === '/api/leases' && method === 'GET') return await listLeases(request, env);
      if (pathname === '/api/leases' && method === 'POST') return await createLease(request, env);

      if (pathname === '/api/vendors' && method === 'GET') return await listVendors(env);
      if (pathname === '/api/vendors' && method === 'POST') return await createVendor(request, env);

      if (pathname === '/api/maintenance' && method === 'GET') return await listMaintenance(request, env);
      if (pathname === '/api/maintenance' && method === 'POST') return await createMaintenance(request, env);

      if (pathname === '/api/messages' && method === 'GET') return await listMessages(request, env);

      return json({ ok: false, error: `No route for ${method} ${pathname}` }, env, { status: 404 });
    } catch (err: any) {
      return json({ ok: false, error: `Unhandled worker error: ${err?.message || err}` }, env, { status: 500 });
    }
  },
};
