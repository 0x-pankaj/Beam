/**
 * Minimal in-memory rate limiter for the API. Best-effort: on serverless it's
 * per-instance, but it still blunts bursts/abuse against the mutating routes
 * without external infra. Keyed by client IP + a per-route bucket.
 */

type Hit = { count: number; resetAt: number };
const g = globalThis as unknown as { __beamRate?: Map<string, Hit> };
const buckets = (g.__beamRate ??= new Map<string, Hit>());

function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Returns true if the request is ALLOWED, false if it should be rejected (429).
 * `limit` requests are allowed per `windowMs` for each ip+bucket.
 */
export function rateLimit(
  req: Request,
  bucket: string,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const key = `${bucket}:${clientIp(req)}`;
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || now > hit.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  hit.count += 1;
  return hit.count <= limit;
}

/** Convenience: a 429 JSON Response for a blocked request. */
export const tooMany = () =>
  new Response(JSON.stringify({ error: "rate limited — slow down" }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
