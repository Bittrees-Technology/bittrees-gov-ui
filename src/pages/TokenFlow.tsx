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

type Disc = { cx: number; cy: number; r: number };

// Layout — every node placed once; arrows derive their endpoints from these.
const N = {
  contrib: { cx: 620, cy: 180, r: 70 },
  business: { cx: 476, cy: 384, r: 64 },
  tech: { cx: 620, cy: 384, r: 64 },
  community: { cx: 764, cy: 384, r: 64 },
  inc: { cx: 620, cy: 588, r: 94 },
  revenue: { cx: 168, cy: 588, r: 84 },
  capital: { cx: 1072, cy: 588, r: 84 },
  br: { cx: 476, cy: 788, r: 66 },
  extra: { cx: 764, cy: 788, r: 66 },
} satisfies Record<string, Disc>;

/** Point on `a`'s circumference pointing toward (px,py) — so connectors meet the edge. */
function edgeToward(a: Disc, px: number, py: number): [number, number] {
  const dx = px - a.cx;
  const dy = py - a.cy;
  const d = Math.hypot(dx, dy) || 1;
  return [a.cx + (dx / d) * a.r, a.cy + (dy / d) * a.r];
}
const edge = (a: Disc, b: Disc): [number, number] => edgeToward(a, b.cx, b.cy);
const mid = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];

/** A connector from `from` to `to` bowed through control point `cp`. Used for the long
 *  Revenue/Capital → Contributors lines so they arc outside the B.T.C. group bubbles
 *  instead of passing underneath them. */
function curvePath(from: Disc, to: Disc, cp: [number, number]): string {
  const [sx, sy] = edgeToward(from, cp[0], cp[1]);
  const [ex, ey] = edgeToward(to, cp[0], cp[1]);
  return `M ${sx} ${sy} Q ${cp[0]} ${cp[1]} ${ex} ${ey}`;
}

interface BubbleProps {
  node: Disc;
  fill: string;
  color: string;
  lines: string[];
  size: number;
  bold?: boolean;
  sub?: string[];
}

/** A labelled circle node, with optional small sub-text beneath the label. */
function Bubble({ node, fill, color, lines, size, bold, sub }: BubbleProps) {
  const { cx, cy, r } = node;
  const lh = size * 1.05;
  const hasSub = !!sub?.length;
  const mainCenter = hasSub ? cy - size * 0.7 : cy;
  const firstMain = mainCenter - ((lines.length - 1) * lh) / 2;
  const subSize = 11;
  const subLh = subSize * 1.18;
  const firstSub = mainCenter + ((lines.length - 1) * lh) / 2 + size + 2;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} filter="url(#nodeShadow)" />
      <text textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-serif)", fontSize: size, fontWeight: bold ? 700 : 400, fill: color }}>
        {lines.map((l, i) => (
          <tspan key={i} x={cx} y={firstMain + i * lh}>{l}</tspan>
        ))}
      </text>
      {hasSub && (
        <text textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-sans)", fontSize: subSize, fill: color, opacity: 0.92 }}>
          {sub!.map((l, i) => (
            <tspan key={i} x={cx} y={firstSub + i * subLh}>{l}</tspan>
          ))}
        </text>
      )}
    </g>
  );
}

/** A small green badge that labels a flow (e.g. "1/3 Rev"). */
function Pill({ at, text }: { at: [number, number]; text: string }) {
  const [cx, cy] = at;
  const w = text.length * 6 + 20;
  return (
    <g>
      <rect x={cx - w / 2} y={cy - 11} width={w} height={22} rx={11} fill={GREEN_DARK} />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, fontWeight: 600, fill: WHITE }}>
        {text}
      </text>
    </g>
  );
}

