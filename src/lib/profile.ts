import { useSyncExternalStore } from "react";

/**
 * A personal profile picture for the messenger, stored per-device and scoped to the
 * connected wallet. XMTP has no profile layer, so this is a LOCAL override (a data
 * URL or image URL); the wallet-native, cross-app picture is your ENS avatar, which
 * the UI prefers to show when no local override is set.
 */
const listeners = new Set<() => void>();
const cache = new Map<string, string | null>();
const keyFor = (owner: string) => `bittrees.dm.avatar.${owner.toLowerCase()}`;

function get(owner: string): string | null {
  const k = owner.toLowerCase();
  if (!cache.has(k)) {
    try { cache.set(k, localStorage.getItem(keyFor(owner)) || null); } catch { cache.set(k, null); }
  }
  return cache.get(k) ?? null;
}

function persist(owner: string, value: string | null) {
  cache.set(owner.toLowerCase(), value);
  try {
    if (value) localStorage.setItem(keyFor(owner), value);
    else localStorage.removeItem(keyFor(owner));
  } catch { /* ignore (quota) */ }
  listeners.forEach((l) => l());
}

export function useProfileAvatar(owner: string | undefined): string | null {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => (owner ? get(owner) : null),
    () => null
  );
}

export function setProfileAvatar(owner: string | undefined, url: string) {
  if (owner) persist(owner, url);
}

export function clearProfileAvatar(owner: string | undefined) {
  if (owner) persist(owner, null);
}
