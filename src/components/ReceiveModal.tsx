"use client";

import { useState } from "react";
import { Qr } from "./Qr";
import { receiveUri } from "@/lib/receive";

/**
 * "Receive" — show a QR of the user's address so anyone (any wallet, no Beam
 * account needed) can send them money directly. Optionally encode a USDC amount.
 */
export function ReceiveModal({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const amt = Number(amount);
  const uri = receiveUri(address, amt > 0 ? amt : undefined);
  const hasAmount = amt > 0;

  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          flex: "1 1 130px",
          background: "rgba(255,255,255,.14)",
          border: "1px solid rgba(255,255,255,.3)",
          borderRadius: 12,
          padding: "11px 14px",
          fontSize: 13.5,
          fontWeight: 700,
          color: "#fff",
          cursor: "pointer",
        }}
        title="Show a QR anyone can scan to send you money directly"
      >
        Receive
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(16,21,18,.55)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 22,
              padding: 24,
              width: "100%",
              maxWidth: 360,
              textAlign: "center",
              boxShadow: "0 30px 60px -20px rgba(16,21,18,.4)",
            }}
          >
            <p style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 800, letterSpacing: "-.02em", color: "#10211a" }}>
              Receive money
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#79857c" }}>
              Anyone can scan this and send — no Beam account needed.
            </p>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <Qr url={uri} size={188} />
            </div>

            <button
              onClick={copy}
              style={{
                marginTop: 14,
                width: "100%",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 12.5,
                color: "#3a453e",
                background: "var(--field)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "11px 12px",
                wordBreak: "break-all",
                cursor: "pointer",
                fontWeight: 500,
              }}
              title="Copy address"
            >
              {copied ? "Address copied ✓" : address}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: "#79857c" }}>$</span>
              <input
                inputMode="decimal"
                placeholder="Amount (optional)"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: 600,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "var(--field)",
                  color: "#10211a",
                  outline: "none",
                }}
              />
            </div>

            <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "#9aa69d", lineHeight: 1.5 }}>
              {hasAmount
                ? "Requesting USDC on Arbitrum. Supporting wallets prefill the amount."
                : "Send any token on any supported chain. It lands on whatever chain the sender uses and shows up in your one Beam balance."}
            </p>

            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: 16,
                width: "100%",
                background: "var(--ac)",
                border: "none",
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
