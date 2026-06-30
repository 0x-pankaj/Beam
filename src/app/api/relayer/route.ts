import { NextResponse } from "next/server";
import { relayerAddress, relayerConfigured } from "@/lib/relayer";

// Where a sender deposits escrow funds. Single source of truth for the client
// so the deposit address can never drift from the key the server pays out with.
export async function GET() {
  return NextResponse.json({
    configured: relayerConfigured(),
    address: relayerAddress(),
  });
}
