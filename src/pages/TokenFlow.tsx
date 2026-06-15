/**
 * /69420 — the Bittrees revenue & token-flow diagram. Carried over from the legacy
 * gov site (its TokenFlowPage at the same path), restyled to the refreshed brand.
 */
export default function TokenFlow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Revenue &amp; Token Flow</h1>
      </header>

      <div className="card" style={{ display: "flex", justifyContent: "center", padding: "1.25rem" }}>
        <img
          src="/revenue-and-token-flow.jpg"
          width={1280}
          height={929}
          alt="Bittrees Revenue and Token Flow"
          style={{ width: "100%", height: "auto", maxWidth: "1000px", display: "block" }}
        />
      </div>
    </div>
  );
}
