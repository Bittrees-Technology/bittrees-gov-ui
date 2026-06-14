import { useMemo, useState } from "react";
import { getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import { getEnsAddress } from "@wagmi/core";
import { wagmiConfig } from "../lib/chains";
import { useCommunity, selectableRoles } from "../lib/community";
import { useVotingPowers } from "../lib/snapshot";
import { useContacts, addContact, removeContact, isContact } from "../lib/contacts";
import { AddressName } from "./AddressName";
import { UserBadges } from "./badges";

const SHAREHOLDER = "Shareholder";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Something went wrong";
}

/**
 * Contacts + a role picker. Choose a role from the dropdown (incl. Shareholder) to
 * list everyone who holds it, message any of them, save contacts, or message the
 * whole shown group at once.
 */
export function PeoplePanel({ onMessage, onBroadcast }: {
  onMessage: (address: string) => void;
  onBroadcast: (addresses: string[], text: string) => Promise<{ sent: number; skipped: number }>;
}) {
  const { data: community } = useCommunity();
  const roles = community?.roles ?? {};
  const contacts = useContacts();
  const roleOptions = selectableRoles(community?.roledefs);

  const [roleFilter, setRoleFilter] = useState(""); // "" = Contacts
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string>();

  const [bcastOpen, setBcastOpen] = useState(false);
  const [bcastText, setBcastText] = useState("");
  const [bcasting, setBcasting] = useState(false);
  const [bcastMsg, setBcastMsg] = useState<string>();

  // Everyone we know about: holders of any assigned role + saved contacts.
  const universe = useMemo(() => {
    const set = new Set<string>();
    Object.keys(roles).forEach((a) => set.add(a.toLowerCase()));
    contacts.forEach((c) => set.add(c.address.toLowerCase()));
    return [...set];
  }, [roles, contacts]);

  // Shareholder is BGOV-derived (not in the roles registry), so resolve holdings
  // for the known universe only when that filter is active.
  const needVp = roleFilter === SHAREHOLDER;
  const { data: vps, isLoading: vpLoading } = useVotingPowers(needVp ? universe : []);

  const shown: string[] = useMemo(() => {
    if (roleFilter === "") return contacts.map((c) => c.address);
    if (roleFilter === SHAREHOLDER) return universe.filter((a) => (vps?.[a] ?? 0) >= 1);
    return Object.entries(roles)
      .filter(([, list]) => (list ?? []).some((r) => r.label.toLowerCase() === roleFilter.toLowerCase()))
      .map(([a]) => a);
  }, [roleFilter, contacts, universe, vps, roles]);

  async function add() {
    const v = addInput.trim();
    if (!v) return;
    setAdding(true);
    setErr(undefined);
    try {
      let addr = v;
      if (v.includes(".")) {
        const resolved = await getEnsAddress(wagmiConfig, { name: normalize(v), chainId: mainnet.id });
        if (!resolved) throw new Error("That ENS name doesn't resolve to an address.");
        addr = resolved;
      }
      if (!isAddress(addr)) throw new Error("Enter a valid 0x address or ENS name.");
      addContact(getAddress(addr));
      setAddInput("");
    } catch (e) {
      setErr(humanError(e));
    } finally {
      setAdding(false);
    }
  }

  async function sendAll() {
    if (!bcastText.trim() || shown.length === 0) return;
    setBcasting(true);
    setBcastMsg(undefined);
    try {
      const { sent, skipped } = await onBroadcast(shown, bcastText.trim());
      setBcastMsg(`Sent to ${sent}${skipped ? ` · ${skipped} not on XMTP yet` : ""}.`);
      setBcastText("");
      setBcastOpen(false);
    } catch (e) {
      setBcastMsg(humanError(e));
    } finally {
      setBcasting(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p className="text-label" style={{ margin: 0 }}>People</p>

      {/* Add a contact (0x or ENS) */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <input value={addInput} onChange={(e) => setAddInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add — 0x or name.eth" style={{ ...inputStyle, flex: 1, minWidth: "150px" }} />
        <button className="btn-primary" onClick={add} disabled={adding || !addInput.trim()} style={{ opacity: adding || !addInput.trim() ? 0.55 : 1, padding: "0.4rem 0.8rem", fontSize: "0.82rem" }}>{adding ? "…" : "Add"}</button>
      </div>
      {err && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{err}</p>}

      {/* Pick who to show: contacts, shareholders, or a role */}
      <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setBcastOpen(false); setBcastMsg(undefined); }} style={inputStyle}>
        <option value="">Contacts ({contacts.length})</option>
        <option value={SHAREHOLDER}>Shareholders (≥1 BGOV)</option>
        {roleOptions.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
      </select>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", maxHeight: "300px", overflowY: "auto" }}>
        {needVp && vpLoading ? (
          <p style={{ ...dim, margin: 0 }}>Checking BGOV holdings…</p>
        ) : shown.length === 0 ? (
          <p style={{ ...dim, margin: 0 }}>{roleFilter === "" ? "No saved contacts yet — add one above." : "No one found for that role."}</p>
        ) : (
          shown.map((addr) => (
            <PersonRow key={addr} address={addr} onMessage={onMessage} saved={isContact(addr)} onToggleContact={() => (isContact(addr) ? removeContact(addr) : addContact(getAddress(addr)))} />
          ))
        )}
      </div>

      {/* Message everyone currently shown */}
      {shown.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", borderTop: "1px solid var(--color-border-light)", paddingTop: "0.6rem" }}>
          {!bcastOpen ? (
            <button onClick={() => { setBcastOpen(true); setBcastMsg(undefined); }} style={miniBtn}>✉ Message all ({shown.length})</button>
          ) : (
            <>
              <textarea value={bcastText} onChange={(e) => setBcastText(e.target.value)} placeholder={`One message to all ${shown.length} shown…`} rows={2} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn-primary" onClick={sendAll} disabled={bcasting || !bcastText.trim()} style={{ opacity: bcasting || !bcastText.trim() ? 0.55 : 1, padding: "0.4rem 0.8rem", fontSize: "0.82rem" }}>{bcasting ? "Sending…" : `Send to ${shown.length}`}</button>
                <button onClick={() => { setBcastOpen(false); setBcastText(""); }} style={miniBtn}>Cancel</button>
              </div>
            </>
          )}
          {bcastMsg && <p style={{ ...dim, margin: 0 }}>{bcastMsg}</p>}
        </div>
      )}
    </div>
  );
}

function PersonRow({ address, onMessage, saved, onToggleContact }: { address: string; onMessage: (a: string) => void; saved: boolean; onToggleContact: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap", padding: "0.35rem 0", borderBottom: "1px solid var(--color-border-light)" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", minWidth: 0, flexWrap: "wrap" }}>
        <AddressName address={address} avatar />
        <UserBadges address={address} />
      </span>
      <span style={{ display: "inline-flex", gap: "0.4rem", flexShrink: 0 }}>
        <button onClick={() => onMessage(address)} style={miniBtn}>Message</button>
        <button onClick={onToggleContact} title={saved ? "Remove contact" : "Save contact"} style={{ ...miniBtn, color: saved ? "#9a2a2a" : "var(--color-ink-muted)" }}>
          {saved ? "★" : "☆"}
        </button>
      </span>
    </div>
  );
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
const miniBtn = {
  padding: "0.25rem 0.6rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.78rem",
  fontWeight: 600,
  color: "var(--color-ink)",
  background: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: "2px",
  cursor: "pointer",
} as const;
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-ink-dim)" } as const;
