import { METAVERSE_HQ } from "../lib/links";

/** What the HQ is for — kept honest and concrete. */
const USES = [
  { title: "Governance gatherings", body: "Town halls and proposal discussions in a shared space, alongside the on-chain vote." },
  { title: "Showcase", body: "A persistent home for Bittrees technology, partners, and the things the subDAOs ship." },
  { title: "Community", body: "An open door for members, contributors, and the wider metaverse community to meet." },
];

export default function Metaverse() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Metaverse HQ</h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            color: "var(--color-ink-muted)",
            maxWidth: "640px",
            lineHeight: 1.6,
            marginTop: "0.5rem",
          }}
        >
          Bittrees, Inc. is a metaverse company deploying and growing technology in the digital
          space. Our headquarters is an on-chain parcel in {METAVERSE_HQ.world} — a browser-based
          world you can walk into directly.
        </p>
      </header>

      {/* HQ hero card */}
      <div
        className="card"
        style={{
          borderColor: "var(--color-primary)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1.5rem",
          padding: "1.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <PinGlyph />
          <div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
              Bittrees HQ
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-muted)", margin: "0.25rem 0 0" }}>
              {METAVERSE_HQ.world} · parcel{" "}
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink)" }}>{METAVERSE_HQ.coords}</span>
            </p>
          </div>
        </div>
        <a
          href={METAVERSE_HQ.url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary"
          style={{ textDecoration: "none", whiteSpace: "nowrap" }}
        >
          Enter the HQ ↗
        </a>
      </div>

      <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.78rem", color: "var(--color-ink-dim)", margin: "-0.75rem 0 0" }}>
        Opens in a new tab on voxels.com. Runs in the browser — no download required; connect a
        wallet there if you want to interact on-chain.
      </p>

      {/* What happens here */}
      <section style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        <p className="text-label">What happens here</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {USES.map((u) => (
            <div key={u.title} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
                {u.title}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", lineHeight: 1.55, margin: 0 }}>
                {u.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PinGlyph() {
  return (
    <div
      aria-hidden
      style={{
        width: 56,
        height: 56,
        flexShrink: 0,
        borderRadius: "14px",
        background: "var(--color-bg-subtle)",
        border: "1px solid var(--color-border-light)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z"
          stroke="var(--color-primary)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="10" r="2.4" stroke="var(--color-primary)" strokeWidth="1.6" />
      </svg>
    </div>
  );
}
