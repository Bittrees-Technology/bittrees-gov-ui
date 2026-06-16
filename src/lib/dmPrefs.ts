import { useSyncExternalStore } from "react";

/**
 * Per-device organization for direct-message conversations — pin, archive, manual
 * order, and last-read tracking — plus a personal block list. All of it lives in
 * localStorage (private to this browser; XMTP itself stores nothing of this). Two
 * tiny external stores so the UI re-renders on change, mirroring contacts.ts.
 *
 * Conversation prefs are keyed by the XMTP conversation id. The block list is keyed
 * by lowercased wallet address (a peer can be blocked before any DM exists).
 */

export interface DmPref {
  pinned?: boolean;
  archived?: boolean;
  order?: number; // position among pinned (lower = higher); undefined → end
  lastReadAt?: number; // ms; messages newer than this (and not mine) are unread
  readReceipts?: boolean; // per-conversation override of the global default; undefined → use global
}
export type DmPrefs = Record<string, DmPref>;

/* ── conversation prefs ─────────────────────────────────────────────────── */
const PREFS_KEY = "bittrees.dm.prefs";
const prefsListeners = new Set<() => void>();

function loadPrefs(): DmPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return v && typeof v === "object" ? (v as DmPrefs) : {};
  } catch {
    return {};
  }
}

let prefsCache: DmPrefs = loadPrefs();

function persistPrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefsCache)); } catch { /* ignore */ }
  prefsListeners.forEach((l) => l());
}

export function useDmPrefs(): DmPrefs {
  return useSyncExternalStore(
    (cb) => { prefsListeners.add(cb); return () => { prefsListeners.delete(cb); }; },
    () => prefsCache,
    () => prefsCache
  );
}

function patch(id: string, p: Partial<DmPref>) {
  prefsCache = { ...prefsCache, [id]: { ...prefsCache[id], ...p } };
  persistPrefs();
}

export function togglePin(id: string) {
  const cur = prefsCache[id];
  if (cur?.pinned) {
    patch(id, { pinned: false, order: undefined });
  } else {
    // new pins go to the end of the pinned list
    const maxOrder = Math.max(0, ...Object.values(prefsCache).map((p) => p.order ?? 0));
    patch(id, { pinned: true, order: maxOrder + 1, archived: false });
  }
}

export function setArchived(id: string, archived: boolean) {
  patch(id, archived ? { archived: true, pinned: false, order: undefined } : { archived: false });
}

export function markRead(id: string, ts: number) {
  if ((prefsCache[id]?.lastReadAt ?? 0) >= ts) return; // no-op if already current
  patch(id, { lastReadAt: ts });
}

/** Rewrite the pinned order from a fully-ordered list of conversation ids. */
export function setPinnedOrder(orderedIds: string[]) {
  const next = { ...prefsCache };
  orderedIds.forEach((id, i) => { next[id] = { ...next[id], pinned: true, order: i + 1 }; });
  prefsCache = next;
  persistPrefs();
}

/* ── block list ─────────────────────────────────────────────────────────── */
const BLOCK_KEY = "bittrees.dm.blocked";
const blockListeners = new Set<() => void>();

function loadBlocked(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(BLOCK_KEY) || "[]");
    return Array.isArray(v) ? v.map((a) => String(a).toLowerCase()) : [];
  } catch {
    return [];
  }
}

let blockCache: string[] = loadBlocked();

function persistBlocked() {
  try { localStorage.setItem(BLOCK_KEY, JSON.stringify(blockCache)); } catch { /* ignore */ }
  blockListeners.forEach((l) => l());
}

export function useBlocked(): string[] {
  return useSyncExternalStore(
    (cb) => { blockListeners.add(cb); return () => { blockListeners.delete(cb); }; },
    () => blockCache,
    () => blockCache
  );
}

export function isBlocked(address?: string): boolean {
  if (!address) return false;
  return blockCache.includes(address.toLowerCase());
}

export function blockAddr(address: string) {
  const a = address.toLowerCase();
  if (!blockCache.includes(a)) { blockCache = [...blockCache, a]; persistBlocked(); }
}

export function unblockAddr(address: string) {
  const a = address.toLowerCase();
  blockCache = blockCache.filter((x) => x !== a);
  persistBlocked();
}

/* ── global DM settings ─────────────────────────────────────────────────── */
export interface DmSettings {
  readReceipts: boolean; // send read receipts to peers (and thus see theirs)
}
const SETTINGS_KEY = "bittrees.dm.settings";
const settingsListeners = new Set<() => void>();

function loadSettings(): DmSettings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { readReceipts: v?.readReceipts !== false }; // default ON
  } catch {
    return { readReceipts: true };
  }
}

let settingsCache: DmSettings = loadSettings();

function persistSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache)); } catch { /* ignore */ }
  settingsListeners.forEach((l) => l());
}

export function useDmSettings(): DmSettings {
  return useSyncExternalStore(
    (cb) => { settingsListeners.add(cb); return () => { settingsListeners.delete(cb); }; },
    () => settingsCache,
    () => settingsCache
  );
}

export function setReadReceipts(on: boolean) {
  settingsCache = { ...settingsCache, readReceipts: on };
  persistSettings();
}

/** Non-hook read for the XMTP layer (decides whether to emit read receipts). */
export function readReceiptsEnabled(): boolean {
  return settingsCache.readReceipts;
}

/** Per-conversation read-receipt override. Pass undefined to fall back to the global default. */
export function setConvReceipts(id: string, value: boolean | undefined) {
  patch(id, { readReceipts: value });
}

/** Effective read-receipt setting for one conversation: its override, else the global default. */
export function receiptsEnabledForConv(id: string): boolean {
  const override = prefsCache[id]?.readReceipts;
  return override === undefined ? settingsCache.readReceipts : override;
}

/* ── bulk accessors for cross-device sync ([[userSync]]) ── non-hook reads/writes
   that update the caches + persist + notify, so the UI reflects a pulled remote. */
export function getAllPrefs(): DmPrefs { return prefsCache; }
export function replaceAllPrefs(p: DmPrefs) { prefsCache = p; persistPrefs(); }
export function getSettingsSnapshot(): DmSettings { return settingsCache; }
export function replaceSettings(s: DmSettings) { settingsCache = { ...settingsCache, ...s }; persistSettings(); }
export function getBlockedList(): string[] { return blockCache; }
export function replaceBlocked(list: string[]) { blockCache = [...new Set(list.map((x) => x.toLowerCase()))]; persistBlocked(); }
