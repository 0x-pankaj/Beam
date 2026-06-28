"use client";

import { QRCodeSVG } from "qrcode.react";

/** A scannable QR for a Beam link — white card so it reads on the dark UI. */
export function Qr({ url, size = 132 }: { url: string; size?: number }) {
  return (
    <div className="mx-auto w-fit rounded-2xl bg-white p-3">
      <QRCodeSVG value={url} size={size} level="M" />
    </div>
  );
}
