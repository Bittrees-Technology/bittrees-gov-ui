import { useEffect, useRef } from "react";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes, utf8ToBytes, hexToBytes, bytesToHex } from "@noble/hashes/utils.js";
import type { WalletClient } from "viem";
import {
  useDmPrefs, useDmSettings, useBlocked,
  getAllPrefs, replaceAllPrefs, getSettingsSnapshot, replaceSettings, getBlockedList, replaceBlocked,
  type DmPrefs, type DmSettings,
} from "./dmPrefs";
import { useSavedMessages, getNotes, replaceNotes, type SavedMessage } from "./savedMessages";

/**
 * Optional cross-device sync of Saved Messages + messenger preferences, keyed by the
 * connected wallet. The data is ENCRYPTED client-side (XChaCha20-Poly1305) with a key
 * derived from ONE wallet signature, then stored as ciphertext in the app's KV
 * (`/api/usersync`) — so the same wallet on any device re-derives the key and reads
 * its data, but the server only ever holds ciphertext. The same signature is cached
 * and reused as the write credential (the server checks it recovers to the address),
 * so there's no repeated signing. Opt-in, per-device; off by default.
 *
 * Merge is loss-averse: Saved-Messages notes and the block list are UNIONed; per-conv
 * prefs + global settings adopt the remote values (then the merged result is pushed).
 */

export const SYNC_MESSAGE =
  "Bittrees Messenger — sync key (v1)\n\nSign to sync and encrypt your saved messages and preferences across your devices. No gas; this only proves wallet ownership.";

const SYNC_URL = "/api/usersync";
const sigKey = (a: string) => `bittrees.sync.sig.${a.toLowerCase()}`;

interface SyncBlob { savedMessages: SavedMessage[]; prefs: DmPrefs; settings: DmSettings; blocked: string[] }

export function getCachedSig(addr?: string): string | null {
  if (!addr) return null;
  try { return localStorage.getItem(sigKey(addr)); } catch { return null; }
}
export function isSyncEnabled(addr?: string): boolean {
  return !!getCachedSig(addr);
}
export function disableSync(addr: string) {
  try { localStorage.removeItem(sigKey(addr)); } catch { /* ignore */ }
}

/** Sign once (cached) to turn sync on for this device, then pull + merge + push. */
export async function enableSync(walletClient: WalletClient, addr: `0x${string}`): Promise<void> {
  const signature = await walletClient.signMessage({ account: addr, message: SYNC_MESSAGE });
  try { localStorage.setItem(sigKey(addr), signature); } catch { /* ignore (quota) */ }
  if (await pullAndMerge(addr)) { /* merged remote */ }
  await pushNow(addr); // publish initial/merged state
}

function keyFromSig(sig: string): Uint8Array {
  return sha256(utf8ToBytes(sig)); // 32-byte symmetric key, deterministic per wallet
}
function encryptBlob(key: Uint8Array, obj: unknown): string {
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(utf8ToBytes(JSON.stringify(obj)));
  return `${bytesToHex(nonce)}:${bytesToHex(ct)}`;
}
function decryptBlob(key: Uint8Array, blob: string): unknown {
  const [n, c] = blob.split(":");
  const pt = xchacha20poly1305(key, hexToBytes(n)).decrypt(hexToBytes(c));
  return JSON.parse(new TextDecoder().decode(pt));
}

/** Fetch + decrypt the remote blob and merge it into the local stores. */
export async function pullAndMerge(addr: string): Promise<boolean> {
  const sig = getCachedSig(addr);
  if (!sig) return false;
  let blob: string | null = null;
  try {
    const r = await fetch(`${SYNC_URL}?address=${addr}`);
    if (!r.ok) return false;
    blob = (await r.json())?.blob ?? null;
  } catch { return false; }
  if (!blob) return false;
  let remote: SyncBlob;
  try { remote = decryptBlob(keyFromSig(sig), blob) as SyncBlob; } catch { return false; }

  // Notes: union by id (never lose a note), oldest→newest.
  const byId = new Map<string, SavedMessage>();
  [...(remote.savedMessages ?? []), ...getNotes(addr)].forEach((m) => { if (m?.id) byId.set(m.id, m); });
  replaceNotes(addr, [...byId.values()].sort((a, b) => a.sentAtMs - b.sentAtMs));
  // Blocked: union.
  replaceBlocked([...new Set([...(remote.blocked ?? []), ...getBlockedList()].map((x) => String(x).toLowerCase()))]);
  // Prefs + settings: adopt remote (keep local-only conv keys).
  if (remote.prefs) replaceAllPrefs({ ...getAllPrefs(), ...remote.prefs });
  if (remote.settings) replaceSettings(remote.settings);
  return true;
}

/** Encrypt the current local state and push it (signed) to the remote store. */
export async function pushNow(addr: string): Promise<void> {
  const sig = getCachedSig(addr);
  if (!sig) return;
  const blobObj: SyncBlob = { savedMessages: getNotes(addr), prefs: getAllPrefs(), settings: getSettingsSnapshot(), blocked: getBlockedList() };
  const blob = encryptBlob(keyFromSig(sig), blobObj);
  try {
    await fetch(SYNC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: addr, signature: sig, blob, updatedAt: Date.now() }),
    });
  } catch { /* best-effort */ }
}

/**
 * Drive sync for the connected wallet: pull+merge once when enabled, then push
 * (debounced) whenever Saved Messages or preferences change. No-op when sync is off.
 */
export function useUserSync(addr?: string) {
  const prefs = useDmPrefs();
  const settings = useDmSettings();
  const blocked = useBlocked();
  const saved = useSavedMessages(addr);
  const enabled = isSyncEnabled(addr);
  const pulled = useRef<string>("");

  useEffect(() => {
    if (!addr || !enabled || pulled.current === addr) return;
    pulled.current = addr;
    pullAndMerge(addr).then((ok) => { if (ok) void pushNow(addr); }).catch(() => {});
  }, [addr, enabled]);

  useEffect(() => {
    if (!addr || !enabled || pulled.current !== addr) return;
    const t = setTimeout(() => { void pushNow(addr); }, 1500);
    return () => clearTimeout(t);
  }, [addr, enabled, prefs, settings, blocked, saved]);
}
