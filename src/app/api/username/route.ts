import { NextRequest, NextResponse } from "next/server";
import {
  addressToUsername,
  claimUsername,
  usernameToAddress,
} from "@/lib/links";

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

// Claim/update a handle for an address.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { address, name } = body ?? {};
  if (!address || !name)
    return NextResponse.json({ error: "address and name required" }, { status: 400 });
  const result = await claimUsername(String(address), String(name));
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
