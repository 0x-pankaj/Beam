/**
 * Production readiness guard. In production Beam must never silently degrade
 * to the unsafe fallbacks (in-memory link store, unverified client-reported
 * payments): each request can hit a fresh serverless instance, so memory-mode
 * loses links and bypasses the replay/escrow-reservation guards, and without
 * the relayer nothing is verified on-chain. Mutating routes call this and
 * refuse to run rather than pretend.
 *
 * Local dev (`pnpm dev`) is unaffected — the fallbacks remain for iteration.
 */

import { NextResponse } from "next/server";
import { isPersistent } from "./links";
import { relayerConfigured } from "./relayer";

/** Human-readable reason the deployment is not production-ready, or null. */
export function productionGap(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (!isPersistent())
    return "persistent store not configured (set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN)";
  if (!relayerConfigured())
    return "escrow relayer not configured (set BEAM_RELAYER_PRIVATE_KEY)";
  return null;
}

/** 503 response when the deployment is misconfigured for real money; else null. */
export function requireProductionReady(): NextResponse | null {
  const gap = productionGap();
  if (!gap) return null;
  return NextResponse.json(
    { error: `server misconfigured for real payments: ${gap}` },
    { status: 503 },
  );
}
