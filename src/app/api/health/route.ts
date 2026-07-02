import { NextResponse } from "next/server";
import { isPersistent } from "@/lib/links";
import { relayerConfigured, relayerAddress } from "@/lib/relayer";
import { productionGap } from "@/lib/guard";

// Quick diagnostic: confirms whether a persistent (KV/Upstash) store is wired.
// On Vercel, links only survive across serverless instances when this is true.
// `productionGap` names the misconfiguration blocking real payments (or null).
export async function GET() {
  const gap = productionGap();
  return NextResponse.json({
    ok: !gap,
    productionGap: gap,
    persistentStore: isPersistent(),
    escrowRelayer: relayerConfigured(),
    relayerAddress: relayerAddress(),
    googleEnabled: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    magicConfigured: !!process.env.NEXT_PUBLIC_MAGIC_API_KEY,
    particleConfigured: !!process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  });
}
