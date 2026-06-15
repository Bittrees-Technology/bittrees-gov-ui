/**
 * /69420 — the Bittrees revenue & token-flow diagram. Carried over from the legacy
 * gov site (its TokenFlowPage at the same path). The original was a low-res raster
 * export; this redraws the exact same structure, flow and language as a crisp,
 * resolution-independent SVG in the refreshed brand palette (orange --color-primary
 * for Revenue/Capital, the brand greens for the org, Times/Tinos serif labels).
 */

// Brand tokens (resolved live from index.css so the diagram tracks the theme).
const ORANGE = "var(--color-primary)"; // Revenue, Bittrees Capital
const GREEN = "var(--color-secondary)"; // sub-DAO groups, BR, Extra Funds
const GREEN_DARK = "var(--color-secondary-hover)"; // Bittrees, Inc. + pill badges
const GREEN_LIGHT = "#8CC68C"; // Bittrees Contributors
const INK = "var(--color-ink)";
const LINE = "var(--color-ink-muted)";
const WHITE = "#FFFFFF";

interface BubbleProps {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  color: string;
  lines: string[];
  size: number;
  bold?: boolean;
  sub?: string[];
}

/** A labelled circle node, with optional small sub-text beneath the label. */
function Bubble({ cx, cy, r, fill, color, lines, size, bold, sub }: BubbleProps) {
  const lh = size * 1.04;
  const hasSub = !!sub?.length;
  const mainCenter = hasSub ? cy - 11 : cy;
  const firstMain = mainCenter - ((lines.length - 1) * lh) / 2;
  const subSize = 9;
  const subLh = subSize * 1.2;
  const firstSub = mainCenter + ((lines.length - 1) * lh) / 2 + 15;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} filter="url(#nodeShadow)" />
      <text textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-serif)", fontSize: size, fontWeight: bold ? 700 : 400, fill: color }}>
        {lines.map((l, i) => (
          <tspan key={i} x={cx} y={firstMain + i * lh}>{l}</tspan>
        ))}
      </text>
      {hasSub && (
        <text textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-sans)", fontSize: subSize, fill: color, opacity: 0.9 }}>
          {sub!.map((l, i) => (
            <tspan key={i} x={cx} y={firstSub + i * subLh}>{l}</tspan>
          ))}
        </text>
      )}
    </g>
  );
}

/** A straight connector with an arrowhead at (x2,y2). */
function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} strokeWidth={1.6} markerEnd="url(#arrow)" />;
}

/** A small green badge that labels a flow (e.g. "1/3 Rev"). */
function Pill({ cx, cy, text }: { cx: number; cy: number; text: string }) {
  const w = text.length * 5.3 + 16;
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 9} width={w} height={18} rx={9} fill={GREEN_DARK} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-sans)", fontSize: 10, fontWeight: 600, fill: WHITE }}>
        {text}
      </text>
    </g>
  );
}

function FlowDiagram() {
  return (
    <svg viewBox="0 0 1180 900" width="100%" height="auto" role="img" aria-label="Bittrees revenue and token flow" style={{ display: "block" }}>
      <title>Bittrees Revenue and Token Flow</title>
      <desc>
        Revenue and Bittrees Capital flow into Bittrees, Inc., which splits one-third of revenue to the Business, Technology and Community
        groups, one-third to BR, and one-third to Extra Funds. The groups, Revenue and Bittrees Capital all flow up to Bittrees Contributors.
      </desc>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={LINE} />
        </marker>
        <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* ── Connectors (drawn first so nodes sit on top of the endpoints) ── */}
      {/* Revenue → Inc ; Capital → Inc */}
      <Arrow x1={239} y1={545} x2={508} y2={545} />
      <Arrow x1={941} y1={545} x2={672} y2={545} />
      {/* Inc → Business / Technology / Community */}
      <Arrow x1={545.7} y1={476} x2={499.3} y2={403.8} />
      <Arrow x1={590} y1={463} x2={590} y2={413} />
      <Arrow x1={634.3} y1={476} x2={680.7} y2={403.8} />
      {/* Business / Technology / Community → Contributors */}
      <Arrow x1={499.9} y1={306.6} x2={554.8} y2={223.4} />
      <Arrow x1={590} y1={297} x2={590} y2={234} />
      <Arrow x1={680.1} y1={306.6} x2={625.2} y2={223.4} />
      {/* Revenue → Contributors ; Capital → Contributors */}
      <Arrow x1={220.5} y1={496} x2={542} y2={212.3} />
      <Arrow x1={959.5} y1={496} x2={638} y2={212.3} />
      {/* Inc → BR ; Inc → Extra Funds */}
      <Arrow x1={543.1} y1={612.3} x2={501.2} y2={672.4} />
      <Arrow x1={636.9} y1={612.3} x2={678.8} y2={672.4} />

      {/* ── Nodes ── */}
      <Bubble cx={590} cy={170} r={64} fill={GREEN_LIGHT} color={INK} size={16} lines={["Bittrees", "Contributors"]} />
      <Bubble cx={468} cy={355} r={58} fill={GREEN} color={WHITE} size={16} lines={["Business"]} />
      <Bubble cx={590} cy={355} r={58} fill={GREEN} color={WHITE} size={16} lines={["Technology"]} />
      <Bubble cx={712} cy={355} r={58} fill={GREEN} color={WHITE} size={16} lines={["Community"]} />
      <Bubble cx={590} cy={545} r={82} fill={GREEN_DARK} color={WHITE} size={22} bold lines={["Bittrees, Inc."]} />
      <Bubble cx={165} cy={545} r={74} fill={ORANGE} color={INK} size={19} lines={["Revenue"]} />
      <Bubble cx={1015} cy={545} r={74} fill={ORANGE} color={INK} size={17} lines={["Bittrees", "Capital"]} />
      <Bubble cx={468} cy={720} r={58} fill={GREEN} color={WHITE} size={20} lines={["BR"]} />
      <Bubble cx={712} cy={720} r={58} fill={GREEN} color={WHITE} size={16} lines={["Extra", "Funds"]} sub={["Allocation to be voted", "on by proposals"]} />

      {/* ── Flow badges ── */}
      <Pill cx={590} cy={438} text="1/3 Rev to B.T.C. groups" />
      <Pill cx={522.2} cy={642.4} text="1/3 Rev" />
      <Pill cx={657.9} cy={642.4} text="1/3 Rev" />

      {/* ── Legend (bottom-left, as in the original) ── */}
      <text x={40} y={792} style={{ fontFamily: "var(--font-serif)", fontSize: 16, fill: INK }}>Each group has its own</text>
      {["Multisig", "Budget", "Leaders", "Contributors"].map((item, i) => (
        <text key={item} x={52} y={816 + i * 21} style={{ fontFamily: "var(--font-serif)", fontSize: 15, fill: INK }}>
          <tspan fill={LINE}>–</tspan>
          <tspan dx={10}>{item}</tspan>
        </text>
      ))}
    </svg>
  );
}

export default function TokenFlow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Revenue &amp; Token Flow</h1>
      </header>

      <div className="card" style={{ padding: "1.75rem 1.5rem" }}>
        <div style={{ maxWidth: "1040px", margin: "0 auto" }}>
          <FlowDiagram />
        </div>
      </div>
    </div>
  );
}
