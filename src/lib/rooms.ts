import { useQuery } from "@tanstack/react-query";
import type { WalletClient } from "viem";
import type { PushRoom } from "./push";

/**
 * Community-room registry client. The deployed `/api/rooms` (Vercel KV) stores
 * each built-in room's chatId AND any admin-created custom rooms (each with its
 * own gate), so a room created in the Admin console goes live for everyone with
 * no redeploy. The runtime registry wins over build-time env vars; if the
 * registry isn't configured (e.g. local dev), env-var rooms still work.
 */

const ROOMS_URL = "/api/rooms";

export type RoomRegistry = Record<string, string>; // roomKey -> chatId
export interface RegistryData {
  chatIds: RoomRegistry;
  custom: PushRoom[];
}

export function useRoomRegistry() {
  return useQuery({
    queryKey: ["room-registry"],
    staleTime: 60_000,
    queryFn: async (): Promise<RegistryData> => {
      try {
        const r = await fetch(ROOMS_URL);
        if (!r.ok) return { chatIds: {}, custom: [] };
        const j = await r.json();
        return { chatIds: (j?.rooms ?? {}) as RoomRegistry, custom: (j?.custom ?? []) as PushRoom[] };
      } catch {
        return { chatIds: {}, custom: [] };
      }
    },
  });
}

async function postSigned(
  walletClient: WalletClient,
  account: `0x${string}`,
  message: string,
  payload: Record<string, unknown>
): Promise<void> {
  const timestamp = Date.now();
  const signature = await walletClient.signMessage({ account, message: `${message}\nat ${timestamp}` });
  const r = await fetch(ROOMS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, address: account, signature, timestamp }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error || `Registry write failed (HTTP ${r.status})`);
  }
}

/** Admin: save a built-in room's chatId to the registry, signed by a space admin. */
export async function saveRoomChatId(opts: {
  walletClient: WalletClient;
  account: `0x${string}`;
  roomKey: string;
  chatId: string;
}): Promise<void> {
  const { walletClient, account, roomKey, chatId } = opts;
  await postSigned(walletClient, account, `Bittrees rooms registry\nset ${roomKey} = ${chatId}`, { roomKey, chatId });
}

/** Admin: add (or replace) a custom room with its own gate. */
export async function saveCustomRoom(opts: {
  walletClient: WalletClient;
  account: `0x${string}`;
  room: PushRoom;
}): Promise<void> {
  const { walletClient, account, room } = opts;
  await postSigned(walletClient, account, `Bittrees rooms registry\ncustom ${room.key}`, { custom: room });
}

/** Admin: remove a custom room. */
export async function deleteCustomRoom(opts: {
  walletClient: WalletClient;
  account: `0x${string}`;
  key: string;
}): Promise<void> {
  const { walletClient, account, key } = opts;
  await postSigned(walletClient, account, `Bittrees rooms registry\ndelete-custom ${key}`, { deleteCustom: key });
}
