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
                  className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-500"
                  aria-hidden
                />
                <div>
                  <p className="text-xs font-semibold text-slate-500">Tutor</p>
                  <p className="font-heading text-sm font-bold text-slate-900">Atlas</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm text-slate-700">
                  Great work! Let's try one more. What is <span className="font-bold">3 × 4</span>?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[10, 12, 14, 9].map((n) => (
                  <div
                    key={n}
                    aria-hidden
                    className="rounded-lg border-2 border-slate-200 bg-white py-2.5 text-center font-heading font-bold text-slate-900"
                  >
                    {n}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-purple-700">🔊 Read aloud</span>
                <span className="font-semibold text-purple-700">💡 Hint</span>
                <span className="font-semibold text-slate-500">Break</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600"
                  style={{ width: "43%" }}
                />
              </div>
            </div>
          </ProductMockupFrame>

          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-purple-600">
              LessonRun
            </p>
            <h2
              id="lessonrun-heading"
              className="mt-3 font-heading text-3xl sm:text-4xl font-bold text-slate-900"
            >
              The personalized learning unit behind every AIVO lesson
            </h2>
            <p className="mt-4 text-lg text-slate-600">
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
                <li key={f} className="flex items-center gap-2 text-slate-700">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs text-purple-700">
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Link
                href="/tutors"
                className="inline-flex items-center gap-1 font-semibold text-purple-700 transition-all hover:gap-2"
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
