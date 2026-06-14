import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { getAddress, parseUnits, isAddress } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { useIsAdmin, fetchSpaceSettings, updateSpaceSettings } from "../lib/snapshot";
import { BGOV_ROOMS, SAFE_ROOMS, ROOM_ADMINS, initPush, createGatedGroup, gateUrl, gateLabel, type PushRoom, type PushClient, type RoomGate, type RoomRule } from "../lib/push";
import { useRoomRegistry, saveRoomChatId, saveCustomRoom, deleteCustomRoom } from "../lib/rooms";
import { assignRole, unassignRole, createRole, deleteRole, selectableRoles, useCommunity, moderateItem, publishEncKey, TIER_THRESHOLDS } from "../lib/community";
import { useTopics, CONTRIB_COMMUNITY, EASSCAN_VIEW } from "../lib/forum";
import { deriveEncKeypair, decryptApplication, pubKeyHex, type Application, type Envelope, type EncKeypair } from "../lib/appcrypto";
import { ROUTES, shortAddress, relativeTime } from "../lib/links";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Something went wrong";
}

export default function Admin() {
  const { address, isConnected } = useAccount();
  const isAdmin = useIsAdmin(address);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "780px", margin: "0 auto", width: "100%" }}>
      <Link to={ROUTES.proposals} style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-muted)", textDecoration: "none" }}>← Governance</Link>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.25rem" }}>
        <p className="text-label">Admin</p>
        <h1 className="text-display">Admin console</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>
          Space settings, community rooms, and contributor applications — all signed by your wallet.
          For the space's admins only.
        </p>
      </header>

      {!isConnected ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Connect a wallet.</p>
          <ConnectButton chainStatus="none" showBalance={false} />
        </div>
      ) : !isAdmin ? (
        <div className="card">
          <p style={{ ...dim, margin: 0 }}>
            This page is for the space's admins. The connected wallet isn't an admin of gov.bittrees.eth.
          </p>
        </div>
      ) : (
        <>
          <SpaceSettings address={address!} />
          <CommunityRoomsAdmin address={address!} />
          <RolesAdmin address={address!} />
          <ModerationQueue address={address!} />
          <ContributorApplications />
        </>
      )}
    </div>
  );
}

/* ── Snapshot space settings ─────────────────────────────────────────────── */
/* eslint-disable @typescript-eslint/no-explicit-any */
function readObj(raw: string): any {
  try { return JSON.parse(raw); } catch { return null; }
}

