import Link from "next/link";

export const metadata = { title: "AIVO — Tier Theme Showcase" };

const TIERS = [
  {
    slug: "tiers/preview",
    name: "Soft Meadow",
    tagline: "K–5 · picture-book daylight",
    color: "#7C3AED",
    bg: "#FFFAEF",
    text: "#292F3D",
  },
  {
    slug: "tiers/preview?tier=MIDDLE",
    name: "Study Treehouse",
    tagline: "6–8 · Ghibli twilight discovery",
    color: "#FFB700",
    bg: "#1F1535",
    text: "#F5EBD8",
  },
  {
    slug: "tiers/preview?tier=HIGH",
    name: "Focus Studio",
    tagline: "9–12 · editorial calm",
    color: "#7C3AED",
    bg: "#F4EFE6",
    text: "#292F3D",
  },
];

export default function ShowcaseIndexPage() {
  return (
    <main style={{ minHeight: "100vh", padding: 48, background: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>AIVO — Tier Theme Showcase</h1>
      <p style={{ color: "#666", marginBottom: 32 }}>
        Internal QA preview of the three production age-tier themes. The active tier is auto-derived
        from a learner&rsquo;s grade level on every page under <code>/dashboard/learner/*</code>.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 1200 }}>
        {TIERS.map((d) => (
          <Link
            key={d.slug}
            href={`/showcase/${d.slug}`}
            style={{
              display: "block",
              background: d.bg,
              color: d.text,
              padding: 32,
              borderRadius: 16,
              textDecoration: "none",
              borderTop: `6px solid ${d.color}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{d.name}</div>
            <div style={{ opacity: 0.75 }}>{d.tagline}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
