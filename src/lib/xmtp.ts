import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toBytes, getAddress } from "viem";
import type { Client, Conversation, DecodedMessage } from "@xmtp/browser-sdk";

/**
 * Wallet-native messaging on XMTP V3 (MLS). The SDK is loaded LAZILY via dynamic
 * import the first time the user enables messaging, so its WASM bundle never
 * weighs on the rest of the app. There is no maintained XMTP React SDK, so this
 * hook owns the client lifecycle, the conversation list, and the message stream.
 *
 * Note: the local message store is unencrypted at rest in the browser, and OPFS
 * allows only ONE tab per origin — opening the app in a second tab can lock the
 * store. We surface both honestly. End-to-end messaging requires a connected
 * wallet on the XMTP network, so it's exercised with a real wallet, not the
 * local preview.
 */

export type XmtpStatus = "idle" | "enabling" | "ready" | "error";

export interface ConvSummary {
  id: string;
  kind: "dm" | "group";
  title: string;
}

export interface ChatMessage {
  id: string;
  senderInboxId: string;
  text: string;
  mine: boolean;
}

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  const msg = a?.shortMessage || a?.message || "Something went wrong";
  if (/lock|already.*open|opfs|another connection/i.test(msg)) {
    return "Messaging is already open in another tab. Close other tabs of this site and try again.";
  }
  return msg;
}

function textOf(content: unknown): string {
  return typeof content === "string" ? content : "(unsupported message type)";
}

async function summarize(c: Conversation): Promise<ConvSummary> {
  // Group conversations expose a name; DMs don't. Best-effort, guarded.
  const anyC = c as unknown as { id: string; name?: string };
  let title = "Direct message";
  let kind: "dm" | "group" = "dm";
  try {
    const name = anyC.name;
    if (typeof name === "string" && name.length > 0) {
      title = name;
      kind = "group";
    }
  } catch {
    /* default to DM */
  }
  return { id: anyC.id, kind, title };
}

// One client per address, kept in module scope so it survives tab switches and
// route changes within a session (no re-signing). Reloads restore from the local
// OPFS database via Client.build — also signature-free.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharedXmtp: { address: string; client: any } | null = null;

const readyKey = (addr: string) => `bittrees.xmtp.ready.${addr.toLowerCase()}`;
function markEnabled(addr: string) { try { localStorage.setItem(readyKey(addr), "1"); } catch { /* ignore */ } }
function wasEnabled(addr: string): boolean { try { return localStorage.getItem(readyKey(addr)) === "1"; } catch { return false; } }