function SpaceSettings({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const [raw, setRaw] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    fetchSpaceSettings().then((s) => {
      if (!alive) return;
      setRaw(s ? JSON.stringify(s, null, 2) : "");
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  const obj = readObj(raw);
  const valid = obj !== null;

  function setVoting(key: string, value: unknown) {
    const o = readObj(raw);
    if (!o) return;
    o.voting = { ...(o.voting || {}), [key]: value };
    setRaw(JSON.stringify(o, null, 2));
  }
  function setTop(key: string, value: unknown) {
    const o = readObj(raw);
    if (!o) return;
    o[key] = value;
    setRaw(JSON.stringify(o, null, 2));
  }

  async function save() {
    const settings = readObj(raw);
    if (!walletClient || !settings) return;
    setStatus("saving");
    setError(undefined);
    try {
      await updateSpaceSettings({ walletClient, account: address, settings });
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Space settings</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Edits replace the <strong>entire</strong> gov.bittrees.eth config and are submitted to
          Snapshot — review the JSON before signing.
        </p>
      </div>

      {status === "done" ? (
        <div className="card">
          <p style={{ color: "var(--color-secondary)", fontFamily: "var(--font-sans)", fontWeight: 700, margin: 0 }}>Settings submitted ✓</p>
          <p style={{ ...dim, margin: "0.4rem 0 0" }}>Changes propagate on Snapshot shortly. Reload to see the updated config.</p>
        </div>
      ) : !loaded ? (
        <p style={dim}>Loading current settings…</p>
      ) : (
        <>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p className="text-label">Quick edits</p>
            <Row label="Encrypted voting (shutter)">
              <select value={String(obj?.voting?.privacy ?? "")} onChange={(e) => setVoting("privacy", e.target.value)} style={inputStyle}>
                <option value="">Off — votes are public (in-app voting works)</option>
                <option value="shutter">Shutter — encrypted until close</option>
              </select>
            </Row>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              <Row label="Voting period (days)">
                <input type="number" min={0} value={secToDays(obj?.voting?.period)} onChange={(e) => setVoting("period", daysToSec(e.target.value))} style={{ ...inputStyle, width: "110px" }} />
              </Row>
              <Row label="Start delay (days)">
                <input type="number" min={0} value={secToDays(obj?.voting?.delay)} onChange={(e) => setVoting("delay", daysToSec(e.target.value))} style={{ ...inputStyle, width: "110px" }} />
              </Row>
              <Row label="Quorum (BGOV)">
                <input type="number" min={0} value={Number(obj?.voting?.quorum ?? 0)} onChange={(e) => setVoting("quorum", Number(e.target.value) || 0)} style={{ ...inputStyle, width: "130px" }} />
              </Row>
            </div>
            <Row label="Space name">
              <input value={String(obj?.name ?? "")} onChange={(e) => setTop("name", e.target.value)} style={inputStyle} />
            </Row>
            <Row label="About">
              <textarea value={String(obj?.about ?? "")} onChange={(e) => setTop("about", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </Row>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p className="text-label">Full settings JSON (this is what gets submitted)</p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={14}
              spellCheck={false}
              style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: 1.5, resize: "vertical", color: valid ? "var(--color-ink)" : "#9a2a2a" }}
            />
            {!valid && <p role="alert" style={{ ...dim, color: "#9a2a2a", margin: 0 }}>Invalid JSON — fix before submitting.</p>}
            <p style={{ ...dim, fontSize: "0.76rem", margin: 0 }}>
              Changing the <strong>admins</strong> list requires the gov.bittrees.eth ENS owner (a Snapshot
              rule) — an admin signature alone can't alter it.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button className="btn-primary" disabled={!valid || status === "saving"} onClick={save} style={{ opacity: !valid || status === "saving" ? 0.55 : 1 }}>
              {status === "saving" ? "Confirm in wallet…" : "Submit settings"}
            </button>
            {status === "error" && error && <span role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</span>}
          </div>
        </>
      )}
    </section>
  );
}

/* ── Community rooms — one-click creation per tier + ENS subname ──────────── */
function CommunityRoomsAdmin({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const { data: registry } = useRoomRegistry();
  const qc = useQueryClient();
  const pushRef = useRef<PushClient | null>(null);
  const [status, setStatus] = useState<"idle" | "enabling" | "ready" | "error">("idle");
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string>();

  // Registry (runtime, Vercel KV) chatIds win over env (build-time) fallbacks.
  const rooms = [...BGOV_ROOMS, ...SAFE_ROOMS].map((r) => ({ ...r, chatId: registry?.chatIds?.[r.key] ?? r.chatId }));

  async function enable() {
    if (!walletClient) return;
    setStatus("enabling");
    setError(undefined);
    try {
      pushRef.current = await initPush(walletClient, address);
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  async function create(room: PushRoom) {
    if (!pushRef.current) return;
    setBusyKey(room.key);
    setError(undefined);
    try {
      const chatId = await createGatedGroup(pushRef.current, room, address);
      // Publish to the registry (Vercel KV) → live instantly, no redeploy. If the
      // registry isn't configured, fall back to the manual env-var instructions.
      let published = false;
      if (walletClient) {
        try {
          await saveRoomChatId({ walletClient, account: address, roomKey: room.key, chatId });
          setSaved((s) => ({ ...s, [room.key]: true }));
          qc.invalidateQueries({ queryKey: ["room-registry"] });
          published = true;
        } catch {
          /* registry not configured / save failed → env fallback below */
        }
      }
      if (!published) setCreated((c) => ({ ...c, [room.key]: chatId }));
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusyKey(undefined);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Community rooms</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Create a gated Push group for each BGOV tier and each bittrees.eth subname (gated to its
          Safe's signers &amp; proposers). Creating a room publishes it to the registry and it goes live
          in <Link to={ROUTES.messenger} style={{ color: "var(--color-primary-hover)" }}>Chat</Link>{" "}
          immediately — no redeploy. (If the registry isn't configured, you'll get an env-var line to set instead.)
          Every room is created with{" "}
          {ROOM_ADMINS.map((a, i) => (
            <span key={a}>
              {i > 0 ? ", " : ""}
              <code style={mono}>{shortAddress(a)}</code>
            </span>
          ))}{" "}
          as a standing admin (manages members &amp; roles).
        </p>
      </div>

      {status !== "ready" ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Enabling asks for a one-time signature (no gas).</p>
          <button className="btn-primary" disabled={status === "enabling"} onClick={enable} style={{ opacity: status === "enabling" ? 0.6 : 1 }}>
            {status === "enabling" ? "Confirm in wallet…" : "Enable room creation"}
          </button>
          {status === "error" && error && <span role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</span>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {rooms.map((room) => {
            const newId = created[room.key];
            const justSaved = saved[room.key];
            const live = !!room.chatId || justSaved;
            return (
              <div key={room.key} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>{room.name}</p>
                    <p style={{ ...dim, margin: "0.15rem 0 0" }}>Gate: {gateLabel(room.gate)}</p>
                  </div>
                  {live ? (
                    <span style={{ ...dim, color: "var(--color-secondary)" }}>{justSaved ? "Live ✓ (published)" : "Live"}</span>
                  ) : (
                    <button onClick={() => create(room)} disabled={!!busyKey} style={createBtn}>
                      {busyKey === room.key ? "Creating…" : "Create room"}
                    </button>
                  )}
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-ink-dim)", margin: 0, wordBreak: "break-all" }}>
                  {gateUrl(room)}
                </p>
                {newId && (
                  <div style={{ background: "var(--color-bg-subtle)", borderRadius: "4px", padding: "0.5rem 0.65rem" }}>
                    <p style={{ ...dim, margin: 0 }}>Created ✓ — registry not configured, so set this env var and redeploy:</p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--color-ink)", margin: "0.25rem 0 0", wordBreak: "break-all" }}>
                      {room.envKey}={newId}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</p>}
        </div>
      )}
      {status === "ready" && pushRef.current && <CustomRoomManager push={pushRef.current} address={address} />}
    </section>
  );
}

/* ── Custom rooms — admin-defined, with custom gatekeeping ────────────────── */
type RuleType = "erc20" | "erc721" | "safe" | "ens" | "bgov";
interface RuleDraft { type: RuleType; tier: string; safe: string; token: string; min: string; decimals: string; ens: string }
const emptyRule = (): RuleDraft => ({ type: "erc20", tier: "69", safe: "", token: "", min: "1", decimals: "18", ens: "" });
function toRule(d: RuleDraft): RoomRule | null {
  try {
    if (d.type === "bgov") return { kind: "bgov", tier: Math.max(0, Number(d.tier) || 0) };
    if (d.type === "safe") return isAddress(d.safe.trim()) ? { kind: "safe", safe: getAddress(d.safe.trim()) } : null;
    if (d.type === "ens") {
      const n = d.ens.trim().toLowerCase();
      if (!n) return { kind: "ens" }; // blank = any ENS name
      return /\./.test(n) ? { kind: "ens", name: n } : null;
    }
    if (d.type === "erc20") return isAddress(d.token.trim()) ? { kind: "token", standard: "erc20", token: getAddress(d.token.trim()), min: parseUnits(d.min.trim() || "0", Number(d.decimals) || 18).toString() } : null;
    return isAddress(d.token.trim()) ? { kind: "token", standard: "erc721", token: getAddress(d.token.trim()), min: String(Math.max(1, Math.floor(Number(d.min) || 1))) } : null;
  } catch {
    return null;
  }
}

function CustomRoomManager({ push, address }: { push: PushClient; address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const { data: registry } = useRoomRegistry();
  const qc = useQueryClient();
  const custom = registry?.custom ?? [];

  const [name, setName] = useState("");
  const [combine, setCombine] = useState<"any" | "all">("any");
  const [rules, setRules] = useState<RuleDraft[]>([emptyRule()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function setRule(i: number, patch: Partial<RuleDraft>) {
    setRules((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  const builtRules = rules.map(toRule).filter((r): r is RoomRule => !!r);
  const gate: RoomGate = { kind: "multi", combine, rules: builtRules };
  const canCreate = name.trim().length > 0 && builtRules.length > 0;

  async function create() {
    if (!walletClient || !canCreate) { setError("Add a room name and at least one valid rule."); return; }
    setBusy(true);
    setError(undefined);
    try {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "room";
      const key = `custom-${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const room: PushRoom = { key, name: name.trim().slice(0, 80), blurb: gateLabel(gate), gate };
      const chatId = await createGatedGroup(push, room, address);
      await saveCustomRoom({ walletClient, account: address, room: { ...room, chatId } });
      qc.invalidateQueries({ queryKey: ["room-registry"] });
      setName("");
      setRules([emptyRule()]);
      setCombine("any");
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(key: string) {
    if (!walletClient) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteCustomRoom({ walletClient, account: address, key });
      qc.invalidateQueries({ queryKey: ["room-registry"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.1rem" }}>
      <p className="text-label">Create a custom room</p>
      <p style={{ ...dim, margin: 0, lineHeight: 1.55 }}>
        Add any number of rooms with their own gate. Combine multiple rules — token / NFT holdings, a
        Safe's signers, an ENS name, or a BGOV threshold — with <strong>any</strong> (admit if any
        match) or <strong>all</strong> (must match every rule). Publishes to the registry and goes
        live in Chat immediately.
      </p>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" maxLength={80} style={inputStyle} />

        {rules.length > 1 && (
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", ...dim }}>
            Admit if
            <select value={combine} onChange={(e) => setCombine(e.target.value as "any" | "all")} style={{ ...inputStyle, width: "auto" }}>
              <option value="any">any</option>
              <option value="all">all</option>
            </select>
            of these match:
          </label>
        )}

        {rules.map((r, i) => (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <select value={r.type} onChange={(e) => setRule(i, { type: e.target.value as RuleType })} style={{ ...inputStyle, width: "auto" }}>
              <option value="erc20">Token (ERC-20)</option>
              <option value="erc721">NFT (ERC-721)</option>
              <option value="safe">Safe signers</option>
              <option value="ens">ENS name</option>
              <option value="bgov">BGOV</option>
            </select>
            {r.type === "bgov" && (
              <input value={r.tier} onChange={(e) => setRule(i, { tier: e.target.value })} type="number" min={0} placeholder="Min BGOV" style={{ ...inputStyle, width: "110px" }} />
            )}
            {r.type === "safe" && (
              <input value={r.safe} onChange={(e) => setRule(i, { safe: e.target.value })} placeholder="Safe 0x address" style={{ ...inputStyle, flex: 1, minWidth: "180px", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }} />
            )}
            {r.type === "ens" && (
              <input value={r.ens} onChange={(e) => setRule(i, { ens: e.target.value })} placeholder="name.eth — or blank for any ENS name" style={{ ...inputStyle, flex: 1, minWidth: "200px" }} />
            )}
            {(r.type === "erc20" || r.type === "erc721") && (
              <>
                <input value={r.token} onChange={(e) => setRule(i, { token: e.target.value })} placeholder="Token 0x address" style={{ ...inputStyle, flex: 1, minWidth: "160px", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }} />
                <input value={r.min} onChange={(e) => setRule(i, { min: e.target.value })} placeholder={r.type === "erc20" ? "Min amount" : "Min count"} style={{ ...inputStyle, width: "100px" }} />
                {r.type === "erc20" && (
                  <input value={r.decimals} onChange={(e) => setRule(i, { decimals: e.target.value })} type="number" min={0} title="Token decimals" placeholder="Dec" style={{ ...inputStyle, width: "80px" }} />
                )}
              </>
            )}
            {rules.length > 1 && (
              <button onClick={() => setRules((cur) => cur.filter((_, j) => j !== i))} aria-label="Remove rule" style={{ background: "none", border: "none", cursor: "pointer", color: "#9a2a2a", fontSize: "1rem", lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
        ))}

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={() => setRules((cur) => [...cur, emptyRule()])} style={createBtn}>+ Add rule</button>
          <button className="btn-primary" disabled={!canCreate || busy} onClick={create} style={{ opacity: !canCreate || busy ? 0.55 : 1 }}>
            {busy ? "Creating…" : "Create & publish"}
          </button>
        </div>
        {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{error}</p>}
      </div>

      {custom.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {custom.map((r) => (
            <div key={r.key} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>{r.name}</p>
                <p style={{ ...dim, margin: "0.15rem 0 0" }}>{r.blurb}</p>
              </div>
              <button onClick={() => remove(r.key)} disabled={busy} style={{ ...createBtn, color: "#9a2a2a", borderColor: "#e2b8b8" }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Roles & tags — create a role catalog, then assign from a dropdown ──────── */
const roleBadge = (label: string, color?: string) => ({
  fontFamily: "var(--font-sans)", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase" as const,
  letterSpacing: "0.06em", color: color || "var(--color-secondary)",
  border: `1px solid ${color || "var(--color-secondary)"}`, borderRadius: "999px", padding: "0.05rem 0.4rem",
});

function RolesAdmin({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const { data: community } = useCommunity();
  const roles = community?.roles;
  const roledefs = community?.roledefs;
  const qc = useQueryClient();

  // assign-an-existing-role
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState(""); // the selected role's label
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // create-a-new-role
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3A923A");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  const options = selectableRoles(roledefs);
  const selected = options.find((o) => o.label === label);
  const canAssign = isAddress(target.trim()) && !!selected;

  async function assign() {
    if (!walletClient || !selected || !isAddress(target.trim())) { setError("Pick a role and enter a valid address."); return; }
    setBusy(true);
    setError(undefined);
    try {
      await assignRole({ walletClient, account: address, target: getAddress(target.trim()), label: selected.label, color: selected.color });
      qc.invalidateQueries({ queryKey: ["community"] });
      setTarget("");
      setLabel("");
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(addr: string, lbl: string) {
    if (!walletClient) return;
    setBusy(true);
    setError(undefined);
    try {
      await unassignRole({ walletClient, account: address, target: addr, label: lbl });
      qc.invalidateQueries({ queryKey: ["community"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!walletClient || newLabel.trim().length === 0) { setCreateError("Enter a role name."); return; }
    setCreating(true);
    setCreateError(undefined);
    try {
      await createRole({ walletClient, account: address, label: newLabel.trim(), color: newColor, description: newDesc.trim() });
      qc.invalidateQueries({ queryKey: ["community"] });
      setNewLabel("");
      setNewDesc("");
      setNewColor("#3A923A");
    } catch (e) {
      setCreateError(humanError(e));
    } finally {
      setCreating(false);
    }
  }
  async function destroy(lbl: string) {
    if (!walletClient) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      await deleteRole({ walletClient, account: address, label: lbl });
      qc.invalidateQueries({ queryKey: ["community"] });
    } catch (e) {
      setCreateError(humanError(e));
    } finally {
      setCreating(false);
    }
  }

  const entries = Object.entries(roles ?? {});

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Roles &amp; tags</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          First <strong>create a role</strong> (a reusable label + colour), then <strong>assign</strong> it to an
          address — it shows as a badge next to their posts in the forum and messages in chat, alongside the
          automatic BGOV tier (Partner / Junior Partner / Associate / Shareholder). Needs the registry (Vercel KV) connected.
        </p>
      </div>

      {/* 1 ─ Create a role (the catalog) */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p className="text-label" style={{ margin: 0 }}>Create a role</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Role name (e.g. Core, Treasury)" maxLength={32} style={{ ...inputStyle, width: "210px" }} />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} title="Badge colour" style={{ width: "40px", height: "34px", border: "1px solid var(--color-border)", borderRadius: "2px", background: "#fff", cursor: "pointer", padding: 0 }} />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What it's for (optional)" maxLength={200} style={{ ...inputStyle, flex: 1, minWidth: "200px" }} />
          <button className="btn-primary" disabled={creating || newLabel.trim().length === 0} onClick={create} style={{ opacity: creating || newLabel.trim().length === 0 ? 0.55 : 1 }}>
            {creating ? "Saving…" : "Create role"}
          </button>
        </div>
        {createError && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{createError}</p>}

        {/* the catalog — built-ins (locked) + created roles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.2rem" }}>
          {options.map((o) => (
            <div key={o.label} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span style={roleBadge(o.label, o.color)}>{o.label}</span>
              {o.description && <span style={{ ...dim, margin: 0 }}>{o.description}</span>}
              {o.locked
                ? <span style={{ ...dim, margin: 0, fontStyle: "italic" }}>built-in</span>
                : <button onClick={() => destroy(o.label)} disabled={creating} aria-label={`Delete role ${o.label}`} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a2a2a", fontSize: "0.78rem", padding: 0 }}>Delete</button>}
            </div>
          ))}
        </div>
        <p style={{ ...dim, margin: 0 }}>Deleting a role also removes it from everyone it was assigned to. <code style={mono}>operations</code> + <code style={mono}>moderator</code> are built in and carry powers.</p>
      </div>

      {/* 2 ─ Assign a role (dropdown of created + built-in roles) */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p className="text-label" style={{ margin: 0 }}>Assign a role</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x address" style={{ ...inputStyle, flex: 1, minWidth: "220px", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }} />
          <select value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...inputStyle, width: "210px" }}>
            <option value="">Select a role…</option>
            {options.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          <span aria-hidden style={{ width: "34px", height: "34px", borderRadius: "2px", border: "1px solid var(--color-border)", background: selected?.color || "transparent" }} title={selected ? `${selected.label} colour` : "role colour"} />
          <button className="btn-primary" disabled={!canAssign || busy} onClick={assign} style={{ opacity: !canAssign || busy ? 0.55 : 1 }}>
            {busy ? "Saving…" : "Assign"}
          </button>
        </div>
        {options.length === 0 && <p style={{ ...dim, margin: 0 }}>No roles yet — create one above first.</p>}
        {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{error}</p>}
      </div>

      {/* 3 ─ Reference: automatic BGOV tiers */}
      <div className="card" style={{ background: "var(--color-bg-subtle)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <p className="text-label" style={{ margin: 0 }}>Automatic tiers</p>
        <p style={{ ...dim, margin: 0, lineHeight: 1.55 }}>
          Shown automatically by BGOV held — no assignment needed:{" "}
          {TIER_THRESHOLDS.map((t, i) => (
            <span key={t.label}>{i > 0 ? " · " : ""}{t.label} ≥{t.min}</span>
          ))}.
        </p>
      </div>

      {entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {entries.map(([addr, list]) => (
            <div key={addr} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--color-ink-muted)" }}>{shortAddress(addr)}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                {list.map((r) => (
                  <span key={r.label} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: r.color || "var(--color-secondary)", border: `1px solid ${r.color || "var(--color-secondary)"}`, borderRadius: "999px", padding: "0.05rem 0.4rem" }}>{r.label}</span>
                    <button onClick={() => remove(addr, r.label)} disabled={busy} aria-label={`Remove ${r.label}`} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a2a2a", fontSize: "0.9rem", lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Moderation queue — community-flagged posts/messages ──────────────────── */
function ModerationQueue({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const { data: community } = useCommunity();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const flags = community?.flags ?? {};
  const threshold = community?.threshold ?? 2;
  const entries = Object.entries(flags);

  async function act(id: string, action: "approve" | "remove" | "clear") {
    if (!walletClient) return;
    setBusy(id + action);
    setError(undefined);
    try {
      await moderateItem({ walletClient, account: address, id, action });
      qc.invalidateQueries({ queryKey: ["community"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Moderation</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Posts and messages flagged by shareholders. Content auto-hides once {threshold} distinct
          shareholders flag it — approve to restore it, remove to keep it hidden, or clear the flags.
        </p>
      </div>
      {entries.length === 0 ? (
        <div className="card"><p style={{ ...dim, margin: 0 }}>Nothing flagged.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {entries.map(([id, rec]) => {
            const hidden = rec.mod === "removed" || (rec.mod !== "approved" && rec.by.length >= threshold);
            const status = rec.mod === "approved" ? "approved" : rec.mod === "removed" ? "removed" : hidden ? "hidden" : "flagged";
            return (
              <div key={id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span style={{ ...dim }}>
                    {rec.surface || "item"} · {rec.by.length} flag{rec.by.length === 1 ? "" : "s"} ·{" "}
                    <strong style={{ color: hidden ? "#9a2a2a" : "var(--color-ink-muted)" }}>{status}</strong>
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button onClick={() => act(id, "approve")} disabled={!!busy} style={createBtn}>Approve</button>
                    <button onClick={() => act(id, "remove")} disabled={!!busy} style={{ ...createBtn, color: "#9a2a2a", borderColor: "#e2b8b8" }}>Remove</button>
                    <button onClick={() => act(id, "clear")} disabled={!!busy} style={{ ...createBtn, color: "var(--color-ink-dim)", borderColor: "var(--color-border)" }}>Clear</button>
                  </div>
                </div>
                {rec.preview && (
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{rec.preview}</p>
                )}
                {rec.surface === "forum" && (
                  <a href={`${EASSCAN_VIEW}${id}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-primary-hover)", textDecoration: "none" }}>
                    View full post ↗
                  </a>
                )}
              </div>
            );
          })}
          {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</p>}
        </div>
      )}
    </section>
  );
}

/* ── Contributor applications (on-chain, EAS on Base) ─────────────────────── */
function ContributorApplications() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: posts, isLoading, isError } = useTopics(CONTRIB_COMMUNITY);
  const [kp, setKp] = useState<EncKeypair | null>(null);
  const [status, setStatus] = useState<"idle" | "enabling">("idle");
  const [error, setError] = useState<string>();

  async function enable() {
    if (!walletClient || !address) return;
    setStatus("enabling");
    setError(undefined);
    try {
      const keypair = await deriveEncKeypair(walletClient, address);
      await publishEncKey({ walletClient, account: address, pubkey: pubKeyHex(keypair.publicKey) });
      setKp(keypair);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setStatus("idle");
    }
  }

  const decoded = (posts ?? []).map((p) => {
    let app: Application | null = null;
    if (kp && address) {
      try {
        const json = decryptApplication(JSON.parse(p.body) as Envelope, address, kp.secretKey);
        app = json ? (JSON.parse(json) as Application) : null;
      } catch { app = null; }
    }
    return { id: p.id, time: p.time, attester: p.attester, app };
  });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Contributor applications</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Applications from <Link to={ROUTES.contribute} style={{ color: "var(--color-primary-hover)" }}>Become a contributor</Link>{" "}
          are <strong>on-chain (Base) but encrypted</strong>. Enable decryption to derive your key (and
          publish it so new applicants encrypt to you), then read the ones you're a recipient of —
          requires the <code style={mono}>operations</code> role.
        </p>
      </div>
      <div>
        <button className="btn-primary" onClick={enable} disabled={status === "enabling"} style={{ opacity: status === "enabling" ? 0.6 : 1 }}>
          {status === "enabling" ? "Confirm in wallet…" : kp ? "Re-publish decryption key" : "Enable decryption"}
        </button>
        {error && <span role="alert" style={{ ...dim, color: "var(--color-ink)", marginLeft: "0.85rem" }}>{error}</span>}
      </div>

      {isLoading ? (
        <p style={dim}>Loading applications…</p>
      ) : isError ? (
        <p style={dim}>Couldn't reach the on-chain indexer right now.</p>
      ) : decoded.length === 0 ? (
        <div className="card"><p style={{ ...dim, margin: 0 }}>No applications yet.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {decoded.map((d) => (
            <div key={d.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
                  {d.app ? `${d.app.name || "Applicant"}${d.app.expertise?.length ? ` · ${d.app.expertise.join(", ")}` : ""}` : "🔒 Encrypted"}
                </p>
                <span style={{ ...dim, fontSize: "0.72rem" }}>{relativeTime(d.time)}</span>
              </div>
              {d.app ? (
                <>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{d.app.specialty}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-ink-dim)" }}>
                    {d.app.region?.length ? <span>Region: {d.app.region.join(", ")}</span> : null}
                    {d.app.languages?.length ? <span>Languages: {d.app.languages.join(", ")}</span> : null}
                    {d.app.email ? <span>Email: {d.app.email}</span> : null}
                    {d.app.twitter ? <span>X: {d.app.twitter}</span> : null}
                    {d.app.telegram ? <span>TG: {d.app.telegram}</span> : null}
                    {d.app.heardFrom ? <span>Heard via: {d.app.heardFrom}</span> : null}
                    {d.app.referrer ? <span>Referred by: {d.app.referrer}</span> : null}
                    {d.app.wallet ? <span style={{ fontFamily: "var(--font-mono)" }}>BTREE: {shortAddress(d.app.wallet)}</span> : null}
                  </div>
                </>
              ) : (
                <p style={{ ...dim, margin: 0 }}>{kp ? "You're not a recipient (submitted before you enabled decryption)." : "Enable decryption to read this."}</p>
              )}
              <a href={`${EASSCAN_VIEW}${d.id}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--color-ink-dim)", textDecoration: "none" }}>
                {shortAddress(d.attester)} · on-chain ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── shared ──────────────────────────────────────────────────────────────── */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <span className="text-label" style={{ margin: 0 }}>{label}</span>
      {children}
    </label>
  );
}

function secToDays(sec: unknown): number {
  const n = Number(sec ?? 0);
  return Number.isFinite(n) ? Math.round((n / 86400) * 100) / 100 : 0;
}
function daysToSec(days: string): number {
  return Math.round((Number(days) || 0) * 86400);
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.875rem",
  color: "var(--color-ink)",
  background: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: "2px",
  boxSizing: "border-box" as const,
};
const createBtn = {
  padding: "0.4rem 0.9rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "var(--color-ink)",
  background: "#ffffff",
  border: "1px solid var(--color-primary)",
  borderRadius: "2px",
  cursor: "pointer",
} as const;
const mono = { fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--color-ink-muted)" } as const;
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-dim)" } as const;
