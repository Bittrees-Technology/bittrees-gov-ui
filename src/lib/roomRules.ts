import { getAddress, parseUnits, isAddress } from "viem";
import type { RoomRule } from "./push";

/** A single editable gate-rule row in the room builder. */
export type RuleType = "erc20" | "erc721" | "safe" | "ens" | "bgov" | "role";
export interface RuleDraft { type: RuleType; tier: string; safe: string; token: string; min: string; decimals: string; ens: string; role: string }
export const emptyRule = (): RuleDraft => ({ type: "erc20", tier: "69", safe: "", token: "", min: "1", decimals: "18", ens: "", role: "" });

/** Convert one draft row into a RoomRule, or null if it isn't valid yet. */
export function toRule(d: RuleDraft): RoomRule | null {
  try {
    if (d.type === "role") return d.role.trim() ? { kind: "role", role: d.role.trim() } : null;
    if (d.type === "bgov") return { kind: "bgov", tier: Math.max(0, Number(d.tier) || 0) };
    if (d.type === "safe") return isAddress(d.safe.trim()) ? { kind: "safe", safe: getAddress(d.safe.trim()) } : null;
    if (d.type === "ens") {
      const n = d.ens.trim().toLowerCase();
      if (!n) return { kind: "ens" }; // blank = any ENS name
      return /\./.test(n) ? { kind: "ens", name: n } : null;
    }
    if (d.type === "erc20") return isAddress(d.token.trim()) ? { kind: "token", standard: "erc20", token: getAddress(d.token.trim()), min: parseUnits(d.min.trim() || "0", Number(d.decimals) || 18).toString() } : null;
    return isAddress(d.token.trim()) ? { kind: "token", standard: "erc721", token: getAddress(d.token.trim()), min: String(Math.max(1, Math.floor(Number(d.min) || 1))) } : null;
  } catch {
    return null;
  }
}
