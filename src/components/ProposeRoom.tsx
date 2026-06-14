import { useState } from "react";
import { useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useCommunity, selectableRoles } from "../lib/community";
import { proposeRoom } from "../lib/rooms";
import { gateLabel } from "../lib/push";
import { useRoomGate, RoomGateBuilder } from "./RoomGateBuilder";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Could not submit the proposal";
}

/**
 * "Propose a room" — for holders of Operations / Partner / Junior Partner /
 * Associate (and full admins). Submits a name + gate to the pending queue; a full
 * admin reviews it in the Admin console and, on approval, the room goes live.
 */
export function ProposeRoom({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const { data: community } = useCommunity();
  const qc = useQueryClient();
  const roleOptions = selectableRoles(community?.roledefs);
  const gb = useRoomGate();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string>();
  const canSubmit = name.trim().length > 0 && gb.valid;

  async function submit() {
    if (!walletClient || !canSubmit) return;
    setStatus("submitting");
    setError(undefined);
    try {
      await proposeRoom({ walletClient, account: address, name: name.trim().slice(0, 80), blurb: gateLabel(gb.gate), gate: gb.gate });
      qc.invalidateQueries({ queryKey: ["room-registry"] });
      setName("");
      gb.reset();
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.1rem" }}>
      <p className="text-label">Propose a room</p>
      <p style={{ ...dim, margin: 0, lineHeight: 1.55 }}>
        Suggest a community room and its access rules. A Bittrees admin reviews it; once approved, the
        room is created and goes live in Chat.
      </p>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" maxLength={80} style={inputStyle} />
        <RoomGateBuilder gate={gb} roleOptions={roleOptions} />
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn-primary" disabled={!canSubmit || status === "submitting"} onClick={submit} style={{ opacity: !canSubmit || status === "submitting" ? 0.55 : 1 }}>
            {status === "submitting" ? "Confirm in wallet…" : "Propose room"}
          </button>
          {status === "done" && <span style={{ ...dim, color: "var(--color-secondary)" }}>Proposed — an admin will review it. ✓</span>}
        </div>
        {status === "error" && error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{error}</p>}
      </div>
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
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-dim)" } as const;
