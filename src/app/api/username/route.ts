import { NextRequest, NextResponse } from "next/server";
import {
  addressToUsername,
  claimUsername,
  usernameToAddress,
} from "@/lib/links";
import { isEvmAddress } from "@/lib/validate";
import { usernameClaimMessage, verifySigner } from "@/lib/auth";
import { rateLimit, tooMany } from "@/lib/ratelimit";

// Resolve a handle -> address (?name=) or address -> handle (?address=).
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  const address = req.nextUrl.searchParams.get("address");
  if (name) {
    const addr = await usernameToAddress(name);
    return NextResponse.json({ name, address: addr, available: !addr });
  }
  if (address) {
    return NextResponse.json({ address, name: await addressToUsername(address) });
  }
  return NextResponse.json({ error: "name or address required" }, { status: 400 });
}

// Claim/update a handle for an address — gated by a signature proving the
// caller controls that address (otherwise anyone could squat handles).
export async function POST(req: NextRequest) {
  if (!(await rateLimit(req, "username", 15))) return tooMany();
  const body = await req.json().catch(() => null);
  const { address, name, signature } = body ?? {};
  if (!isEvmAddress(address) || !name)
    return NextResponse.json({ error: "valid address and name required" }, { status: 400 });
  if (!verifySigner(usernameClaimMessage(String(name), String(address)), signature, String(address)))
    return NextResponse.json({ error: "signature does not match address" }, { status: 401 });
  const result = await claimUsername(String(address), String(name));
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
