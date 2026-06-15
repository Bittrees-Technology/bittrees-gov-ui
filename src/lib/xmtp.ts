import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { toBytes, getAddress } from "viem";
import type { Client, Conversation, DecodedMessage } from "@xmtp/browser-sdk";
import { isBlocked } from "./dmPrefs";

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
  peerAddress?: string; // DM only — the other participant's wallet (UI resolves ENS)
  lastAt?: number; // ms timestamp of the most recent message (for recency sort)
  lastText?: string; // short preview of the most recent message
  lastFromMe?: boolean; // I sent the most recent message (→ never counts as unread)
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

// Decode a message body to text. Returns null for non-text content — MLS
// membership/system messages, reactions, read receipts, etc. — so callers can SKIP
// them rather than render "(unsupported message type)" bubbles.
function textOf(content: unknown): string | null {
  return typeof content === "string" ? content : null;
}

// A DM exposes only the peer's inboxId, not their wallet — resolving the address
// means inboxId → inbox state → identifier, a network-ish lookup. Cache the result
// (memory + localStorage) so the conversation list doesn't re-resolve every refresh.
const PEER_KEY = "bittrees.xmtp.peers";
const peerCache: Map<string, string> = (() => {
  try { return new Map<string, string>(Object.entries(JSON.parse(localStorage.getItem(PEER_KEY) || "{}"))); }
  catch { return new Map<string, string>(); }
})();
function rememberPeer(convId: string, address: string) {
  peerCache.set(convId, address.toLowerCase());
  try { localStorage.setItem(PEER_KEY, JSON.stringify(Object.fromEntries(peerCache))); } catch { /* ignore */ }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolvePeer(c: Conversation, client: any): Promise<string | undefined> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inboxId: string | undefined = await (c as any).peerInboxId?.();
    if (!inboxId) return undefined;
    let states = await client.preferences.getInboxStates([inboxId]); // local DB first
    if (!states?.[0]?.accountIdentifiers?.length) {
      states = await client.preferences.fetchInboxStates([inboxId]); // then the network
    }
    const idents = states?.[0]?.accountIdentifiers ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = idents.find((i: any) => /^0x[0-9a-fA-F]{40}$/.test(i?.identifier)) ?? idents[0];
    const addr = eth?.identifier as string | undefined;
    if (addr) rememberPeer((c as unknown as { id: string }).id, addr);
    return addr?.toLowerCase();
  } catch {
    return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function summarize(c: Conversation, client: any, myInboxId: string): Promise<ConvSummary> {
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

  let peerAddress: string | undefined;
  if (kind === "dm") {
    peerAddress = peerCache.get(anyC.id) || (await resolvePeer(c, client));
    if (peerAddress) title = peerAddress; // rendered through <AddressName> (ENS) in the UI
  }

  let lastAt: number | undefined;
  let lastText: string | undefined;
  let lastFromMe: boolean | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lm = await (c as any).lastMessage?.();
    if (lm) {
      const ns = (lm.sentAtNs ?? null) as bigint | null;
      lastAt = ns != null ? Number(ns / 1_000_000n) : lm.sentAt ? new Date(lm.sentAt).getTime() : undefined;
      lastText = textOf(lm.content) ?? undefined;
      lastFromMe = lm.senderInboxId === myInboxId;
    }
  } catch {
    /* no last message yet */
  }

  return { id: anyC.id, kind, title, peerAddress, lastAt, lastText, lastFromMe };
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

  // null = a non-text/system message (e.g. the MLS membership message created with a
  // DM) — callers filter these out instead of showing "(unsupported message type)".
  const toChatMessage = useCallback((m: DecodedMessage): ChatMessage | null => {
    const anyM = m as unknown as { id: string; senderInboxId: string; content: unknown };
    const text = textOf(anyM.content);
    if (text === null) return null;
    return {
      id: anyM.id,
      senderInboxId: anyM.senderInboxId,
      text,
      mine: anyM.senderInboxId === myInboxRef.current,
    };
  }, []);

  const refreshConversations = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    await client.conversations.syncAll();
    const list = await client.conversations.list();
    convRef.current = new Map(list.map((c) => [(c as unknown as { id: string }).id, c]));
    const myInbox = myInboxRef.current;
    setConversations(await Promise.all(list.map((c) => summarize(c, client, myInbox))));
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
        // High limit = effectively the FULL 1:1 history (XMTP messages are stored
        // locally after sync, so reading them all is cheap — no network per message).
        const msgs = await conv.messages({ limit: 100000n });
        // messages() returns newest-first — reverse to render oldest→newest, dropping
        // system/non-text messages (null) so they don't render as unsupported bubbles.
        setMessages([...msgs].reverse().map(toChatMessage).filter((m): m is ChatMessage => m !== null));
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
          const cm = toChatMessage(msg);
          // skip system/non-text (null), and de-dupe by id (the stream echoes our own
          // sends, which we already added optimistically with their real id)
          if (cm) setMessages((cur) => (cur.some((m) => m.id === cm.id) ? cur : [...cur, cm]));
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
    const body = text.trim();
    if (!conv || !body) return;
    try {
      // sendText is the plain-text path. (Conversation.send expects pre-EncodedContent
      // — passing a raw string there mis-encodes it, so the peer sees a non-text type.)
      // It returns the published message id, which lets the stream echo de-dupe below.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgId: string = await (conv as any).sendText(body);
      // optimistic: stream also delivers it (de-duped by this id), but show immediately
      setMessages((cur) =>
        cur.some((m) => m.id === msgId)
          ? cur
          : [...cur, { id: msgId || `local-${cur.length}-${body.length}`, senderInboxId: myInboxRef.current, text: body, mine: true }]
      );
    } catch (e) {
      setError(humanError(e));
    }
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
      if (isBlocked(target)) {
        setError("You've blocked this address. Unblock them to start a conversation.");
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
        const dm = await (client.conversations as any).createDmWithIdentifier(identifier);
        rememberPeer((dm as unknown as { id: string }).id, target); // we know the peer — skip resolution
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

  /**
   * Send the same message to many addresses at once (no conversation is opened).
   * Reachability is checked in ONE batched canMessage call, then delivery runs in a
   * small concurrency pool instead of strictly one-at-a-time — that's what kept
   * "Message all" from feeling laggy. Blocked, invalid, and duplicate addresses are
   * dropped up front.
   */
  const broadcast = useCallback(
    async (addresses: string[], text: string): Promise<{ sent: number; skipped: number }> => {
      const client = clientRef.current;
      const body = text.trim();
      if (!client || !body) return { sent: 0, skipped: 0 };
      const { IdentifierKind } = await import("@xmtp/browser-sdk");

      // Normalize → drop invalid / blocked / duplicate.
      const targets: string[] = [];
      let skipped = 0;
      for (const a of addresses) {
        try {
          const t = getAddress(a.trim()).toLowerCase();
          if (isBlocked(t) || targets.includes(t)) continue;
          targets.push(t);
        } catch {
          skipped++;
        }
      }
      if (targets.length === 0) return { sent: 0, skipped };

      // One reachability check for the whole set.
      const identifiers = targets.map((t) => ({ identifier: t, identifierKind: IdentifierKind.Ethereum }));
      let reach: Map<string, boolean>;
      try {
        const r = await client.canMessage(identifiers);
        reach = r instanceof Map ? r : new Map();
      } catch {
        reach = new Map();
      }
      const reachable = targets.filter((t) => reach.get(t));
      skipped += targets.length - reachable.length;

      // Deliver in a bounded concurrency pool (createDm + send is the slow part).
      let sent = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < reachable.length) {
          const t = reachable[cursor++];
          try {
            const identifier = { identifier: t, identifierKind: IdentifierKind.Ethereum };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dm = await (client.conversations as any).createDmWithIdentifier(identifier);
            rememberPeer((dm as unknown as { id: string }).id, t);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (dm as any).sendText(body); // plain text (send() expects EncodedContent)
            sent++;
          } catch {
            skipped++;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, reachable.length) }, worker));
      await refreshConversations();
      return { sent, skipped };
    },
    [refreshConversations]
  );

  /**
   * Mirror a local block/unblock to XMTP consent for the peer's DM, when one exists.
   * Best-effort: the visible block (hiding the conversation, refusing new DMs) is
   * driven by the local block list; this also tells the network so the peer drops
   * out of allowed conversations on other clients.
   */
  const setPeerConsent = useCallback(async (address: string, allowed: boolean) => {
    const a = address.toLowerCase();
    let convId: string | undefined;
    for (const [id, addr] of peerCache) if (addr === a) { convId = id; break; }
    const conv = convId ? convRef.current.get(convId) : undefined;
    if (!conv) return;
    try {
      const { ConsentState } = await import("@xmtp/browser-sdk");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (conv as any).updateConsentState(allowed ? ConsentState.Allowed : ConsentState.Denied);
    } catch {
      /* best effort — local block list is the source of truth for the UI */
    }
  }, []);

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
    broadcast,
    setPeerConsent,
  };
}
