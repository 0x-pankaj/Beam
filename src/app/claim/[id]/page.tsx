import type { Metadata } from "next";
import { getLink, REASON_META } from "@/lib/links";
import ClaimClient from "./ClaimClient";

// Rich link preview when a Beam claim link is shared in chats/socials.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const link = await getLink(id).catch(() => null);
  if (!link) return { title: "Beam" };

  const amount = `$${Number(link.amountUsd).toLocaleString()}`;
  const who = link.senderName ?? "Someone";
  const title = `${who} sent you ${amount} ${REASON_META[link.reason].emoji}`;
  const description = link.note
    ? `"${link.note}" — claim it with a tap. No wallet needed.`
    : "Claim it with a tap on Beam. No wallet, no seed phrase.";

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClaimClient id={id} />;
}
