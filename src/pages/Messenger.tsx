import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useXmtp, type ConvSummary, type ChatMessage, type ReplyRef } from "../lib/xmtp";
import {
  useDmPrefs,
  useBlocked,
  useDmSettings,
  setReadReceipts,
  togglePin,
  setArchived,
  markRead,
  setPinnedOrder,
  blockAddr,
  unblockAddr,
} from "../lib/dmPrefs";
import { useVotingPowerNow } from "../lib/snapshot";
import {
  BGOV_ROOMS,
  SAFE_ROOMS,
  joinRoom,
  roomHistory,
  roomHistoryOlder,
  sendRoom,
  roomMembers,
  setRoomRole,
  removeFromRoom,
  gateUrl,
  type PushRoom,
  type PushMessage,
  type PushClient,
  type RoomMember,
  type RoomRole,
} from "../lib/push";
import { usePush } from "../lib/usePush";
import { useRoomRegistry } from "../lib/rooms";
import { useCanProposeRoom } from "../lib/adminAccess";
import { ProposeRoom } from "../components/ProposeRoom";
import { AddressName } from "../components/AddressName";
import { PeoplePanel } from "../components/PeoplePanel";
import { getEnsAddress } from "@wagmi/core";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { wagmiConfig } from "../lib/chains";
import { UserBadges } from "../components/badges";
import { FlagButton, HiddenNotice } from "../components/moderation";
import { useItemModeration } from "../lib/community";
import { fmtNumber } from "../lib/links";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Something went wrong";
}

export default function Messenger() {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<"dms" | "groups">("dms");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Messenger</h1>
      </header>

      <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--color-border)" }}>
        <TabBtn active={tab === "dms"} onClick={() => setTab("dms")}>Direct messages</TabBtn>
        <TabBtn active={tab === "groups"} onClick={() => setTab("groups")}>Community rooms</TabBtn>
      </div>

      {!isConnected ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Connect a wallet to message.</p>
          <ConnectButton chainStatus="none" showBalance={false} />
        </div>
      ) : tab === "dms" ? (
        <DirectMessages />
      ) : (
        <CommunityGroups />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.5rem 0.9rem",
        fontFamily: "var(--font-sans)",
        fontSize: "0.875rem",
        fontWeight: active ? 700 : 500,
        color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
        background: "none",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
        cursor: "pointer",
        marginBottom: "-1px",
      }}
    >
      {children}
    </button>
  );
}

/* ── Direct messages (XMTP) ─────────────────────────────────────────────── */
function DirectMessages() {
  const xmtp = useXmtp();

  if (xmtp.status !== "ready") {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxWidth: "560px" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", color: "var(--color-ink-muted)", lineHeight: 1.6, margin: 0 }}>
          Turning on DMs asks your wallet for a one-time signature to create your encrypted XMTP
          inbox. No gas, no transaction.
        </p>
        <div>
          <button className="btn-primary" onClick={xmtp.enable} disabled={xmtp.status === "enabling"} style={{ opacity: xmtp.status === "enabling" ? 0.6 : 1 }}>
            {xmtp.status === "enabling" ? "Confirm in wallet…" : "Enable direct messages"}
          </button>
        </div>
        {xmtp.status === "error" && xmtp.error && (
          <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-ink)", margin: 0 }}>{xmtp.error}</p>
        )}
      </div>
    );
  }
  return (
    <div className="dm-layout">
      <PeoplePanel onMessage={(addr) => { void xmtp.startDm(addr); }} onBroadcast={(addrs, text) => xmtp.broadcast(addrs, text)} />
      <Chat xmtp={xmtp} />
    </div>
  );
}

