import type { Metadata } from "next";
import { usernameToAddress, normUsername } from "@/lib/links";
import UserPayClient from "./UserPayClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const name = normUsername(username);
  const title = `Pay @${name} on Beam`;
  const description = "Send them money with a tap — no wallet, no seed phrase.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const name = normUsername(username);
  const address = await usernameToAddress(name).catch(() => null);
  return <UserPayClient username={name} recipient={address} />;
}
