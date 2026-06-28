"use client";

import { useEffect, useRef, useState } from "react";
import { BeamBolt } from "@/components/icons";

/**
 * The "✨ securing your account" moment shown once, right after first login,
 * while the Universal Account initializes — visibly hiding the EIP-7702 upgrade
 * ("no wallet, no seed phrase"). Stays up for a readable minimum, once/session.
 */
export function OnboardingOverlay({ active }: { active: boolean }) {
  const [show, setShow] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("beam_onboarded")) return;
    if (active && !show) {
      setShow(true);
      startedAt.current = Date.now();
    }
    if (!active && show) {
      const wait = Math.max(0, 1700 - (Date.now() - startedAt.current));
      const t = setTimeout(() => {
        setShow(false);
        sessionStorage.setItem("beam_onboarded", "1");
      }, wait);
      return () => clearTimeout(t);
    }
  }, [active, show]);

  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 px-8 text-center"
      style={{
        background:
          "radial-gradient(800px 400px at 50% 30%, var(--at) 0%, var(--paper) 70%)",
      }}
    >
      <div
        className="animate-pop flex h-16 w-16 items-center justify-center rounded-3xl text-white"
        style={{
          background: "var(--ac)",
          boxShadow: "0 16px 34px -12px var(--ash)",
        }}
      >
        <BeamBolt size={30} />
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight">Securing your account</h2>
      <p className="max-w-xs text-sm text-[var(--muted)]">
        Upgrading your login into a chain-abstracted account — no wallet, no seed
        phrase, no new address.
      </p>
      <div className="mt-1 h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    </div>
  );
}