function Chat({ xmtp }: { xmtp: ReturnType<typeof useXmtp> }) {
  const [dmInput, setDmInput] = useState("");
  const [draft, setDraft] = useState("");
  const [menuId, setMenuId] = useState<string>();
  const [showArchived, setShowArchived] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showRequests, setShowRequests] = useState(true);
  const [replyingTo, setReplyingTo] = useState<ChatMessage>();
  const prefs = useDmPrefs();
  const blocked = useBlocked();
  const settings = useDmSettings();
  const active = xmtp.conversations.find((c) => c.id === xmtp.activeId);

  // Keep the open conversation marked read as it's viewed / new messages arrive.
  useEffect(() => {
    if (xmtp.activeId) markRead(xmtp.activeId, Date.now());
  }, [xmtp.activeId, xmtp.messages.length]);

  // Partition: pinned (manual order) → recent (newest first) → archived → blocked.
  // DMs whose peer is blocked are dropped from the visible list entirely.
  const { pinned, recent, archived, requests } = useMemo(() => {
    const blk = new Set(blocked);
    const notBlocked = xmtp.conversations.filter(
      (c) => !(c.kind === "dm" && c.peerAddress && blk.has(c.peerAddress.toLowerCase()))
    );
    // Inbound DMs we haven't consented to yet surface as requests, not the main list.
    const isRequest = (c: ConvSummary) => c.kind === "dm" && c.consent === "unknown" && !c.lastFromMe;
    const visible = notBlocked.filter((c) => c.consent !== "denied" && !isRequest(c));
    const reqs = notBlocked.filter(isRequest).sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
    const arch = visible.filter((c) => prefs[c.id]?.archived);
    const live = visible.filter((c) => !prefs[c.id]?.archived);
    const pin = live
      .filter((c) => prefs[c.id]?.pinned)
      .sort((a, b) => (prefs[a.id]?.order ?? 0) - (prefs[b.id]?.order ?? 0));
    const rec = live
      .filter((c) => !prefs[c.id]?.pinned)
      .sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
    return { pinned: pin, recent: rec, archived: arch, requests: reqs };
  }, [xmtp.conversations, prefs, blocked]);

  function move(id: string, dir: "up" | "down") {
    const ids = pinned.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setPinnedOrder(ids);
  }
  async function blockConv(c: ConvSummary) {
    if (!c.peerAddress) return;
    setMenuId(undefined);
    blockAddr(c.peerAddress);
    await xmtp.setPeerConsent(c.peerAddress, false);
  }
  async function unblock(addr: string) {
    unblockAddr(addr);
    await xmtp.setPeerConsent(addr, true);
  }

  async function start() {
    let target = dmInput.trim();
    if (target.includes(".")) {
      // Resolve an ENS name to its address before starting the DM.
      try {
        const resolved = await getEnsAddress(wagmiConfig, { name: normalize(target), chainId: mainnet.id });
        if (resolved) target = resolved;
      } catch { /* fall through — startDm will report an invalid address */ }
    }
    const ok = await xmtp.startDm(target);
    if (ok) setDmInput("");
  }
  async function send() {
    const t = draft;
    if (!t.trim()) return;
    setDraft("");
    const r = replyingTo;
    setReplyingTo(undefined);
    await xmtp.sendMessage(t, r ? { id: r.id, senderInboxId: r.senderInboxId, text: r.text, mine: r.mine } : undefined);
  }

  const isUnread = (c: ConvSummary) =>
    !!c.lastAt && !c.lastFromMe && c.id !== xmtp.activeId && c.lastAt > (prefs[c.id]?.lastReadAt ?? 0);

  const rowProps = (c: ConvSummary) => ({
    c,
    active: c.id === xmtp.activeId,
    unread: isUnread(c),
    pinned: !!prefs[c.id]?.pinned,
    menuOpen: menuId === c.id,
    onOpen: () => { setMenuId(undefined); xmtp.openConversation(c.id); },
    onMenu: () => setMenuId((m) => (m === c.id ? undefined : c.id)),
    onPin: () => togglePin(c.id),
    onArchive: () => { setArchived(c.id, true); setMenuId(undefined); },
    onUnarchive: () => setArchived(c.id, false),
    onBlock: () => blockConv(c),
  });

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", minHeight: "440px" }} className="msg-grid">
        <aside style={{ borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0.85rem", borderBottom: "1px solid var(--color-border)", display: "flex", gap: "0.4rem" }}>
            <input value={dmInput} onChange={(e) => setDmInput(e.target.value)} placeholder="New message — 0x address or name.eth" onKeyDown={(e) => e.key === "Enter" && start()} style={{ ...inputStyle, flex: 1 }} />
            <button className="btn-primary" onClick={start} style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}>Start</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {xmtp.conversations.length === 0 ? (
              <p style={{ ...dim, padding: "1rem" }}>No conversations yet. Start one with an address above.</p>
            ) : (
              <>
                {requests.length > 0 && (
                  <>
                    <button onClick={() => setShowRequests((v) => !v)} style={{ ...discloseStyle, color: "var(--color-primary-hover)" }}>
                      {showRequests ? "▾" : "▸"} Requests ({requests.length})
                    </button>
                    {showRequests && requests.map((c) => (
                      <RequestRow
                        key={c.id}
                        c={c}
                        onOpen={() => xmtp.openConversation(c.id)}
                        onAccept={() => xmtp.setConvConsent(c.id, true)}
                        onDecline={() => xmtp.setConvConsent(c.id, false)}
                      />
                    ))}
                  </>
                )}
                {pinned.length > 0 && (
                  <>
                    <ListHeader>Pinned</ListHeader>
                    {pinned.map((c, i) => (
                      <ConvRow key={c.id} {...rowProps(c)} canUp={i > 0} canDown={i < pinned.length - 1} onUp={() => move(c.id, "up")} onDown={() => move(c.id, "down")} />
                    ))}
                  </>
                )}
                {recent.map((c) => <ConvRow key={c.id} {...rowProps(c)} />)}
                {pinned.length === 0 && recent.length === 0 && archived.length > 0 && (
                  <p style={{ ...dim, padding: "1rem" }}>All conversations archived.</p>
                )}

                {archived.length > 0 && (
                  <>
                    <button onClick={() => setShowArchived((v) => !v)} style={discloseStyle}>
                      {showArchived ? "▾" : "▸"} Archived ({archived.length})
                    </button>
                    {showArchived && archived.map((c) => <ConvRow key={c.id} {...rowProps(c)} archived />)}
                  </>
                )}
                {blocked.length > 0 && (
                  <>
                    <button onClick={() => setShowBlocked((v) => !v)} style={discloseStyle}>
                      {showBlocked ? "▾" : "▸"} Blocked ({blocked.length})
                    </button>
                    {showBlocked && blocked.map((addr) => (
                      <div key={addr} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem", padding: "0.5rem 0.85rem", borderBottom: "1px solid var(--color-border-light)" }}>
                        <span style={{ minWidth: 0, overflow: "hidden" }}><AddressName address={addr} /></span>
                        <button onClick={() => unblock(addr)} style={{ ...linkBtn, fontSize: "0.72rem", color: "var(--color-primary-hover)", flexShrink: 0 }}>Unblock</button>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </aside>
        <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!xmtp.activeId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
              <p style={{ ...dim, textAlign: "center" }}>Select a conversation, or start a new one with a wallet address.</p>
            </div>
          ) : (
            <>
              <ChatHeader
                peer={active?.peerAddress}
                title={active?.kind === "group" ? active.title : undefined}
                receipts={settings.readReceipts}
                onToggleReceipts={() => setReadReceipts(!settings.readReceipts)}
              />
              <DmMessageList
                messages={xmtp.messages}
                onReact={(id, inbox, emoji) => void xmtp.toggleReaction(id, inbox, emoji)}
                onReply={setReplyingTo}
                onRetry={(id) => void xmtp.retryMessage(id)}
              />
              <Composer
                value={draft}
                setValue={setDraft}
                onSend={send}
                header={replyingTo ? <ReplyBanner m={replyingTo} onCancel={() => setReplyingTo(undefined)} /> : undefined}
              />
            </>
          )}
        </section>
      </div>
      {xmtp.error && (
        <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "0.78rem", color: "var(--color-ink)", padding: "0 0.85rem 0.85rem", margin: 0 }}>{xmtp.error}</p>
      )}
    </div>
  );
}

/** One conversation row: peer identity (ENS), recency, unread dot, and an options
 *  bar (pin/reorder · archive · block) revealed by the ⋯ toggle. */
function ConvRow({ c, active, unread, pinned, menuOpen, archived, onOpen, onMenu, onPin, onArchive, onUnarchive, onBlock, canUp, canDown, onUp, onDown }: {
  c: ConvSummary;
  active: boolean;
  unread: boolean;
  pinned: boolean;
  menuOpen: boolean;
  archived?: boolean;
  onOpen: () => void;
  onMenu: () => void;
  onPin: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onBlock: () => void;
  canUp?: boolean;
  canDown?: boolean;
  onUp?: () => void;
  onDown?: () => void;
}) {
  return (
    <div style={{ borderBottom: "1px solid var(--color-border-light)", background: active ? "var(--color-bg-subtle)" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <button onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: "left", padding: "0.6rem 0.3rem 0.6rem 0.85rem", border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
            {unread && <span aria-label="unread" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0 }} />}
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.85rem", fontWeight: unread || active ? 700 : 500, color: "var(--color-ink)" }}>
              {c.kind === "dm" && c.peerAddress ? <AddressName address={c.peerAddress} /> : c.title}
            </span>
            {pinned && <span title="Pinned" aria-hidden style={{ flexShrink: 0, fontSize: "0.66rem", color: "var(--color-ink-dim)" }}>📌</span>}
            {c.lastAt != null && <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: "0.64rem", color: "var(--color-ink-dim)" }}>{relTime(c.lastAt)}</span>}
          </span>
          {c.lastText && (
            <span style={{ display: "block", marginTop: "0.15rem", fontSize: "0.72rem", color: unread ? "var(--color-ink-muted)" : "var(--color-ink-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.lastFromMe ? "You: " : ""}{c.lastText}
            </span>
          )}
        </button>
        <button onClick={onMenu} aria-label="Conversation options" title="Options" style={{ border: "none", background: "none", cursor: "pointer", padding: "0 0.6rem", color: menuOpen ? "var(--color-ink)" : "var(--color-ink-dim)", fontSize: "1.1rem", lineHeight: 1 }}>⋯</button>
      </div>
      {menuOpen && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", padding: "0 0.85rem 0.6rem" }}>
          {!archived && <RowAction onClick={onPin}>{pinned ? "Unpin" : "Pin"}</RowAction>}
          {pinned && !archived && <RowAction onClick={onUp} disabled={!canUp}>↑</RowAction>}
          {pinned && !archived && <RowAction onClick={onDown} disabled={!canDown}>↓</RowAction>}
          {archived ? <RowAction onClick={onUnarchive}>Unarchive</RowAction> : <RowAction onClick={onArchive}>Archive</RowAction>}
          {c.kind === "dm" && c.peerAddress && <RowAction onClick={onBlock} danger>Block</RowAction>}
        </div>
      )}
    </div>
  );
}

function RowAction({ onClick, children, danger, disabled }: { onClick?: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "0.18rem 0.5rem", fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 600, color: disabled ? "var(--color-ink-dim)" : danger ? "#9a2a2a" : "var(--color-ink-muted)", background: "#ffffff", border: "1px solid var(--color-border)", borderRadius: "2px", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function ListHeader({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, padding: "0.5rem 0.85rem 0.2rem", fontFamily: "var(--font-sans)", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-ink-dim)" }}>{children}</p>
  );
}

/** Compact relative timestamp for the conversation list (now / 5m / 3h / 2d / date). */
function relTime(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 45) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Which rooms the connected wallet may access — asks the same `/api/gate` endpoint
 * Push uses to enforce joins (substituting the address for the `{{user_address}}`
 * template). Fails CLOSED: a room is visible ONLY when the gate explicitly returns
 * 200 (access granted). Anything else — 403, a network/endpoint error, or still
 * loading — keeps the room hidden. So rooms are hidden by default and appear only
 * once a wallet has been granted access.
 */
function useRoomAccess(rooms: PushRoom[], address?: string) {
  const keys = rooms.map((r) => r.key).join(",");
  return useQuery({
    queryKey: ["room-access", address, keys],
    enabled: !!address && rooms.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const out: Record<string, boolean> = {};
      await Promise.all(
        rooms.map(async (room) => {
          try {
            // Check the gate on THIS deployment (same-origin). gateUrl() bakes in an
            // absolute URL for Push's backend CustomEndpoint, which may point at a
            // domain not yet serving this build — so use just its path here. Substitute
            // the address BEFORE new URL() (it percent-encodes the `{{…}}` braces).
            const path = new URL(gateUrl(room).replace("{{user_address}}", address!), window.location.origin).pathname;
            const r = await fetch(path);
            out[room.key] = r.status === 200; // granted only on an explicit 200
          } catch {
            out[room.key] = false; // fail-closed — hide unless access is confirmed
          }
        })
      );
      return out;
    },
  });
}

/* ── Community rooms (Push, token-gated) ────────────────────────────────── */
function CommunityGroups() {
  const { address } = useAccount();
  const { data: vpData } = useVotingPowerNow(address);
  const { data: registry } = useRoomRegistry();
  const bgov = vpData ?? 0;

  // Registry (runtime, Vercel KV) chatIds win over env (build-time) fallbacks.
  const chatIds = registry?.chatIds;
  const customRooms = registry?.custom ?? [];
  const bgovRooms = BGOV_ROOMS.map((r) => ({ ...r, chatId: chatIds?.[r.key] ?? r.chatId }));
  const safeRooms = SAFE_ROOMS.map((r) => ({ ...r, chatId: chatIds?.[r.key] ?? r.chatId }));

  // Hide rooms the connected wallet can't access (checked against the gate endpoint).
  const allRooms: PushRoom[] = [...bgovRooms, ...safeRooms, ...customRooms];
  const { data: roomAccess, isLoading: accessLoading } = useRoomAccess(allRooms, address);
  const canSee = (r: PushRoom) => roomAccess?.[r.key] === true; // hidden unless access confirmed
  const canPropose = useCanProposeRoom(address);

  const push = usePush(); // shared, signature-persistent (survives tab switch + reload)
  const [error, setError] = useState<string>();
  const [openRoom, setOpenRoom] = useState<PushRoom | null>(null);
  const [messages, setMessages] = useState<PushMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busyKey, setBusyKey] = useState<string>(); // which room is mid-join (per-room, not global)
  // Cursor for "Load older messages" (Push paginates 30 at a time); undefined = no more.
  const [olderCursor, setOlderCursor] = useState<string>();
  const [loadingOlder, setLoadingOlder] = useState(false);

  async function open(room: PushRoom) {
    if (!room.chatId || !push.client || !address) return;
    setBusyKey(room.key);
    setError(undefined);
    try {
      await joinRoom(push.client, room.chatId);
      const page = await roomHistory(push.client, room.chatId, address);
      setOpenRoom(room);
      setMessages(page.messages);
      setOlderCursor(page.cursor);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusyKey(undefined);
    }
  }

  async function loadOlder() {
    if (!openRoom?.chatId || !push.client || !address || !olderCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await roomHistoryOlder(push.client, openRoom.chatId, olderCursor, address);
      setMessages((cur) => {
        const seen = new Set(cur.map((m) => m.id));
        const older = page.messages.filter((m) => !seen.has(m.id));
        return [...older, ...cur]; // prepend older history above the current view
      });
      // Stop if there's no further cursor or it didn't advance (avoids a dead loop).
      setOlderCursor(page.cursor && page.cursor !== olderCursor ? page.cursor : undefined);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send() {
    if (!openRoom?.chatId || !push.client || !draft.trim() || !address) return;
    const text = draft.trim();
    setDraft("");
    try {
      await sendRoom(push.client, openRoom.chatId, text);
      setMessages((m) => [...m, { id: `local-${m.length}`, from: address.toLowerCase(), text, mine: true }]);
    } catch (e) {
      setError(humanError(e));
    }
  }

  if (push.status !== "ready") {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem", maxWidth: "560px" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", color: "var(--color-ink-muted)", lineHeight: 1.6, margin: 0 }}>
          Community rooms are token-gated by your Bittrees holdings and run on Push — decentralized,
          wallet-native group chat. Enabling asks for a one-time signature; after that it stays
          signed in across reloads. No gas.
        </p>
        <div>
          <button className="btn-primary" onClick={push.enable} disabled={push.status === "enabling"} style={{ opacity: push.status === "enabling" ? 0.6 : 1 }}>
            {push.status === "enabling" ? "Confirm in wallet…" : "Enable community rooms"}
          </button>
        </div>
        {push.status === "error" && push.error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{push.error}</p>}
      </div>
    );
  }

  if (openRoom) {
    return (
      <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: "440px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0.95rem", borderBottom: "1px solid var(--color-border)" }}>
          <button onClick={() => { setOpenRoom(null); setMessages([]); setOlderCursor(undefined); }} style={{ ...linkBtn }}>← Rooms</button>
          <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, color: "var(--color-ink)" }}>Bittrees {openRoom.name}</span>
          <span style={{ ...dim, fontSize: "0.72rem" }}>{openRoom.blurb}</span>
        </div>
        {push.client && openRoom.chatId && address && (
          <ManageMembers push={push.client} chatId={openRoom.chatId} me={address} />
        )}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {olderCursor && (
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              style={{ ...linkBtn, alignSelf: "center", fontSize: "0.74rem", padding: "0.25rem 0.5rem", color: "var(--color-primary-hover)" }}
            >
              {loadingOlder ? "Loading…" : "↑ Load older messages"}
            </button>
          )}
          {messages.length === 0 ? (
            <p style={{ ...dim, margin: "auto" }}>No messages yet — say gm.</p>
          ) : (
            messages.map((m) => <RoomMessage key={m.id} m={m} myAddress={address} />)
          )}
        </div>
        <Composer value={draft} setValue={setDraft} onSend={send} />
        {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", padding: "0 0.95rem 0.75rem", margin: 0 }}>{error}</p>}
      </div>
    );
  }

  const visBgov = bgovRooms.filter(canSee);
  const visSafe = safeRooms.filter(canSee);
  const visCustom = customRooms.filter(canSee);
  const nothing = visBgov.length + visSafe.length + visCustom.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <p style={dim}>
        Your BGOV: <strong style={{ color: "var(--color-ink)" }}>{fmtNumber(bgov)}</strong> · only rooms this wallet can access are shown.
      </p>

      {accessLoading && <p style={dim}>Checking which rooms you can access…</p>}
      {!accessLoading && nothing && (
        <p style={dim}>
          No rooms available to this wallet yet — rooms appear here once you qualify, by your
          BGOV holdings or a role assigned to you.
        </p>
      )}

      {/* Shareholder (BGOV-tier) rooms the wallet can access */}
      {visBgov.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p className="text-label">Shareholder rooms</p>
          {visBgov.map((room) => (
            <RoomCard key={room.key} room={room} live={!!room.chatId} eligible busy={busyKey === room.key} onOpen={open} notEligible={null} />
          ))}
        </div>
      )}

      {/* Entity (Safe-gated) rooms the wallet can access */}
      {visSafe.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p className="text-label">Entity rooms — Safe signers &amp; proposers</p>
          {visSafe.map((room) => (
            <RoomCard key={room.key} room={room} live={!!room.chatId} eligible busy={busyKey === room.key} onOpen={open} notEligible={null} />
          ))}
        </div>
      )}

      {/* Custom rooms (admin-created) the wallet can access */}
      {visCustom.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p className="text-label">More rooms</p>
          {visCustom.map((room) => (
            <RoomCard key={room.key} room={room} live={!!room.chatId} eligible busy={busyKey === room.key} onOpen={open} notEligible={null} />
          ))}
        </div>
      )}

      {canPropose && <ProposeRoom address={address!} />}

      {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</p>}
    </div>
  );
}

