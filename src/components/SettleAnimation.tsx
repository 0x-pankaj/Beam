"use client";

import { chainName } from "@/lib/chains";

/**
 * Makes the Universal Accounts cross-chain magic visible: funds flow from the
 * source chain(s) → Arbitrum. Driven by the real deposit chains from the tx.
 */
export function SettleAnimation({
  sourceChainIds,
  gasless,
}: {
  sourceChainIds: number[];
  gasless?: boolean;
}) {
  const sources = sourceChainIds.length ? sourceChainIds : null;
  const pill =
    "rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs";
  return (
    <div className="my-2 flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-2">
        <div className="flex max-w-[8rem] flex-wrap justify-end gap-1">
          {sources ? (
            sources.map((id) => (
              <span key={id} className={pill}>
                {chainName(id)}
              </span>
            ))
          ) : (
            <span className={pill}>your balance</span>
          )}
        </div>
        <span className="animate-pulse text-lg text-[var(--accent)]">⟶</span>
        <span
          className={`${pill} animate-pop border-[var(--success)] font-semibold text-[var(--success)]`}
        >
          Arbitrum
        </span>
      </div>
      {gasless && (
        <span className="text-xs text-[var(--success)]">⛽ $0 gas fees</span>
      )}
    </div>
  );
}
