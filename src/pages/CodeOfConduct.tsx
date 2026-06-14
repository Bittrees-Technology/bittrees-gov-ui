import { GOV_LINKS } from "../lib/links";

/**
 * The Bittrees, Inc. community Code of Conduct. Faithful rendering of the ten
 * principles published in the handbook (bittrees.eth.limo/binc/coc); the
 * canonical copy is linked at the foot of the page.
 */
const PRINCIPLES: { title: string; body: string }[] = [
  { title: "Respect", body: "Treat fellow community members with respect and courtesy. Harassment, hate speech, and discrimination of any kind are not tolerated." },
  { title: "Stay on topic", body: "Keep conversations on topic and relevant to the channel. Off-topic discussion belongs in the appropriate place." },
  { title: "Self-promotion", body: "Excessive self-promotion is discouraged. Sharing relevant projects and work is welcome where it genuinely contributes to the conversation." },
  { title: "No spam", body: "Do not post irrelevant, repetitive, or excessive messages. Only post content that contributes to the community." },
  { title: "No trolling", body: "Do not engage in trolling — messages intended to provoke or offend others." },
  { title: "Be lawful and ethical", body: "Do not engage in any illegal or unethical behavior, including sharing copyrighted material without permission." },
  { title: "Inclusive language", body: "Avoid offensive or vulgar language. Use inclusive language and be mindful of others." },
  { title: "Privacy", body: "Do not share the personal information of community members without their consent." },
  { title: "Follow channel guidelines", body: "Follow any channel-specific guidelines in addition to this code." },
  { title: "Report violations", body: "If you see any violation of this code of conduct, report it to the moderators." },
];

export default function CodeOfConduct() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "720px" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Code of Conduct</h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            color: "var(--color-ink-muted)",
            lineHeight: 1.6,
            marginTop: "0.5rem",
          }}
        >
          These principles keep the Bittrees community safe and welcoming for everyone. They
          apply across every Bittrees channel — the forum, Telegram, the metaverse HQ, and on-chain.
        </p>
      </header>

      <ol style={{ listStyle: "none", counterReset: "coc", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {PRINCIPLES.map((p) => (
          <li
            key={p.title}
            className="card"
            style={{ counterIncrement: "coc", display: "flex", gap: "1rem", alignItems: "flex-start" }}
          >
            <span
              style={{
                flexShrink: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "var(--color-primary-hover)",
                minWidth: "1.5rem",
              }}
            >
              {String(PRINCIPLES.indexOf(p) + 1).padStart(2, "0")}
            </span>
            <div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
                {p.title}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-muted)", lineHeight: 1.55, margin: "0.2rem 0 0" }}>
                {p.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.78rem",
          color: "var(--color-ink-dim)",
          borderTop: "1px solid var(--color-border)",
          paddingTop: "1.25rem",
        }}
      >
        Canonical copy:{" "}
        <a href={`${GOV_LINKS.wiki}coc`} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
          handbook → Code of Conduct ↗
        </a>
        .
      </p>
    </div>
  );
}