function FlowDiagram() {
  // Straight connectors (endpoints computed against the circle edges). The two long
  // Revenue/Capital → Contributors lines are drawn separately as curves (below) so they
  // arc outside the B.T.C. group bubbles rather than passing underneath them.
  const flows: [Disc, Disc][] = [
    [N.revenue, N.inc], [N.capital, N.inc],
    [N.inc, N.business], [N.inc, N.tech], [N.inc, N.community],
    [N.business, N.contrib], [N.tech, N.contrib], [N.community, N.contrib],
    [N.inc, N.br], [N.inc, N.extra],
  ];
  const CP_L: [number, number] = [340, 320]; // bows Revenue → Contributors left of Business
  const CP_R: [number, number] = [900, 320]; // bows Capital → Contributors right of Community

  return (
    <svg viewBox="0 0 1240 980" width="100%" height="auto" role="img" aria-label="Bittrees revenue and token flow" style={{ display: "block" }}>
      <title>Bittrees Revenue and Token Flow</title>
      <desc>
        Revenue and Bittrees Capital flow into Bittrees, Inc., which splits one-third of revenue to the Business, Technology and Community
        groups, one-third to BR, and one-third to Extra Funds. The groups, Revenue and Bittrees Capital all flow up to Bittrees Contributors.
      </desc>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={LINE} />
        </marker>
        <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000000" floodOpacity="0.16" />
        </filter>
      </defs>

      {/* ── Connectors (drawn first so nodes sit on top of the endpoints) ── */}
      {flows.map(([a, b], i) => {
        const [x1, y1] = edge(a, b);
        const [x2, y2] = edge(b, a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} strokeWidth={1.8} markerEnd="url(#arrow)" />;
      })}
      <path d={curvePath(N.revenue, N.contrib, CP_L)} fill="none" stroke={LINE} strokeWidth={1.8} markerEnd="url(#arrow)" />
      <path d={curvePath(N.capital, N.contrib, CP_R)} fill="none" stroke={LINE} strokeWidth={1.8} markerEnd="url(#arrow)" />

      {/* ── Nodes ── */}
      <Bubble node={N.contrib} fill={GREEN_LIGHT} color={INK} size={18} lines={["Bittrees", "Contributors"]} />
      <Bubble node={N.business} fill={GREEN} color={WHITE} size={18} lines={["Business"]} />
      <Bubble node={N.tech} fill={GREEN} color={WHITE} size={18} lines={["Technology"]} />
      <Bubble node={N.community} fill={GREEN} color={WHITE} size={18} lines={["Community"]} />
      <Bubble node={N.inc} fill={GREEN_DARK} color={WHITE} size={25} bold lines={["Bittrees, Inc."]} />
      <Bubble node={N.revenue} fill={ORANGE} color={INK} size={22} lines={["Revenue"]} />
      <Bubble node={N.capital} fill={ORANGE} color={INK} size={20} lines={["Bittrees", "Capital"]} />
      <Bubble node={N.br} fill={GREEN} color={WHITE} size={24} lines={["BR"]} />
      <Bubble node={N.extra} fill={GREEN} color={WHITE} size={18} lines={["Extra", "Funds"]} sub={["Allocation to be voted", "on by proposals"]} />

      {/* ── Flow badges ── */}
      <Pill at={mid(edge(N.inc, N.tech), edge(N.tech, N.inc))} text="1/3 Rev to B.T.C. groups" />
      <Pill at={mid(edge(N.inc, N.br), edge(N.br, N.inc))} text="1/3 Rev" />
      <Pill at={mid(edge(N.inc, N.extra), edge(N.extra, N.inc))} text="1/3 Rev" />

      {/* ── Legend (bottom-left, as in the original) ── */}
      <text x={46} y={862} style={{ fontFamily: "var(--font-serif)", fontSize: 18, fill: INK }}>Each group has its own</text>
      {["Multisig", "Budget", "Leaders", "Contributors"].map((item, i) => (
        <text key={item} x={60} y={890 + i * 24} style={{ fontFamily: "var(--font-serif)", fontSize: 16, fill: INK }}>
          <tspan fill={LINE}>–</tspan>
          <tspan dx={12}>{item}</tspan>
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

      <div className="card" style={{ padding: "2rem 1.75rem" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <FlowDiagram />
        </div>
      </div>
    </div>
  );
}
