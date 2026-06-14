import type { Address, WalletClient } from "viem";
import { ENTITIES } from "./entities";

/**
 * Push Chat — tiered, token-gated community group chats (the Telegram
 * replacement). Self-serve: a qualifying holder calls `group.join()` from their
 * own wallet and Push enforces the gate by GETting our stateless endpoint
 * (`/api/gate/...` → 200/403). The SDK is loaded lazily (dynamic import) so its
 * Node-polyfilled bundle never weighs on other pages.
 *
 * Two kinds of room:
 *  - BGOV-tier rooms — gated by a holder's BGOV voting power (≥1/69/210/420).
 *  - ENS-subname rooms — one per bittrees.eth subname that maps to a Safe, gated
 *    to that Safe's signers (owners) + proposers (delegates).
 *
 * One-time org setup (then fill the VITE_PUSH_ROOM_* envs with each chatId):
 *   deploy /api/gate → an admin runs createGatedGroup() per room (see /admin).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type PushClient = any;

/** A single access rule. */
export type RoomRule =
  | { kind: "bgov"; tier: number } // minimum BGOV voting power
  | { kind: "safe"; safe: Address; ens?: string } // Safe signers + proposers
  | { kind: "token"; standard: "erc20" | "erc721"; token: Address; min: string } // min balance / NFT count
  | { kind: "ens"; name?: string } // a specific ENS name's address, or (no name) any ENS name
  | { kind: "role"; role: string }; // holders of an admin-assigned role

/** How a room decides who may join — one rule, or several combined (any/all). */
export type RoomGate = RoomRule | { kind: "multi"; combine: "any" | "all"; rules: RoomRule[] };

export interface PushRoom {
  key: string;
  name: string;
  blurb: string;
  gate: RoomGate;
  /** The VITE_PUSH_ROOM_* env var holding this room's chatId (built-in rooms only). */
  envKey?: string;
  chatId?: string; // set once the group exists (registry, or env fallback)
}

/** A one-line description of a single rule. */
export function ruleLabel(rule: RoomRule): string {
  if (rule.kind === "bgov") return `≥${rule.tier} BGOV`;
  if (rule.kind === "safe") return `${rule.ens || "Safe"} signers & proposers`;
  if (rule.kind === "ens") return rule.name ? rule.name : "any ENS name";
  if (rule.kind === "role") return `${rule.role} role`;
  return rule.standard === "erc721" ? `≥${rule.min} NFT of ${rule.token.slice(0, 6)}…` : `holds ${rule.token.slice(0, 6)}…`;
}

/** A one-line description of a gate (single rule or a combination). */
export function gateLabel(gate: RoomGate): string {
  if (gate.kind === "multi") {
    const sep = gate.combine === "all" ? " + " : " / ";
    return gate.rules.map(ruleLabel).join(sep) || "custom";
  }
  return ruleLabel(gate);
}

