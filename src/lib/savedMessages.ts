import { useSyncExternalStore } from "react";

/**
 * "Saved Messages" — a personal notes-to-self space, like Telegram's. Stored
 * per-device in localStorage and scoped to the connected wallet (the `owner`), so
 * each address keeps its own notes. This is intentionally LOCAL — XMTP can't DM your
 * own inbox, and notes-to-self are private and instant — so it doesn't sync across
 * devices. Mirrors the tiny external-store shape used by contacts.ts / dmPrefs.ts.
 */
export interface SavedMessage {
  id: string;
  text: string;
  sentAtMs: number;
}

const listeners = new Set<() => void>();
const caches = new Map<string, SavedMessage[]>(); // ownerLower → notes (stable refs)
const EMPTY: SavedMessage[] = [];

const keyFor = (owner: string) => `bittrees.dm.saved.${owner.toLowerCase()}`;

function load(owner: string): SavedMessage[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(owner)) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function getCache(owner: string): SavedMessage[] {
  const k = owner.toLowerCase();
  let c = caches.get(k);
  if (!c) {
    c = load(owner);
    caches.set(k, c);
  }
  return c;
}

function persist(owner: string, next: SavedMessage[]) {
  caches.set(owner.toLowerCase(), next);
  try { localStorage.setItem(keyFor(owner), JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** The connected wallet's saved notes (oldest→newest). Empty when no wallet. */
export function useSavedMessages(owner: string | undefined): SavedMessage[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => (owner ? getCache(owner) : EMPTY),
    () => EMPTY
  );
}

export function addSavedMessage(owner: string | undefined, text: string) {
  if (!owner) return;
  const t = text.trim();
  if (!t) return;
  const note: SavedMessage = { id: `saved-${Date.now()}-${Math.round(performance.now())}`, text: t, sentAtMs: Date.now() };
  persist(owner, [...getCache(owner), note]);
}

export function deleteSavedMessage(owner: string | undefined, id: string) {
  if (!owner) return;
  persist(owner, getCache(owner).filter((m) => m.id !== id));
}

/** Bulk read/replace for cross-device sync ([[userSync]]). Non-hook. */
export function getNotes(owner: string | undefined): SavedMessage[] {
  return owner ? getCache(owner) : [];
}
export function replaceNotes(owner: string | undefined, notes: SavedMessage[]) {
  if (owner) persist(owner, notes);
}
