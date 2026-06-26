export const short = (addr?: string | null) =>
  addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

export const usd = (n: number | string) =>
  `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const claimUrl = (id: string) =>
  typeof window !== "undefined" ? `${window.location.origin}/claim/${id}` : `/claim/${id}`;
