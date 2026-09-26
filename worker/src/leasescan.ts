import { Env, json, base64ToBytes } from './lib';

// POST /api/lease/scan  { imageBase64, mimeType }
// Uses Cloudflare Workers AI's vision model directly on your account — no
// separate OCR vendor/account needed, per your call to let Cloudflare
// handle this piece. Returns EXTRACTED FIELDS ONLY; nothing is saved to D1
// here — the dashboard shows them in an editable review form first, since
// vision-model extraction from a photographed/scanned lease can misread a
// name or number and you should confirm before it lands in your data.
export async function scanLease(req: Request, env: Env): Promise<Response> {
  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, env, { status: 400 });
  }
  if (!body.imageBase64) {
    return json({ ok: false, error: 'imageBase64 is required (base64-encoded image or PDF page of the lease)' }, env, { status: 400 });
  }

  const imageBytes = base64ToBytes(body.imageBase64);

  const prompt = `You are reading a residential or commercial lease document. Extract the following fields and respond with ONLY a single valid JSON object, no markdown fences, no commentary:
{
  "tenantName": string or null,
  "tenantAge": number or null,
  "additionalOccupants": [{"name": string, "age": number or null}],
  "unitNumber": string or null,
  "parkingSpot": string or null,
  "monthlyRent": number or null,
  "leaseEndDate": string or null (YYYY-MM-DD if determinable, else the raw text you see),
  "ownerOrBusinessName": string or null (for commercial leases only)
}
If a field isn't present in the document, use null (or an empty array for additionalOccupants). Do not guess values that aren't in the text.`;

  try {
    const result: any = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
      messages: [{ role: 'user', content: prompt }],
      image: Array.from(imageBytes),
      max_tokens: 1024,
    });

    const rawText: string = result.response || result.description || JSON.stringify(result);
    let extracted: any = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      extracted = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return json({
        ok: false,
        error: "The vision model didn't return clean JSON — try a clearer/higher-resolution scan, or clean up the fields below manually.",
        rawModelOutput: rawText,
      }, env);
    }

    return json({ ok: true, extracted, rawModelOutput: rawText, note: 'Auto-extracted — please review every field against the actual document before saving.' }, env);
  } catch (err: any) {
    return json({ ok: false, error: `Workers AI error: ${err?.message || err}. Confirm Workers AI is enabled for this Cloudflare account.` }, env);
  }
}