/** Presentational room row — Coming soon · Join · or a not-eligible hint. */
function RoomCard({ room, live, eligible, busy, onOpen, notEligible, roleLabel }: {
  room: PushRoom;
  live: boolean;
  eligible: boolean;
  busy: boolean;
  onOpen: (r: PushRoom) => void;
  notEligible: React.ReactNode;
  roleLabel?: string;
}) {
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <div>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
          {room.name}
          {roleLabel && (
            <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-primary-hover)", border: "1px solid var(--color-border-light)", borderRadius: "999px", padding: "0.05rem 0.4rem", marginLeft: "0.5rem" }}>
              {roleLabel}
            </span>
          )}
        </p>
        <p style={{ ...dim, margin: "0.2rem 0 0" }}>{room.blurb}</p>
      </div>
      {!live ? (
        <span style={{ ...dim, fontSize: "0.78rem" }}>Coming soon</span>
      ) : eligible ? (
        <button className="btn-primary" disabled={busy} onClick={() => onOpen(room)} style={{ opacity: busy ? 0.6 : 1 }}>
          {busy ? "Joining…" : "Join & open"}
        </button>
      ) : (
        <span style={{ ...dim, fontSize: "0.78rem", textAlign: "right" }}>{notEligible}</span>
      )}
    </div>
  );
}

