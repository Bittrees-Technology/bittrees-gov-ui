import { useSyncExternalStore } from "react";

/**
 * Personal chat contacts — saved per-browser in localStorage (no backend; they're
 * private to this device). A tiny external store so the UI re-renders on changes.
 */
export interface Contact { address: string; label?: string }

const KEY = "bittrees.contacts";
const listeners = new Set<() => void>();

function load(): Contact[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

let cache: Contact[] = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useContacts(): Contact[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => cache,
    () => cache
  );
}

export function isContact(address: string): boolean {
  const a = address.toLowerCase();
  return cache.some((c) => c.address.toLowerCase() === a);
}

export function addContact(address: string, label?: string) {
  const a = address.toLowerCase();
  cache = [...cache.filter((c) => c.address.toLowerCase() !== a), { address, label }];
  persist();
}

export function removeContact(address: string) {
  const a = address.toLowerCase();
  cache = cache.filter((c) => c.address.toLowerCase() !== a);
  persist();
}