/** URL-safe base64 of a gate object (rules travel in the gate URL, no DB needed). */
function encodeGate(gate: object): string {
  return btoa(JSON.stringify(gate)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * BGOV-tier rooms. Shareholders is automatic (anyone holding ≥1 BGOV). The upper
 * three are gated SOLELY by the manually-assigned role (Associate / Junior Partner
 * / Partner) — BGOV holdings do NOT grant access; an admin assigns the role per user.
 */
export const BGOV_ROOMS: PushRoom[] = [
  { key: "shareholders", name: "Shareholders", blurb: "≥1 BGOV", gate: { kind: "bgov", tier: 1 }, envKey: "VITE_PUSH_ROOM_SHAREHOLDERS", chatId: import.meta.env.VITE_PUSH_ROOM_SHAREHOLDERS as string | undefined },
  { key: "associates", name: "Associates", blurb: "Associate role", gate: { kind: "role", role: "Associate" }, envKey: "VITE_PUSH_ROOM_ASSOCIATES", chatId: import.meta.env.VITE_PUSH_ROOM_ASSOCIATES as string | undefined },
  { key: "junior-partners", name: "Junior Partners", blurb: "Junior Partner role", gate: { kind: "role", role: "Junior Partner" }, envKey: "VITE_PUSH_ROOM_JUNIOR", chatId: import.meta.env.VITE_PUSH_ROOM_JUNIOR as string | undefined },
  { key: "partners", name: "Partners", blurb: "Partner role", gate: { kind: "role", role: "Partner" }, envKey: "VITE_PUSH_ROOM_PARTNERS", chatId: import.meta.env.VITE_PUSH_ROOM_PARTNERS as string | undefined },
];

// chatId + env-var name for each Safe-gated subname room. Literal env reads (Vite
// only inlines static import.meta.env.X — never a computed key), keyed by subname.
const SAFE_ROOM_ENV: Record<string, { key: string; chatId: string | undefined }> = {
  "gov.bittrees.eth": { key: "VITE_PUSH_ROOM_SAFE_GOV", chatId: import.meta.env.VITE_PUSH_ROOM_SAFE_GOV as string | undefined },
  "capital.bittrees.eth": { key: "VITE_PUSH_ROOM_SAFE_CAPITAL", chatId: import.meta.env.VITE_PUSH_ROOM_SAFE_CAPITAL as string | undefined },
  "research.bittrees.eth": { key: "VITE_PUSH_ROOM_SAFE_RESEARCH", chatId: import.meta.env.VITE_PUSH_ROOM_SAFE_RESEARCH as string | undefined },
  "business.gov.bittrees.eth": { key: "VITE_PUSH_ROOM_SAFE_BUSINESS", chatId: import.meta.env.VITE_PUSH_ROOM_SAFE_BUSINESS as string | undefined },
  "technology.gov.bittrees.eth": { key: "VITE_PUSH_ROOM_SAFE_TECHNOLOGY", chatId: import.meta.env.VITE_PUSH_ROOM_SAFE_TECHNOLOGY as string | undefined },
  "community.gov.bittrees.eth": { key: "VITE_PUSH_ROOM_SAFE_COMMUNITY", chatId: import.meta.env.VITE_PUSH_ROOM_SAFE_COMMUNITY as string | undefined },
};

/** ENS-subname rooms — one per bittrees.eth subname that maps to a Safe. */
export const SAFE_ROOMS: PushRoom[] = ENTITIES.filter((e) => !!e.ens).map((e) => {
  const env = SAFE_ROOM_ENV[e.ens!] ?? { key: "VITE_PUSH_ROOM_SAFE_UNKNOWN", chatId: undefined };
  return {
    key: `safe-${e.ens}`,
    name: e.label,
    blurb: `${e.ens} — signers & proposers`,
    gate: { kind: "safe", safe: e.address, ens: e.ens! } as RoomGate,
    envKey: env.key,
    chatId: env.chatId,
  };
});

export const GATE_BASE_URL = (import.meta.env.VITE_GATE_URL as string) || "https://gov.bittrees.org/api/gate";

/**
 * The CustomEndpoint URL Push GETs to enforce a room's gate. Push REQUIRES the
 * literal `{{user_address}}` template in the URL — it substitutes the requester's
 * address there before calling. The gate handler reads that address segment and
 * the trailing `/checkAccess` matches its documented path contract.
 */
const USER = "{{user_address}}";
export function gateUrl(room: PushRoom): string {
  const g = room.gate;
  // Multiple rules (or a single ENS rule) ride along in the URL, base64-encoded.
  if (g.kind === "multi") return `${GATE_BASE_URL}/multi/${encodeGate(g)}/${USER}/checkAccess`;
  // ENS + role need the registry/resolver, so they ride in the base64 multi gate.
  if (g.kind === "ens" || g.kind === "role") return `${GATE_BASE_URL}/multi/${encodeGate({ kind: "multi", combine: "any", rules: [g] })}/${USER}/checkAccess`;
  if (g.kind === "safe") return `${GATE_BASE_URL}/safe/${g.safe}/${USER}/checkAccess`;
  if (g.kind === "token") return `${GATE_BASE_URL}/token/${g.standard}/${g.token}/${g.min}/${USER}/checkAccess`;
  return `${GATE_BASE_URL}/${g.tier}/${USER}/checkAccess`;
}

async function sdk() {
  return import("@pushprotocol/restapi");
}

// Cache the decrypted PGP key (per address) so re-initializing Push doesn't ask
// for a signature again on reload. It lives in localStorage (origin-scoped) — the
// standard "sign once per browser" Push convenience.
const pushKey = (account: string) => `bittrees.push.pgp.${account.toLowerCase()}`;
export function hasPushKey(account: string): boolean {
  try { return !!localStorage.getItem(pushKey(account)); } catch { return false; }
}
function loadPushKey(account: string): string | null {
  try { return localStorage.getItem(pushKey(account)); } catch { return null; }
}
function savePushKey(account: string, key: string) {
  try { localStorage.setItem(pushKey(account), key); } catch { /* ignore */ }
}
function clearPushKey(account: string) {
  try { localStorage.removeItem(pushKey(account)); } catch { /* ignore */ }
}

/**
 * Initialize a Push client from the connected wallet. Signs once, then caches the
 * decrypted key so later inits (reloads) reuse it with no signature; a stale
 * cached key falls back to a fresh signed init.
 */
export async function initPush(walletClient: WalletClient, account: string): Promise<PushClient> {
  const { PushAPI, CONSTANTS } = await sdk();
  const cached = loadPushKey(account);
  try {
    const user = await PushAPI.initialize(walletClient as any, {
      env: CONSTANTS.ENV.PROD,
      ...(cached ? { decryptedPGPPrivateKey: cached } : {}),
    });
    const key = (user as any)?.decryptedPgpPvtKey;
    if (key) savePushKey(account, key);
    return user;
  } catch (e) {
    if (cached) {
      clearPushKey(account); // stale/invalid → retry with a fresh signature
      const user = await PushAPI.initialize(walletClient as any, { env: CONSTANTS.ENV.PROD });
      const key = (user as any)?.decryptedPgpPvtKey;
      if (key) savePushKey(account, key);
      return user;
    }
    throw e;
  }
}

export interface PushMessage { id: string; from: string; text: string; mine: boolean }

function normalize(raw: any[], myAddr: string): PushMessage[] {
  const me = myAddr.toLowerCase();
  return (raw || []).map((m, i) => {
    const from = String(m?.fromDID || m?.fromCAIP10 || "").split(":").pop()?.toLowerCase() || "";
    const text = typeof m?.messageContent === "string" ? m.messageContent : (m?.messageObj?.content ?? "(unsupported)");
    return { id: m?.cid || String(m?.timestamp ?? i), from, text: String(text), mine: from === me };
  });
}

export async function joinRoom(push: PushClient, chatId: string) {
  return push.chat.group.join(chatId);
}

export async function roomHistory(push: PushClient, chatId: string, myAddr: string): Promise<PushMessage[]> {
  const raw = await push.chat.history(chatId, { limit: 40 });
  return normalize(raw, myAddr).reverse(); // history is newest-first → oldest→newest
}

export async function sendRoom(push: PushClient, chatId: string, content: string) {
  return push.chat.send(chatId, { content, type: "Text" });
}

/**
 * Addresses auto-granted ADMIN on every community room at creation, so they can
 * manage members + roles regardless of who clicked "Create" (gov space admins).
 */
export const ROOM_ADMINS: string[] = [
  "0xE5350D96FC3161BF5c385843ec5ee24E8B465B2f",
];

// Push's API validates that groupImage is a NON-EMPTY string (a data URI) — it
// rejects null/empty. We don't surface group avatars in-app, so a minimal valid
// 1×1 PNG satisfies the requirement.
const GROUP_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** Admin one-time: create a tiered/Safe-gated group; returns its chatId to configure. */
export async function createGatedGroup(push: PushClient, room: PushRoom, creator?: string): Promise<string> {
  const gate = {
    type: "PUSH",
    category: "CustomEndpoint",
    subcategory: "GET",
    data: { url: gateUrl(room) },
  };
  // The creator is the group owner/admin automatically; add the standing room
  // admins too (minus the creator — Push rejects adding yourself).
  const admins = ROOM_ADMINS.filter((a) => a.toLowerCase() !== (creator ?? "").toLowerCase());
  const g = await push.chat.group.create(`Bittrees ${room.name}`, {
    description: room.blurb,
    image: GROUP_IMAGE,
    members: [],
    admins,
    private: true,
    rules: { entry: { conditions: [gate] } },
  });
  return g?.chatId || g?.groupId || "";
}

// ── Roles / membership (chat) ─────────────────────────────────────────────
export type RoomRole = "ADMIN" | "MEMBER";

export interface RoomMember { wallet: string; role: RoomRole }

/** Members of a room with their role (best-effort; shape varies by SDK version). */
export async function roomMembers(push: PushClient, chatId: string): Promise<RoomMember[]> {
  try {
    const info = await push.chat.group.info(chatId);
    const list: any[] = info?.members ?? info?.groupMembers ?? [];
    return list.map((m) => {
      const wallet = String(m?.wallet || m?.address || "").split(":").pop()?.toLowerCase() || "";
      return { wallet, role: (m?.isAdmin || m?.role === "ADMIN" ? "ADMIN" : "MEMBER") as RoomRole };
    }).filter((m) => m.wallet);
  } catch {
    return [];
  }
}

/** Assign a role (add/promote) to wallets in a room — room admins only (Push enforces). */
export async function setRoomRole(push: PushClient, chatId: string, wallets: string[], role: RoomRole) {
  return push.chat.group.add(chatId, { role, accounts: wallets });
}

/** Remove wallets (or demote a role) from a room — room admins only. */
export async function removeFromRoom(push: PushClient, chatId: string, wallets: string[], role: RoomRole = "MEMBER") {
  return push.chat.group.remove(chatId, { role, accounts: wallets });
}