/** Room-admin panel: add a wallet as Member/Admin, or remove one (Push roles). */
function ManageMembers({ push, chatId, me }: { push: PushClient; chatId: string; me: string }) {
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [show, setShow] = useState(false);
  const [addr, setAddr] = useState("");
  const [role, setRole] = useState<RoomRole>("MEMBER");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const load = useCallback(async () => {
    setMembers(await roomMembers(push, chatId));
  }, [push, chatId]);

  useEffect(() => { load(); }, [load]);

  const amAdmin = members.some((m) => m.wallet === me.toLowerCase() && m.role === "ADMIN");
  if (!amAdmin) return null; // only room admins manage roles

  async function add() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr.trim())) { setErr("Enter a valid 0x address."); return; }
    setBusy(true); setErr(undefined);
    try { await setRoomRole(push, chatId, [addr.trim()], role); setAddr(""); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function remove(wallet: string) {
    setBusy(true); setErr(undefined);
    try { await removeFromRoom(push, chatId, [wallet], "MEMBER"); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-subtle)" }}>
      <button onClick={() => setShow((v) => !v)} style={{ ...linkBtn, padding: "0.5rem 0.95rem", width: "100%", textAlign: "left" }}>
        {show ? "▾" : "▸"} Manage members &amp; roles ({members.length})
      </button>
      {show && (
        <div style={{ padding: "0 0.95rem 0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x address" style={{ ...inputStyle, flex: 1, minWidth: "180px", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }} />
            <select value={role} onChange={(e) => setRole(e.target.value as RoomRole)} style={{ ...inputStyle, width: "auto" }}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button className="btn-primary" disabled={busy} onClick={add} style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}>Add</button>
          </div>
          {members.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "160px", overflowY: "auto" }}>
              {members.map((m) => (
                <div key={m.wallet} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
                    <AddressName address={m.wallet} />
                    <UserBadges address={m.wallet} />
                    {m.role === "ADMIN" && <strong style={{ color: "var(--color-primary-hover)" }}>· admin</strong>}
                  </span>
                  {m.wallet !== me.toLowerCase() && (
                    <button onClick={() => remove(m.wallet)} disabled={busy} style={{ ...linkBtn, fontSize: "0.72rem", color: "#9a2a2a" }}>remove</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {err && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────── */
function RoomMessage({ m, myAddress }: { m: PushMessage; myAddress?: string }) {
  const mod = useItemModeration(m.id, myAddress);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: m.mine ? "flex-end" : "flex-start", gap: "0.15rem" }}>
      {!m.mine && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.62rem", color: "var(--color-ink-dim)" }}>
          <AddressName address={m.from} />
          <UserBadges address={m.from} />
        </span>
      )}
      {mod.hidden ? (
        <div style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "78%" }}><HiddenNotice compact /></div>
      ) : (
        <Bubble mine={m.mine} text={m.text} />
      )}
      {!m.mine && !mod.hidden && <FlagButton id={m.id} surface="chat" preview={m.text} />}
    </div>
  );
}

function Bubble({ mine, text }: { mine: boolean; text: string }) {
  return (
    <div style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%", padding: "0.5rem 0.75rem", borderRadius: "10px", background: mine ? "var(--color-primary)" : "var(--color-bg-subtle)", color: mine ? "#ffffff" : "var(--color-ink)", fontFamily: "var(--font-sans)", fontSize: "0.875rem", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
      {text}
    </div>
  );
}

/* ── DM message UI: header, list, rich bubble, reactions, replies ─────────── */
const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "😮", "😢"];

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** Chat header: who you're talking with + a read-receipts toggle. */
function ChatHeader({ peer, title, receipts, onToggleReceipts }: { peer?: string; title?: string; receipts: boolean; onToggleReceipts: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.95rem", borderBottom: "1px solid var(--color-border)" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", fontWeight: 700, color: "var(--color-ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {peer ? <AddressName address={peer} avatar /> : (title ?? "Conversation")}
      </span>
      <button
        onClick={onToggleReceipts}
        title={receipts ? "Read receipts on — peers can see when you've read their messages. Click to turn off." : "Read receipts off. Click to turn on."}
        style={{ ...linkBtn, marginLeft: "auto", fontSize: "0.7rem", color: receipts ? "var(--color-primary-hover)" : "var(--color-ink-dim)", flexShrink: 0 }}
      >
        {receipts ? "✓✓" : "✓"} Receipts {receipts ? "on" : "off"}
      </button>
    </div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", margin: "0.7rem 0 0.4rem" }}>
      <span style={{ flex: 1, height: 1, background: "var(--color-border-light)" }} />
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.64rem", fontWeight: 600, color: "var(--color-ink-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: "var(--color-border-light)" }} />
    </div>
  );
}

function DmMessageList({ messages, onReact, onReply, onRetry }: {
  messages: ChatMessage[];
  onReact: (id: string, inbox: string, emoji: string) => void;
  onReply: (m: ChatMessage) => void;
  onRetry: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);
  // Stick to the bottom when new messages arrive and the user is already near it.
  useEffect(() => {
    const c = containerRef.current;
    const grew = messages.length > lastCount.current;
    lastCount.current = messages.length;
    if (!c) return;
    const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 160;
    if (grew && nearBottom) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, []);

  if (messages.length === 0) {
    return <div style={{ flex: 1, display: "flex", padding: "1rem" }}><p style={{ ...dim, margin: "auto" }}>No messages yet — say hello.</p></div>;
  }
  let lastDay = "";
  return (
    <div ref={containerRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.1rem" }}>
      {messages.map((m) => {
        const day = dayLabel(m.sentAtMs);
        const showDay = day !== lastDay;
        lastDay = day;
        return (
          <div key={m.id}>
            {showDay && <DayDivider label={day} />}
            <DmBubble m={m} onReact={onReact} onReply={onReply} onRetry={onRetry} />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function DmBubble({ m, onReact, onReply, onRetry }: {
  m: ChatMessage;
  onReact: (id: string, inbox: string, emoji: string) => void;
  onReply: (m: ChatMessage) => void;
  onRetry: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const align = m.mine ? "flex-end" : "flex-start";
  const pending = m.id.startsWith("pending-");
  return (
    <div
      id={`msg-${m.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPickerOpen(false); }}
      style={{ display: "flex", flexDirection: "column", gap: "0.12rem", padding: "0.12rem 0" }}
    >
      {m.replyTo && <QuotedPreview r={m.replyTo} mine={m.mine} />}
      {/* Full-width row aligned by flex-direction — NOT a shrink-to-fit row, so the
          bubble's % max-width resolves against a stable width instead of collapsing. */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexDirection: m.mine ? "row-reverse" : "row" }}>
        <Bubble mine={m.mine} text={m.text} />
        {(hover || pickerOpen) && !pending && (
          <span style={{ display: "inline-flex", gap: "0.15rem", flexShrink: 0, position: "relative" }}>
            <IconBtn title="React" onClick={() => setPickerOpen((v) => !v)}>☺</IconBtn>
            <IconBtn title="Reply" onClick={() => onReply(m)}>↩</IconBtn>
            {pickerOpen && (
              <div style={{ position: "absolute", bottom: "100%", [m.mine ? "right" : "left"]: 0, marginBottom: 4, display: "flex", gap: "0.1rem", background: "#fff", border: "1px solid var(--color-border)", borderRadius: "999px", padding: "0.2rem 0.35rem", boxShadow: "0 4px 14px rgba(0,0,0,0.12)", zIndex: 5 } as React.CSSProperties}>
                {QUICK_EMOJI.map((e) => (
                  <button key={e} onClick={() => { onReact(m.id, m.senderInboxId, e); setPickerOpen(false); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1rem", lineHeight: 1, padding: "0.1rem" }}>{e}</button>
                ))}
              </div>
            )}
          </span>
        )}
      </div>
      {m.reactions.length > 0 && (
        <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", alignSelf: align, marginTop: "0.1rem" }}>
          {m.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReact(m.id, m.senderInboxId, r.emoji)}
              title={r.mine ? "Remove your reaction" : "React"}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.72rem", padding: "0.05rem 0.4rem", borderRadius: "999px", cursor: "pointer", border: `1px solid ${r.mine ? "var(--color-primary)" : "var(--color-border)"}`, background: r.mine ? "rgba(247,147,26,0.12)" : "#fff", color: "var(--color-ink)" }}
            >
              <span>{r.emoji}</span>{r.count > 1 && <span style={{ color: "var(--color-ink-muted)" }}>{r.count}</span>}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", alignSelf: align, fontSize: "0.62rem", color: "var(--color-ink-dim)", padding: "0 0.15rem" }}>
        <span>{timeLabel(m.sentAtMs)}</span>
        {m.mine && m.status === "sending" && <span>· Sending…</span>}
        {m.mine && m.status === "failed" && (
          <button onClick={() => onRetry(m.id)} style={{ ...linkBtn, fontSize: "0.62rem", color: "#9a2a2a" }}>· Failed · Retry</button>
        )}
        {m.mine && m.status === "sent" && (
          <span title={m.readByPeer ? "Read" : "Sent"} style={{ color: m.readByPeer ? "var(--color-primary-hover)" : "var(--color-ink-dim)" }}>{m.readByPeer ? "✓✓" : "✓"}</span>
        )}
      </div>
    </div>
  );
}

/** The quoted parent shown above a reply bubble; click scrolls to the original. */
function QuotedPreview({ r, mine }: { r: ReplyRef; mine: boolean }) {
  return (
    <button
      onClick={() => document.getElementById(`msg-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
      style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%", textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: "0.1rem 0.5rem", borderLeft: "2px solid var(--color-primary)" }}
    >
      <span style={{ display: "block", fontSize: "0.64rem", fontWeight: 700, color: "var(--color-primary-hover)" }}>{r.mine ? "You" : "In reply to"}</span>
      <span style={{ display: "block", fontSize: "0.72rem", color: "var(--color-ink-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>{r.text}</span>
    </button>
  );
}

/** The "replying to…" banner above the composer. */
function ReplyBanner({ m, onCancel }: { m: ChatMessage; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0.7rem", borderBottom: "1px solid var(--color-border-light)", background: "var(--color-bg-subtle)" }}>
      <span style={{ width: 3, alignSelf: "stretch", background: "var(--color-primary)", borderRadius: 2 }} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontSize: "0.66rem", fontWeight: 700, color: "var(--color-primary-hover)" }}>Replying to {m.mine ? "yourself" : "message"}</span>
        <span style={{ display: "block", fontSize: "0.74rem", color: "var(--color-ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text}</span>
      </span>
      <button onClick={onCancel} title="Cancel reply" style={{ ...linkBtn, fontSize: "0.9rem", color: "var(--color-ink-dim)", flexShrink: 0 }}>✕</button>
    </div>
  );
}

/** An inbound message request — accept (allow) or decline (deny consent). */
function RequestRow({ c, onOpen, onAccept, onDecline }: { c: ConvSummary; onOpen: () => void; onAccept: () => void; onDecline: () => void }) {
  return (
    <div style={{ padding: "0.5rem 0.85rem", borderBottom: "1px solid var(--color-border-light)", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <button onClick={onOpen} style={{ textAlign: "left", border: "none", background: "none", cursor: "pointer", padding: 0, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.peerAddress ? <AddressName address={c.peerAddress} /> : c.title}
        </span>
        {c.lastText && <span style={{ display: "block", fontSize: "0.7rem", color: "var(--color-ink-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lastText}</span>}
      </button>
      <div style={{ display: "flex", gap: "0.3rem" }}>
        <button onClick={onAccept} className="btn-primary" style={{ padding: "0.2rem 0.55rem", fontSize: "0.72rem" }}>Accept</button>
        <button onClick={onDecline} style={{ ...linkBtn, fontSize: "0.72rem", color: "#9a2a2a", border: "1px solid var(--color-border)", borderRadius: "2px", padding: "0.2rem 0.55rem" }}>Decline</button>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--color-border)", background: "#fff", borderRadius: "999px", cursor: "pointer", fontSize: "0.8rem", color: "var(--color-ink-muted)", lineHeight: 1, padding: 0 }}>{children}</button>
  );
}

function Composer({ value, setValue, onSend, header }: { value: string; setValue: (v: string) => void; onSend: () => void; header?: React.ReactNode }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Auto-grow the textarea with content, up to a cap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);
  return (
    <div style={{ borderTop: "1px solid var(--color-border)" }}>
      {header}
      <div style={{ padding: "0.7rem", display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Message…  (Shift+Enter for a new line)"
          rows={1}
          style={{ ...inputStyle, flex: 1, resize: "none", lineHeight: 1.5, maxHeight: "120px" }}
        />
        <button className="btn-primary" onClick={onSend} disabled={!value.trim()} style={{ opacity: value.trim() ? 1 : 0.5 }}>Send</button>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "0.5rem 0.65rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.85rem",
  color: "var(--color-ink)",
  background: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: "2px",
  boxSizing: "border-box" as const,
};
const linkBtn = { background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-ink-muted)", padding: 0 } as const;
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-dim)" } as const;
const discloseStyle = { display: "block", width: "100%", textAlign: "left" as const, padding: "0.55rem 0.85rem", border: "none", borderTop: "1px solid var(--color-border-light)", background: "var(--color-bg-subtle)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--color-ink-dim)" } as const;
