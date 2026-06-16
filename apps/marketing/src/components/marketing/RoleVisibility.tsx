import { Container } from "./primitives/Container";
import { SectionHeader } from "./primitives/SectionHeader";
import { ProductMockupFrame } from "./primitives/ProductMockupFrame";

export function RoleVisibility() {
  return (
    <section className="py-20 sm:py-24 bg-iw-raised/50" aria-labelledby="visibility-heading">
      <Container>
        <SectionHeader
          eyebrow="Clarity for every grown-up"
          title={<span id="visibility-heading">Parent progress, teacher visibility</span>}
          subtitle="Both sides see what matters — without exposing learners to numbers, labels, or pressure they shouldn't see."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <ProductMockupFrame title="Parent summary · This week">
            <h3 className="font-heading text-lg font-bold text-iw-ink">
              Maya had a strong week!
            </h3>
            <p className="mt-1 text-sm text-iw-ink-muted">
              5 of 5 missions completed. Focus areas adapted twice.
            </p>
            <div className="mt-4 space-y-3">
              {[
                { l: "Reading", s: "Steady progress", c: "from-iw-accent to-iw-accent" },
                {
                  l: "Math · Multiplication",
                  s: "Working through 3s",
                  c: "from-iw-primary to-iw-primary",
                },
                { l: "Read-aloud used", s: "12 minutes", c: "from-iw-success to-iw-success" },
              ].map((r) => (
                <div
                  key={r.l}
                  className="flex items-center gap-3 rounded-lg border border-iw-border bg-white p-3"
                >
                  <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${r.c}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-iw-ink">{r.l}</p>
                    <p className="text-xs text-iw-ink-muted">{r.s}</p>
                  </div>
                </div>
              ))}
            </div>
          </ProductMockupFrame>

          <ProductMockupFrame title="Teacher dashboard · Class 3B">
            <h3 className="font-heading text-lg font-bold text-iw-ink">
              22 learners · 18 active today
            </h3>
            <p className="mt-1 text-sm text-iw-ink-muted">3 learners may benefit from a check-in.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => {
                const flagged = i === 2 || i === 5 || i === 7;
                const tone = flagged
                  ? "bg-iw-warning-subtle text-iw-warning-strong"
                  : "bg-iw-success-subtle text-iw-success-strong";
                return (
                  <div key={i} className={`rounded-lg ${tone} p-3 text-center`}>
                    <p className="font-heading text-xs font-bold">L{i + 1}</p>
                    <p className="mt-0.5 text-[10px]">{flagged ? "Check in" : "On track"}</p>
                  </div>
                );
              })}
            </div>
          </ProductMockupFrame>
        </div>
      </Container>
    </section>
  );
}
