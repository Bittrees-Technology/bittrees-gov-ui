import { GOV_LINKS } from "../lib/links";

/**
 * The Bittrees, Inc. Vision Statement — verbatim from the canonical statement
 * (adopted March 27, 2020). Only paragraph breaks differ; the wording is unchanged.
 */
export const VISION_PARAGRAPHS = [
  "Bittrees, Inc. envisions a world where individuals have access to the tools and resources needed to build and grow sustainable communities. Our mission is to empower individuals and organizations to collaborate, innovate, and create positive change through the use of cutting-edge technology and a commitment to environmental and social responsibility. We believe in a future where people can work together in harmony with nature, leveraging the power of decentralized networks to create a more equitable and just world.",
  "Through our platform, we strive to create a space for individuals to connect, share knowledge, and collaborate on innovative solutions to some of the world's most pressing challenges. Our focus on community-building and sustainability is at the heart of everything we do, and we are committed to ensuring that our work has a positive impact on both people and the planet.",
  "At Bittrees, Inc., we believe that by working together, we can create a world that is more connected, more equitable, and more sustainable for generations to come.",
];

export default function Vision() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "720px", margin: "0 auto", width: "100%" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Vision Statement</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-ink-dim)", marginTop: "0.5rem" }}>
          Adopted March 27, 2020
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {VISION_PARAGRAPHS.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.125rem",
              lineHeight: 1.7,
              color: "var(--color-ink)",
              margin: 0,
            }}
          >
            {p}
          </p>
        ))}
      </div>

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.78rem",
          color: "var(--color-ink-dim)",
          borderTop: "1px solid var(--color-border)",
          paddingTop: "1.25rem",
        }}
      >
        The canonical statement lives in the{" "}
        <a href={GOV_LINKS.wiki} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
          Bittrees, Inc. handbook ↗
        </a>
        .
      </p>
    </div>
  );
}
