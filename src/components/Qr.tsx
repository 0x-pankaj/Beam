"use client";

import { QRCodeSVG } from "qrcode.react";

/** A scannable QR for a Beam link — bordered white card matching the design. */
export function Qr({ url, size = 147 }: { url: string; size?: number }) {
  return (
    <div
      className="w-fit shrink-0"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: 12,
      }}
    >
      <QRCodeSVG value={url} size={size} level="M" />
    </div>
  );
}
