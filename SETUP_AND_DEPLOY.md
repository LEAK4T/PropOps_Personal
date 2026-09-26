# PropOps AI — Live Sandbox: Setup & Deployment

This is your **personal** playground, separate from the client-facing demo repo
(`LEAK4T/PropOps-Ai`). Same dashboard, same fake properties/tenants — plus a new
**Live Sandbox** tab that makes real calls to Twilio (SMS and Email), DocuSign,
Google Reviews, and Cloudflare Workers AI, backed by a real Cloudflare D1
database.

## What's built, and what I could not test from here

**Built and verified:**
- Frontend (`frontend/`) — the dashboard, made responsive for phone/tablet
  (collapsible nav drawer below the `md` breakpoint), plus a new **Live
  Sandbox** tab with forms for every integration below. Verified with a
  TypeScript/JSX syntax check (zero errors) and a bracket-balance check —
  same method used for the client demo.
- Backend (`worker/`) — a Cloudflare Worker with routes for SMS, email,
  DocuSign envelopes + webhook, Google Reviews, and lease auto-scan, all
  backed by a D1 schema (`worker/schema.sql`). Verified with a full
  TypeScript type-check across all 6 source files (zero errors).

**Could not test live, and why:** this sandbox session's outbound network is
restricted to package registries and GitHub — it cannot reach
`api.twilio.com`, `comms.twilio.com`, `docusign.net`, or Google's APIs even if
credentials existed. I also couldn't run `npm install` here (the npm
registry itself returned 403 for this session — likely a temporary
restriction; try it again on your own machine, it's a standard install).
So: the code is written and internally consistent, but the first real test
of each integration happens after you deploy it with real keys. The
checklist at the bottom tells you exactly what to click to confirm each one
works, and what to send me if something doesn't.

---

## Part 1 — Cloudflare: D1 database + Workers AI

You already have a Cloudflare account from the client demo. Everything here
uses that same account.

```bash
cd propops-sandbox/worker
npm install
npx wrangler login          # opens a browser to authorize the CLI
npx wrangler d1 create propops_sandbox
```

That last command prints a `database_id`. Copy it into `worker/wrangler.toml`,
replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

Then load the schema:

```bash
npx wrangler d1 execute propops_sandbox --remote --file=./schema.sql
```

Workers AI (used for lease auto-scan) needs no separate signup — it's part
of your Cloudflare account already and billed pay-as-you-go with a
generous free daily allowance.

---

## Part 2 — Twilio (SMS and Email — one account, one set of credentials)

1. Sign up at twilio.com (free trial gives you credit and a temporary
   number).
2. From the Twilio Console dashboard, copy your **Account SID** and
   **Auth Token**.
3. Buy or use your trial phone number (Console → Phone Numbers) — this is
   your `TWILIO_FROM_NUMBER`, in E.164 format, e.g. `+13055551234`.
4. **Trial account limitation:** you can only send SMS to phone numbers
   you've verified in the Twilio Console (Console → Phone Numbers →
   Verified Caller IDs) until you upgrade to a paid account. Verify your
   own phone there for testing.
5. **For email:** Twilio Email (a separate product from the old SendGrid,
   but billed to the same account and using the same Account SID/Auth
   Token) still requires a **Verified Sender** — an approved sending
   domain, configured through the Console's Email Onboarding flow. This is
   the same domain-verification friction Resend would have required; it's
   just consolidated under your one Twilio account now instead of a
   second service. Whatever address you verify there is your
   `TWILIO_FROM_EMAIL`. If the Console doesn't offer a way to test without
   a domain you own, tell me exactly what it shows and we'll work around
   it.

## Part 3 — Google Reviews (Places API)

1. Go to console.cloud.google.com, create a project (or reuse one).
2. Enable the **Places API (New)**.
3. Create an API key (APIs & Services → Credentials) — this is your
   `GOOGLE_PLACES_API_KEY`. Restrict it to the Places API for safety.
4. Find your business's Place ID using Google's
   [Place ID Finder tool](https://developers.google.com/maps/documentation/places/web-service/place-id) —
   search your business name/address, copy the ID. This is your
   `GOOGLE_PLACE_ID`.
5. Note: Google only returns up to 5 reviews per place through this API,
   and you can't post replies through it (Google doesn't offer that via
   Places API — replying still happens through the Google Business
   Profile dashboard directly). The sandbox fetches and displays real
   reviews; the "Post Reply" button stays a demo action.

## Part 4 — DocuSign (e-signature)

This one has the most setup steps — DocuSign's server-to-server auth (JWT
Grant) needs a keypair and a one-time consent click.

