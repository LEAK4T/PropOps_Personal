import { Env, json, notConfigured, newId } from './lib';

// POST /api/reviews/fetch  — pulls live Google reviews for the configured
// Place ID via the Places API (New) Place Details endpoint, and caches them
// in D1 so the dashboard has something to show even if the API is slow or
// briefly unavailable.
export async function fetchReviews(req: Request, env: Env): Promise<Response> {
  const missing: string[] = [];
  if (!env.GOOGLE_PLACES_API_KEY) missing.push('GOOGLE_PLACES_API_KEY');
  if (!env.GOOGLE_PLACE_ID) missing.push('GOOGLE_PLACE_ID (var in wrangler.toml — find yours with the Place ID Finder tool)');
  if (missing.length) return notConfigured(env, missing);

  let propertyId = 'sandbox';
  try {
    const body: any = await req.json();
    if (body?.propertyId) propertyId = body.propertyId;
  } catch {
    // no body is fine, use default
  }

  try {
    const url = `https://places.googleapis.com/v1/places/${env.GOOGLE_PLACE_ID}?fields=displayName,rating,userRatingCount,reviews&key=${env.GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data: any = await res.json();

    if (!res.ok) {
      return json({ ok: false, error: data?.error?.message || `Google Places HTTP ${res.status}` }, env);
    }

    const reviews = (data.reviews || []).map((r: any) => ({
      author: r.authorAttribution?.displayName || 'Anonymous',
      rating: r.rating || 0,
      comment: r.text?.text || r.originalText?.text || '',
      relativeTime: r.relativePublishTimeDescription || '',
    }));

    // Refresh the cache: clear old rows for this property, insert fresh ones.
    await env.DB.prepare(`DELETE FROM reviews_cache WHERE property_id = ?`).bind(propertyId).run();
    for (const r of reviews) {
      await env.DB.prepare(
        `INSERT INTO reviews_cache (id, property_id, author, rating, comment, relative_time) VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(newId('rev'), propertyId, r.author, r.rating, r.comment, r.relativeTime)
        .run();
    }

    return json({
      ok: true,
      placeName: data.displayName?.text,
      overallRating: data.rating,
      totalRatings: data.userRatingCount,
      reviews,
    }, env);
  } catch (err: any) {
    return json({ ok: false, error: `Network/Google error: ${err?.message || err}` }, env);
  }
}

// GET /api/reviews/cached?propertyId=sandbox
export async function getCachedReviews(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('propertyId') || 'sandbox';
  const rows = await env.DB.prepare(`SELECT * FROM reviews_cache WHERE property_id = ? ORDER BY fetched_at DESC`)
    .bind(propertyId)
    .all();
  return json({ ok: true, reviews: rows.results }, env);
}
