import { getAddress, isAddress } from "viem";
import type { RoomRule } from "./push";

/** A single editable gate-rule row in the room builder. */
export type RuleType = "erc20" | "erc721" | "erc1155" | "safe" | "ens" | "bgov" | "role";
export interface RuleDraft { type: RuleType; tier: string; safe: string; token: string; min: string; specificId: boolean; tokenId: string; ens: string; role: string }
export const emptyRule = (): RuleDraft => ({ type: "erc20", tier: "69", safe: "", token: "", min: "1", specificId: false, tokenId: "", ens: "", role: "" });

/** Convert one draft row into a RoomRule, or null if it isn't valid yet. ERC-20 `min`
 *  is a human amount (the gate reads the token's decimals on-chain); ERC-721/1155 `min`
 *  is a token count. For ERC-1155, `tokenId` is set only when "specific ID" is checked —
 *  otherwise the rule omits it and admits holders of ANY token id. */
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
    if (!isAddress(d.token.trim())) return null;
    const token = getAddress(d.token.trim());
    if (d.type === "erc20") return { kind: "token", standard: "erc20", token, min: d.min.trim() || "0" };
    if (d.type === "erc1155") {
      const min = String(Math.max(1, Math.floor(Number(d.min) || 1)));
      // "specific ID" checked + an id entered → that id; otherwise omit tokenId = any id.
      return d.specificId && d.tokenId.trim()
        ? { kind: "token", standard: "erc1155", token, tokenId: d.tokenId.trim(), min }
        : { kind: "token", standard: "erc1155", token, min };
    }
    return { kind: "token", standard: "erc721", token, min: String(Math.max(1, Math.floor(Number(d.min) || 1))) };
  } catch {
    return null;
  }
}