1. Sign up for a free developer sandbox at
   [developer.docusign.com](https://developer.docusign.com) (this is
   separate from a production DocuSign account and doesn't cost anything).
2. In the DocuSign Admin panel (My Apps & Keys), create an **Integration
   Key** (this is `DOCUSIGN_INTEGRATION_KEY`).
3. On that same integration key, generate an **RSA keypair** — DocuSign's
   UI does this for you and gives you a private key. Save it to a file,
   e.g. `docusign_private.pem`.
4. **Important conversion step:** DocuSign gives you a PKCS#1 key
   (`-----BEGIN RSA PRIVATE KEY-----`), but the Worker's JWT signer needs
   PKCS#8 (`-----BEGIN PRIVATE KEY-----`). Convert it:
   ```bash
   openssl pkcs8 -topk8 -inform PEM -outform PEM -in docusign_private.pem -out docusign_private_pkcs8.pem -nocrypt
   ```
   Use the contents of `docusign_private_pkcs8.pem` as `DOCUSIGN_PRIVATE_KEY`.
5. Find your **API Username** (a GUID, under your DocuSign account
   settings) — this is `DOCUSIGN_USER_ID`.
6. Find your **API Account ID** (also on that same page) — this is
   `DOCUSIGN_ACCOUNT_ID`.
7. `DOCUSIGN_BASE_URL` stays `https://demo.docusign.net` for the developer
   sandbox (already set in `wrangler.toml`).
8. **One-time consent:** the first time you call the lease or vendor
   signature endpoint, it will fail with a `consent_required` error that
   includes a URL. Open that URL, log in as the same DocuSign user, click
   Allow — you only do this once per integration key.
9. Optional: set up DocuSign Connect (Admin → Connect) to POST status
   updates to `https://<your-worker-url>/api/docusign/webhook` so signed/
   declined statuses update automatically instead of only on-demand.

---

## Part 5 — Set the secrets on the Worker

Never put these in `wrangler.toml` — they're set directly on Cloudflare:

```bash
cd propops-sandbox/worker
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put DOCUSIGN_INTEGRATION_KEY
npx wrangler secret put DOCUSIGN_USER_ID
npx wrangler secret put DOCUSIGN_ACCOUNT_ID
npx wrangler secret put DOCUSIGN_PRIVATE_KEY
```

Each command pastes/prompts for one value at a time. Note `TWILIO_ACCOUNT_SID`
and `TWILIO_AUTH_TOKEN` power both SMS and Email — you only set them once.
Then edit the non-secret values directly in `worker/wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGIN = "https://your-sandbox-frontend-url.pages.dev"
TWILIO_FROM_NUMBER = "+13055551234"
TWILIO_FROM_EMAIL = "notifications@yourverifieddomain.com"
GOOGLE_PLACE_ID = "ChIJ......."
```

You can set up any subset of these first — the Live Sandbox tab's
"Integration Status" panel tells you exactly which ones are configured and
which are still missing, so nothing fails silently.

---

## Part 6 — Deploy the Worker (API backend)

```bash
cd propops-sandbox/worker
npx wrangler deploy
```

This prints your Worker's URL, e.g.
`https://propops-sandbox-api.YOUR-SUBDOMAIN.workers.dev`. Copy it — the
frontend needs it next.

---

## Part 7 — Push to a new, separate GitHub repo

This is deliberately a **different repo** from `LEAK4T/PropOps-Ai`, so your
personal sandbox and the client demo never collide.

```bash
cd propops-sandbox
git init
git add .
git commit -m "PropOps AI live sandbox: responsive dashboard + live integrations"
git branch -M main
```

Create a new, **empty** repo on GitHub (e.g. `propops-ai-sandbox`) — don't
initialize it with a README — then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/propops-ai-sandbox.git
git push -u origin main
```

(Use a Personal Access Token as the password when prompted, same as last
time.)

---

## Part 8 — Deploy the frontend to Cloudflare

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect
to Git** → pick your new `propops-ai-sandbox` repo.

- **Build command:** `npm run build`
- **Build output directory:** `out`
- **Root directory:** `frontend` (since the repo also contains `worker/`
  at the top level)
- **Environment variable:** add `NEXT_PUBLIC_API_BASE` set to the Worker
  URL from Part 6 (e.g. `https://propops-sandbox-api.YOUR-SUBDOMAIN.workers.dev`)

Save and deploy. Once it's live, go back to `worker/wrangler.toml` and set
`ALLOWED_ORIGIN` to this Pages URL, then re-run `npx wrangler deploy` in
`worker/` so CORS allows the frontend to call it.

---

## Testing checklist — run these after deploying

Go to the **Live Sandbox** tab on your deployed frontend:

1. **Integration Status panel** — confirms which secrets Cloudflare
   actually has. If something you set shows "Not configured," you likely
   need to redeploy the Worker after setting a secret (`wrangler secret
   put` takes effect on the next deploy).
2. **Send a Real SMS** — enter your own verified number, send, confirm you
   get the text.
3. **Send a Real Email** — enter your own email, send. A green result means
   Twilio *queued* it (the API is async) — check your inbox and spam folder
   a moment later to confirm actual delivery.
4. **Pull Live Google Reviews** — should show your business's actual
   reviews.
5. **Send a Lease for Signature** — pick a fake unit, put in your own
   email as the signer, send — you should get a real DocuSign signing
   email. If you get `consent_required`, follow the one-time consent link
   in the error message and try again.
6. **Send a Vendor Contract for Signature** — same idea, picks from the
   vendor directory.
7. **Auto-Scan a Lease Document** — upload any photo with some text on it
   (even a fake lease you write and print/screenshot) and confirm fields
   come back. Accuracy will vary — it's a general-purpose vision model, not
   a specialized document-AI product, so always review before saving.

If any step fails, copy the exact error text shown in the red banner —
that's the Worker's actual response, not a generic failure, and tells us
precisely what to fix.
