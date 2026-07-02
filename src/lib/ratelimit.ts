/**
 * Rate limiter for the API, keyed by client IP + a per-route bucket. Counters
 * live in the link store: Redis when configured (shared across serverless
 * instances — real limiting), in-memory otherwise (local dev). Fails open on
 * store errors so a Redis blip can't take the API down.
 */

import { rateHit } from "./links";

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
export async function rateLimit(
  req: Request,
  bucket: string,
  limit = 20,
  windowMs = 60_000,
): Promise<boolean> {
  try {
    const count = await rateHit(
      `${bucket}:${clientIp(req)}`,
      Math.ceil(windowMs / 1000),
    );
    return count <= limit;
  } catch {
    return true;
  }
}

/** Convenience: a 429 JSON Response for a blocked request. */
export const tooMany = () =>
  new Response(JSON.stringify({ error: "rate limited — slow down" }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
