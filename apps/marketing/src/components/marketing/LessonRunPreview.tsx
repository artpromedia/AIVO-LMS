import Link from "next/link";
import { Container } from "./primitives/Container";
import { ProductMockupFrame } from "./primitives/ProductMockupFrame";

export function LessonRunPreview() {
  return (
    <section className="py-20 sm:py-24" aria-labelledby="lessonrun-heading">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <ProductMockupFrame title="LessonRun · Step 3 of 7" className="order-2 lg:order-1">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-iw-chip bg-iw-primary"
                  aria-hidden
                />
                <div>
                  <p className="text-xs font-semibold text-iw-ink-muted">Tutor</p>
                  <p className="font-heading text-sm font-bold text-iw-ink">Atlas</p>
                </div>
              </div>
              <div className="rounded-iw-card border border-iw-border bg-iw-raised/60 p-4">
                <p className="text-sm text-iw-ink">
                  Great work! Let's try one more. What is <span className="font-bold">3 × 4</span>?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[10, 12, 14, 9].map((n) => (
                  <div
                    key={n}
                    aria-hidden
                    className="rounded-lg border-2 border-iw-border bg-white py-2.5 text-center font-heading font-bold text-iw-ink"
                  >
                    {n}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-iw-primary">🔊 Read aloud</span>
                <span className="font-semibold text-iw-primary">💡 Hint</span>
                <span className="font-semibold text-iw-ink-muted">Break</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-iw-raised">
                <div
                  className="h-1.5 rounded-full bg-iw-primary"
                  style={{ width: "43%" }}
                />
              </div>
            </div>
          </ProductMockupFrame>

          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-iw-primary">
              LessonRun
            </p>
            <h2
              id="lessonrun-heading"
              className="mt-3 font-heading text-3xl sm:text-4xl font-bold text-iw-ink"
            >
              The personalized learning unit behind every AIVO lesson
            </h2>
            <p className="mt-4 text-lg text-iw-ink-muted">
              Tutor-guided. Step by step. With hints, scaffolds, read-aloud, and a built-in break
              mode — so learners stay in the zone, not in frustration.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "Tutor-guided learning",
                "Hints and scaffolds",
                "Read-aloud support",
                "Built-in break mode",
                "Mastery updates",
                "Parent-safe summaries",
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-iw-ink">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-iw-chip bg-iw-purple-100 text-xs text-iw-primary">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/tutors"
                className="inline-flex items-center gap-1 font-semibold text-iw-primary transition-all hover:gap-2"
              >
                Meet the 14 AIVO tutors <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
