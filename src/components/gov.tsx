/** Small shared governance UI: proposal state + outcome badges + a results bar. */
import { fmtNumber } from "../lib/links";
import type { ProposalOutcome } from "../lib/snapshot";

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.1rem 0.5rem",
  fontSize: "0.68rem",
  fontWeight: 700,
  fontFamily: "var(--font-sans)",
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  borderRadius: "2px",
  whiteSpace: "nowrap" as const,
};

export function StateBadge({ state }: { state: string }) {
  const cfg =
    state === "active"
      ? { label: "Active", bg: "var(--color-secondary)", fg: "#ffffff" }
      : state === "pending"
        ? { label: "Pending", bg: "var(--color-bg-subtle)", fg: "var(--color-ink-muted)" }
        : { label: "Closed", bg: "var(--color-bg-subtle)", fg: "var(--color-ink-dim)" };
  return <span style={{ ...badgeStyle, background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>;
}

/** Outcome of a closed proposal: Passed / Failed / No quorum (null → renders nothing). */
export function OutcomeBadge({ outcome }: { outcome: ProposalOutcome }) {
  if (!outcome) return null;
  const cfg =
    outcome === "passed"
      ? { label: "Passed", bg: "var(--color-secondary)", fg: "#ffffff" }
      : outcome === "failed"
        ? { label: "Failed", bg: "#f3dada", fg: "#9a2a2a" }
        : { label: "No quorum", bg: "#f4ead2", fg: "#8a6d1a" };
  return <span style={{ ...badgeStyle, background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>;
}

export function ResultBar({
  choices,
  scores,
  scoresTotal,
  winning,
}: {
  choices: string[];
  scores: number[];
  scoresTotal: number;
  /** 0-based index of the leading choice, to emphasize it. */
  winning?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      {choices.map((choice, i) => {
        const score = scores[i] ?? 0;
        const pct = scoresTotal > 0 ? (score / scoresTotal) * 100 : 0;
        const isWin = winning === i;
        return (
          <div key={i}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "0.5rem",
                fontSize: "0.8125rem",
                fontFamily: "var(--font-sans)",
                marginBottom: "0.25rem",
              }}
            >
              <span style={{ color: "var(--color-ink)", fontWeight: isWin ? 700 : 400 }}>{choice}</span>
              <span
                style={{
                  color: "var(--color-ink-muted)",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtNumber(score)} · {pct.toFixed(1)}%
              </span>
            </div>
            <div
              style={{
                height: "6px",
                background: "var(--color-bg-subtle)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: isWin ? "var(--color-secondary)" : "var(--color-float)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