export function useXmtp() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const clientRef = useRef<Client | null>(null);
  const convRef = useRef<Map<string, Conversation>>(new Map());
  const streamRef = useRef<{ return?: () => void } | null>(null);
  const myInboxRef = useRef<string>("");
  const activeRef = useRef<string>("");

  const [status, setStatus] = useState<XmtpStatus>("idle");
  const [error, setError] = useState<string>();
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const toChatMessage = useCallback((m: DecodedMessage): ChatMessage => {
    const anyM = m as unknown as { id: string; senderInboxId: string; content: unknown };
    return {
      id: anyM.id,
      senderInboxId: anyM.senderInboxId,
      text: textOf(anyM.content),
      mine: anyM.senderInboxId === myInboxRef.current,
    };
  }, []);

  const refreshConversations = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    await client.conversations.syncAll();
    const list = await client.conversations.list();
    convRef.current = new Map(list.map((c) => [(c as unknown as { id: string }).id, c]));
    setConversations(await Promise.all(list.map(summarize)));
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      const conv = convRef.current.get(id);
      if (!conv) return;
      setActiveId(id);
      activeRef.current = id;
      setMessages([]);
      try {
        await conv.sync();
        const msgs = await conv.messages({ limit: 100n });
        // messages() returns newest-first — reverse to render oldest→newest
        setMessages([...msgs].reverse().map(toChatMessage));
      } catch (e) {
        setError(humanError(e));
      }
    },
    [toChatMessage]
  );

  const startStream = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    try {
      const stream = await client.conversations.streamAllMessages();
      streamRef.current = stream as unknown as { return?: () => void };
      for await (const msg of stream as AsyncIterable<DecodedMessage>) {
        const anyM = msg as unknown as { conversationId?: string };
        if (anyM.conversationId && anyM.conversationId === activeRef.current) {
          setMessages((cur) => [...cur, toChatMessage(msg)]);
        } else {
          // a message landed in another conversation — refresh the list lazily
          refreshConversations().catch(() => {});
        }
      }
    } catch {
      /* stream ended / closed */
    }
  }, [toChatMessage, refreshConversations]);

  const adopt = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (client: any) => {
      clientRef.current = client;
      myInboxRef.current = (client as { inboxId: string }).inboxId;
      await refreshConversations();
      void startStream();
      setStatus("ready");
    },
    [refreshConversations, startStream]
  );

  const enable = useCallback(async () => {
    if (!walletClient || !address) return;
    // Already initialized this session (e.g. came back from another tab) — reuse.
    if (sharedXmtp && sharedXmtp.address === address) {
      await adopt(sharedXmtp.client);
      return;
    }
    setStatus("enabling");
    setError(undefined);
    try {
      const { Client, IdentifierKind } = await import("@xmtp/browser-sdk");
      const identifier = { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum };
      // Manual enable always creates (one signature). build() is reserved for the
      // silent restore below, where a prior local inbox is known to exist — calling
      // build() on a wallet that has never enabled can hang instead of failing.
      const signer = {
        type: "EOA" as const,
        getIdentifier: () => identifier,
        signMessage: async (message: string) =>
          toBytes(await walletClient.signMessage({ account: address, message })),
      };
      // env lives in NetworkOptions but the ClientOptions union trips the excess-
      // property check; cast since this is a dynamic-imported SDK. Runtime-correct.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = await Client.create(signer as any, { env: "production" } as any);
      sharedXmtp = { address, client };
      markEnabled(address);
      await adopt(client);
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }, [walletClient, address, adopt]);

  // Silent restore: reuse the in-session client, or (after a reload) rebuild from
  // the local OPFS database — both without a signature. Only runs for a wallet
  // that previously enabled messaging, so the WASM stays lazy otherwise.
  const restoredRef = useRef<string>("");
  useEffect(() => {
    if (!address) return;
    if (sharedXmtp && sharedXmtp.address === address) {
      void adopt(sharedXmtp.client);
      return;
    }
    if (restoredRef.current === address || !wasEnabled(address)) return;
    restoredRef.current = address;
    let alive = true;
    (async () => {
      setStatus("enabling");
      try {
        const { Client, IdentifierKind } = await import("@xmtp/browser-sdk");
        const identifier = { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = await (Client as any).build(identifier, { env: "production" });
        if (!alive) return;
        sharedXmtp = { address, client };
        await adopt(client);
      } catch {
        if (alive) setStatus("idle"); // couldn't restore → user enables manually
      }
    })();
    return () => { alive = false; };
  }, [address, adopt]);

  const sendMessage = useCallback(async (text: string) => {
    const id = activeRef.current;
    const conv = id ? convRef.current.get(id) : undefined;
    if (!conv || !text.trim()) return;
    // Conversation.send accepts a string at runtime; the typed overload resolves
    // to EncodedContent, so cast (dynamic-imported SDK, runtime-correct).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (conv as any).send(text.trim());
    // optimistic: stream will also deliver it, but show immediately
    setMessages((cur) => [
      ...cur,
      { id: `local-${cur.length}-${text.length}`, senderInboxId: myInboxRef.current, text: text.trim(), mine: true },
    ]);
  }, []);

  /** Start (or open) a DM with an Ethereum address. Returns false if unreachable. */
  const startDm = useCallback(
    async (addressInput: string): Promise<boolean> => {
      const client = clientRef.current;
      if (!client) return false;
      let target: string;
      try {
        target = getAddress(addressInput.trim()).toLowerCase();
      } catch {
        setError("Enter a valid 0x address.");
        return false;
      }
      try {
        const { IdentifierKind } = await import("@xmtp/browser-sdk");
        const identifier = { identifier: target, identifierKind: IdentifierKind.Ethereum };
        const reachable = await client.canMessage([identifier]);
        const ok = reachable instanceof Map ? reachable.get(target) : Array.isArray(reachable) ? reachable[0] : reachable;
        if (!ok) {
          setError("That address hasn't activated XMTP messaging yet.");
          return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dm = await (client.conversations as any).newDmWithIdentifier(identifier);
        await refreshConversations();
        await openConversation((dm as unknown as { id: string }).id);
        setError(undefined);
        return true;
      } catch (e) {
        setError(humanError(e));
        return false;
      }
    },
    [refreshConversations, openConversation]
  );

  // Tear down the stream on unmount.
  useEffect(() => {
    return () => {
      try {
        streamRef.current?.return?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    isConnected,
    status,
    error,
    conversations,
    activeId,
    messages,
    enable,
    openConversation,
    sendMessage,
    startDm,
  };
}
