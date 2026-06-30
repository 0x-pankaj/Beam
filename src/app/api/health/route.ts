import { NextResponse } from "next/server";
import { isPersistent } from "@/lib/links";
import { relayerConfigured } from "@/lib/relayer";

// Quick diagnostic: confirms whether a persistent (KV/Upstash) store is wired.
// On Vercel, links only survive across serverless instances when this is true.
export async function GET() {
  return NextResponse.json({
    ok: true,
    persistentStore: isPersistent(),
    escrowRelayer: relayerConfigured(),
    googleEnabled: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    magicConfigured: !!process.env.NEXT_PUBLIC_MAGIC_API_KEY,
    particleConfigured: !!process.env.NEXT_PUBLIC_PARTICLE_APP_ID,
  });
}
