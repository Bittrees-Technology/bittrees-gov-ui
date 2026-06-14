import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useXmtp } from "../lib/xmtp";
import { useVotingPowerNow } from "../lib/snapshot";
import {
  BGOV_ROOMS,
  SAFE_ROOMS,
  joinRoom,
  roomHistory,
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
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", color: "var(--color-ink-muted)", maxWidth: "660px", lineHeight: 1.6, marginTop: "0.5rem" }}>
          Wallet-native messaging — no phone number, no account.<br />
          Encrypted 1:1 <strong>direct messages</strong> over XMTP,<br />
          plus token-gated <strong>community rooms</strong>
        </p>
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
  return <Chat xmtp={xmtp} />;
}

function Chat({ xmtp }: { xmtp: ReturnType<typeof useXmtp> }) {
  const [dmInput, setDmInput] = useState("");
  const [draft, setDraft] = useState("");

  async function start() {
    const ok = await xmtp.startDm(dmInput);
    if (ok) setDmInput("");
  }
  async function send() {
    const t = draft;
    setDraft("");
    await xmtp.sendMessage(t);
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", minHeight: "440px" }} className="msg-grid">
        <aside style={{ borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "0.85rem", borderBottom: "1px solid var(--color-border)", display: "flex", gap: "0.4rem" }}>
            <input value={dmInput} onChange={(e) => setDmInput(e.target.value)} placeholder="New message — 0x address" onKeyDown={(e) => e.key === "Enter" && start()} style={{ ...inputStyle, flex: 1 }} />
            <button className="btn-primary" onClick={start} style={{ padding: "0.4rem 0.7rem", fontSize: "0.8rem" }}>Start</button>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {xmtp.conversations.length === 0 ? (
              <p style={{ ...dim, padding: "1rem" }}>No conversations yet. Start one with an address above.</p>
            ) : (
              xmtp.conversations.map((c) => {
                const active = c.id === xmtp.activeId;
                return (
                  <button key={c.id} onClick={() => xmtp.openConversation(c.id)} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.7rem 0.85rem", border: "none", borderBottom: "1px solid var(--color-border-light)", background: active ? "var(--color-bg-subtle)" : "transparent", cursor: "pointer", fontFamily: "var(--font-sans)" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: active ? 700 : 500, color: "var(--color-ink)" }}>{c.title}</span>
                    <span style={{ display: "block", fontSize: "0.68rem", color: "var(--color-ink-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.1rem" }}>{c.kind}</span>
                  </button>
                );
              })
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
              <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {xmtp.messages.length === 0 ? (
                  <p style={{ ...dim, margin: "auto" }}>No messages yet — say hello.</p>
                ) : (
                  xmtp.messages.map((m) => <Bubble key={m.id} mine={m.mine} text={m.text} />)
                )}
              </div>
              <Composer value={draft} setValue={setDraft} onSend={send} />
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

/**
 * Which rooms the connected wallet may access — asks the same `/api/gate` endpoint
 * Push uses to enforce joins (substituting the address for the `{{user_address}}`
 * template). 200 → accessible, 403 → not. Fails OPEN on a network/endpoint error
 * (the join itself is still gated server-side, so a stray show never leaks content).
 * We hide every room whose check is explicitly `false`.
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
            const r = await fetch(gateUrl(room).replace("{{user_address}}", address!));
            out[room.key] = r.status === 403 ? false : true;
          } catch {
            out[room.key] = true; // fail-open — join stays gated regardless
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
  const canSee = (r: PushRoom) => roomAccess?.[r.key] !== false;
  const canPropose = useCanProposeRoom(address);

  const push = usePush(); // shared, signature-persistent (survives tab switch + reload)
  const [error, setError] = useState<string>();
  const [openRoom, setOpenRoom] = useState<PushRoom | null>(null);
  const [messages, setMessages] = useState<PushMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function open(room: PushRoom) {
    if (!room.chatId || !push.client || !address) return;
    setBusy(true);
    setError(undefined);
    try {
      await joinRoom(push.client, room.chatId);
      const msgs = await roomHistory(push.client, room.chatId, address);
      setOpenRoom(room);
      setMessages(msgs);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
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
          <button onClick={() => { setOpenRoom(null); setMessages([]); }} style={{ ...linkBtn }}>← Rooms</button>
          <span style={{ fontFamily: "var(--font-serif)", fontWeight: 700, color: "var(--color-ink)" }}>Bittrees {openRoom.name}</span>
          <span style={{ ...dim, fontSize: "0.72rem" }}>{openRoom.blurb}</span>
        </div>
        {push.client && openRoom.chatId && address && (
          <ManageMembers push={push.client} chatId={openRoom.chatId} me={address} />
        )}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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
            <RoomCard key={room.key} room={room} live={!!room.chatId} eligible busy={busy} onOpen={open} notEligible={null} />
          ))}
        </div>
      )}

      {/* Entity (Safe-gated) rooms the wallet can access */}
      {visSafe.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p className="text-label">Entity rooms — Safe signers &amp; proposers</p>
          {visSafe.map((room) => (
            <RoomCard key={room.key} room={room} live={!!room.chatId} eligible busy={busy} onOpen={open} notEligible={null} />
          ))}
        </div>
      )}

      {/* Custom rooms (admin-created) the wallet can access */}
      {visCustom.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p className="text-label">More rooms</p>
          {visCustom.map((room) => (
            <RoomCard key={room.key} room={room} live={!!room.chatId} eligible busy={busy} onOpen={open} notEligible={null} />
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
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
                    {m.wallet.slice(0, 6)}…{m.wallet.slice(-4)} {m.role === "ADMIN" && <strong style={{ color: "var(--color-primary-hover)" }}>· admin</strong>}
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
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--color-ink-dim)" }}>
          {m.from.slice(0, 6)}…{m.from.slice(-4)}
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
    <div style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%", padding: "0.5rem 0.75rem", borderRadius: "10px", background: mine ? "var(--color-primary)" : "var(--color-bg-subtle)", color: mine ? "#ffffff" : "var(--color-ink)", fontFamily: "var(--font-sans)", fontSize: "0.875rem", lineHeight: 1.5, wordBreak: "break-word" }}>
      {text}
    </div>
  );
}

function Composer({ value, setValue, onSend }: { value: string; setValue: (v: string) => void; onSend: () => void }) {
  return (
    <div style={{ borderTop: "1px solid var(--color-border)", padding: "0.7rem", display: "flex", gap: "0.5rem" }}>
      <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSend()} placeholder="Message…" style={{ ...inputStyle, flex: 1 }} />
      <button className="btn-primary" onClick={onSend} disabled={!value.trim()} style={{ opacity: value.trim() ? 1 : 0.5 }}>Send</button>
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
