import { useIsAdmin } from "./snapshot";
import { useUserRoles } from "./community";

/**
 * Admin-console access tiers.
 *  - "full"       — every tab + write access: Snapshot space admins, the standing
 *                   super-admin address, or a Partner / Junior Partner / Associate role.
 *  - "moderation" — only the Moderation tab: holders of the Moderator role.
 *  - "none"       — no admin access.
 *
 * The same tiers are enforced server-side in api/community.js + api/rooms.js (and
 * read live from the roles registry), so the UI gating matches what actually saves.
 * NOTE: Snapshot Space-settings writes still require a real Snapshot space admin —
 * that's enforced by Snapshot's sequencer, outside this app.
 */
export const SUPER_ADMIN = "0xe5350d96fc3161bf5c385843ec5ee24e8b465b2f"; // always full access
const FULL_ROLE_RE = /^(partner|junior partner|associate)$/i;
const MOD_ROLE_RE = /^(moderator|mod)$/i;

export type AdminLevel = "full" | "moderation" | "none";

export function useAdminAccess(address?: string): AdminLevel {
  const isSpaceAdmin = useIsAdmin(address);
  const roles = useUserRoles(address);
  if (!address) return "none";
  if (isSpaceAdmin || address.toLowerCase() === SUPER_ADMIN || roles.some((r) => FULL_ROLE_RE.test(r.label))) return "full";
  if (roles.some((r) => MOD_ROLE_RE.test(r.label))) return "moderation";
  return "none";
}
