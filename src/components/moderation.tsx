import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useVotingPowerNow } from "../lib/snapshot";
import { useItemModeration, flagItem, unflagItem } from "../lib/community";

/**
 * A flag / retract control for a post, reply, or chat message. Only connected
 * BGOV holders (shareholders) can flag; the server re-verifies. Once enough
 * distinct shareholders flag an item it's hidden pending a moderator's review.
 */
export function FlagButton({ id, surface, preview }: { id: string; surface: string; preview?: string }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: vp } = useVotingPowerNow(address);
  const { mine, flagCount } = useItemModeration(id, address);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!isConnected || (vp ?? 0) < 1) return null; // shareholders only

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!walletClient || !address) return;
    setBusy(true);
    try {
      if (mine) await unflagItem({ walletClient, account: address, id });
      else await flagItem({ walletClient, account: address, id, surface, preview });
      qc.invalidateQueries({ queryKey: ["community"] });
    } catch {
      /* user can retry */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={mine ? "You flagged this — click to retract" : "Flag for moderator review"}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        fontFamily: "var(--font-sans)",
        fontSize: "0.7rem",
        color: mine ? "#9a2a2a" : "var(--color-ink-dim)",
        whiteSpace: "nowrap",
      }}
    >
      ⚑ {mine ? "Flagged" : "Flag"}{flagCount > 0 ? ` ${flagCount}` : ""}
    </button>
  );
}

/** Shown in place of content hidden by community flags. */
export function HiddenNotice({ compact }: { compact?: boolean }) {
  return (
    <p style={{ fontFamily: "var(--font-sans)", fontSize: compact ? "0.78rem" : "0.82rem", fontStyle: "italic", color: "var(--color-ink-dim)", margin: 0 }}>
      ⚑ Hidden — flagged by the community, pending moderator review.
    </p>
  );
}
