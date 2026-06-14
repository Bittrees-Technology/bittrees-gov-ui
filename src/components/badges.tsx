import { useVotingPowerNow } from "../lib/snapshot";
import { useUserRoles, tierFor } from "../lib/community";
import { fmtNumber } from "../lib/links";

/**
 * Badges shown next to an address in the forum + chat: the automatic BGOV tier
 * (Partner / Junior Partner / Associate / Shareholder) plus any admin-assigned
 * custom roles. Renders nothing if the address has neither.
 */
export function UserBadges({ address }: { address?: string }) {
  const { data: vp } = useVotingPowerNow(address);
  const roles = useUserRoles(address);
  if (!address) return null;
  const tier = tierFor(vp ?? 0);
  if (!tier && roles.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: "0.3rem", flexWrap: "wrap", alignItems: "center" }}>
      {tier && (
        <span title={`Holds ${fmtNumber(vp)} BGOV common stock`} style={tierChip}>
          {tier}
        </span>
      )}
      {roles.map((r) => {
        const c = r.color || "var(--color-secondary)";
        return (
          <span key={r.label} style={{ ...customChip, color: c, borderColor: c }}>
            {r.label}
          </span>
        );
      })}
    </span>
  );
}

const chipBase = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.6rem",
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  borderRadius: "999px",
  padding: "0.05rem 0.4rem",
  whiteSpace: "nowrap" as const,
  borderWidth: "1px",
  borderStyle: "solid" as const,
} as const;

const tierChip = { ...chipBase, color: "var(--color-primary-hover)", borderColor: "var(--color-primary)" };
const customChip = { ...chipBase };
