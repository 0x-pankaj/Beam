"use client";

import { ReactNode } from "react";
import { MagicProvider } from "@/providers/MagicProvider";
import { UniversalAccountProvider } from "@/providers/UniversalAccountProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MagicProvider>
      <UniversalAccountProvider>{children}</UniversalAccountProvider>
    </MagicProvider>
  );
}
