import { useSyncExternalStore } from "react";

/**
 * Personal chat contacts — saved per-browser in localStorage AND scoped to the
 * connected wallet (the `owner`), so each user has their own contact list rather
 * than sharing one across every address on the device. (The role/badge search is
 * global by design — that's derived from the on-chain role registry, not this.)
 *
 * A tiny external store so the UI re-renders on changes; one localStorage key per
 * owner: `bittrees.contacts.<ownerLower>`.
 */
export interface Contact { address: string; label?: string }

const listeners = new Set<() => void>();
const caches = new Map<string, Contact[]>(); // ownerLower → contacts (stable refs)
const EMPTY: Contact[] = [];

const keyFor = (owner: string) => `bittrees.contacts.${owner.toLowerCase()}`;

function load(owner: string): Contact[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(owner)) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** The owner's contacts, cached so useSyncExternalStore gets a stable reference. */
function getCache(owner: string): Contact[] {
  const k = owner.toLowerCase();
  let c = caches.get(k);
  if (!c) {
    c = load(owner);
    caches.set(k, c);
  }
  return c;
}

function persist(owner: string, next: Contact[]) {
  caches.set(owner.toLowerCase(), next);
  try { localStorage.setItem(keyFor(owner), JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** Contacts for the connected wallet (`owner`). Empty when no wallet is connected. */
export function useContacts(owner: string | undefined): Contact[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => (owner ? getCache(owner) : EMPTY),
    () => EMPTY
  );
}

export function isContact(owner: string | undefined, address: string): boolean {
  if (!owner) return false;
  const a = address.toLowerCase();
  return getCache(owner).some((c) => c.address.toLowerCase() === a);
}

export function addContact(owner: string | undefined, address: string, label?: string) {
  if (!owner) return;
  const a = address.toLowerCase();
  persist(owner, [...getCache(owner).filter((c) => c.address.toLowerCase() !== a), { address, label }]);
}

export function removeContact(owner: string | undefined, address: string) {
  if (!owner) return;
  const a = address.toLowerCase();
  persist(owner, getCache(owner).filter((c) => c.address.toLowerCase() !== a));
}
