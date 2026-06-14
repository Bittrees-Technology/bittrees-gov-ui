import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { initPush, hasPushKey, type PushClient } from "./push";

/**
 * Push client lifecycle, kept in module scope so it survives tab switches and
 * route changes within a session (no re-signing). Reloads restore from the cached
 * decrypted key (see initPush) — also signature-free. Mirrors useXmtp.
 */

let sharedPush: { address: string; client: PushClient } | null = null;

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Something went wrong";
}

export type PushStatus = "idle" | "enabling" | "ready" | "error";

export function usePush() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const clientRef = useRef<PushClient | null>(sharedPush && sharedPush.address === address ? sharedPush.client : null);
  const [status, setStatus] = useState<PushStatus>(sharedPush && sharedPush.address === address ? "ready" : "idle");
  const [error, setError] = useState<string>();

  // Reuse the in-session client, or (after a reload) silently restore from the
  // cached key — both without a signature. Only for a wallet that previously
  // enabled rooms, so Push stays lazy otherwise.
  const restoredRef = useRef<string>("");
  useEffect(() => {
    if (!address) return;
    if (sharedPush && sharedPush.address === address) {
      clientRef.current = sharedPush.client;
      setStatus("ready");
      return;
    }
    if (!walletClient || restoredRef.current === address || !hasPushKey(address)) return;
    restoredRef.current = address;
    let alive = true;
    setStatus("enabling");
    initPush(walletClient, address)
      .then((client) => {
        if (!alive) return;
        sharedPush = { address, client };
        clientRef.current = client;
        setStatus("ready");
      })
      .catch(() => { if (alive) setStatus("idle"); }); // couldn't restore → manual enable
    return () => { alive = false; };
  }, [address, walletClient]);

  const enable = useCallback(async () => {
    if (!walletClient || !address) return;
    if (sharedPush && sharedPush.address === address) {
      clientRef.current = sharedPush.client;
      setStatus("ready");
      return;
    }
    setStatus("enabling");
    setError(undefined);
    try {
      const client = await initPush(walletClient, address);
      sharedPush = { address, client };
      clientRef.current = client;
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }, [walletClient, address]);

  return { status, error, enable, client: clientRef.current };
}
