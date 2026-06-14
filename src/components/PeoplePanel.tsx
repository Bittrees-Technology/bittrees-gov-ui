import { useState } from "react";
import { getAddress, isAddress } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import { getEnsAddress } from "@wagmi/core";
import { wagmiConfig } from "../lib/chains";
import { useCommunity } from "../lib/community";
import { useContacts, addContact, removeContact, isContact } from "../lib/contacts";
import { AddressName } from "./AddressName";
import { UserBadges } from "./badges";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Couldn't resolve that name";
}

/**
 * Contacts + a role-searchable directory. Save people (by 0x or ENS), find anyone
 * who holds a role by typing the role (or address), and start a DM in one click.
 */
export function PeoplePanel({ onMessage }: { onMessage: (address: string) => void }) {
  const { data: community } = useCommunity();
  const roles = community?.roles ?? {};
  const contacts = useContacts();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string>();

  const q = search.trim().toLowerCase();
  const matches = q
    ? Object.entries(roles)
        .filter(([addr, list]) => addr.toLowerCase().includes(q) || (list ?? []).some((r) => r.label.toLowerCase().includes(q)))
        .slice(0, 40)
    : [];

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

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <p className="text-label" style={{ margin: 0 }}>People</p>

      {/* Add a contact (0x or ENS) */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a contact — 0x address or name.eth"
          style={{ ...inputStyle, flex: 1, minWidth: "200px" }}
        />
        <button className="btn-primary" onClick={add} disabled={adding || !addInput.trim()} style={{ opacity: adding || !addInput.trim() ? 0.55 : 1, padding: "0.4rem 0.8rem", fontSize: "0.82rem" }}>
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      {err && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{err}</p>}

      {/* Saved contacts */}
      {contacts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <p style={{ ...dim, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.65rem" }}>Contacts</p>
          {contacts.map((c) => (
            <PersonRow key={c.address} address={c.address} onMessage={onMessage} saved onToggleContact={() => removeContact(c.address)} />
          ))}
        </div>
      )}

      {/* Role-searchable directory — a search dropdown, not a full list */}
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search people by role (e.g. Partner) or address"
          style={inputStyle}
        />
        {open && !!q && (
          // preventDefault on mousedown keeps the input focused so clicking a result
          // doesn't blur-close the dropdown before the click registers.
          <div
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 30, background: "#ffffff", border: "1px solid var(--color-border)", borderRadius: "2px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: "280px", overflowY: "auto", padding: "0 0.6rem" }}
          >
            {matches.length === 0 ? (
              <p style={{ ...dim, margin: 0, padding: "0.55rem 0.1rem" }}>No one matches “{search.trim()}”.</p>
            ) : (
              matches.map(([addr]) => (
                <PersonRow
                  key={addr}
                  address={addr}
                  onMessage={(a) => { onMessage(a); setSearch(""); setOpen(false); }}
                  saved={isContact(addr)}
                  onToggleContact={() => (isContact(addr) ? removeContact(addr) : addContact(getAddress(addr)))}
                />
              ))
            )}
          </div>
        )}
      </div>
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
