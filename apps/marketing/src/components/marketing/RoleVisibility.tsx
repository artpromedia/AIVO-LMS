import { Container } from "./primitives/Container";
import { SectionHeader } from "./primitives/SectionHeader";
import { ProductMockupFrame } from "./primitives/ProductMockupFrame";

export function RoleVisibility() {
  return (
    <section className="py-20 sm:py-24 bg-slate-50/50" aria-labelledby="visibility-heading">
      <Container>
        <SectionHeader
          eyebrow="Clarity for every grown-up"
          title={<span id="visibility-heading">Parent progress, teacher visibility</span>}
          subtitle="Both sides see what matters — without exposing learners to numbers, labels, or pressure they shouldn't see."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <ProductMockupFrame title="Parent summary · This week">
            <h3 className="font-heading text-lg font-bold text-slate-900">
              Maya had a strong week!
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              5 of 5 missions completed. Focus areas adapted twice.
            </p>
            <div className="mt-4 space-y-3">
              {[
                { l: "Reading", s: "Steady progress", c: "from-blue-500 to-cyan-500" },
                { l: "Math · Multiplication", s: "Working through 3s", c: "from-purple-500 to-pink-500" },
                { l: "Read-aloud used", s: "12 minutes", c: "from-emerald-500 to-teal-500" },
              ].map((r) => (
                <div
                  key={r.l}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${r.c}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{r.l}</p>
                    <p className="text-xs text-slate-500">{r.s}</p>
                  </div>
                </div>
              ))}
            </div>
          </ProductMockupFrame>

          <ProductMockupFrame title="Teacher dashboard · Class 3B">
            <h3 className="font-heading text-lg font-bold text-slate-900">
              22 learners · 18 active today
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              3 learners may benefit from a check-in.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => {
                const flagged = i === 2 || i === 5 || i === 7;
                const tone = flagged
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800";
                return (
                  <div key={i} className={`rounded-lg ${tone} p-3 text-center`}>
                    <p className="font-heading text-xs font-bold">L{i + 1}</p>
                    <p className="mt-0.5 text-[10px]">
                      {flagged ? "Check in" : "On track"}
                    </p>
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
