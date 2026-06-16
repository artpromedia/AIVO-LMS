import Link from "next/link";
import { Container } from "./primitives/Container";
import { ProductMockupFrame } from "./primitives/ProductMockupFrame";

export function TodaysMissionPreview() {
  return (
    <section
      className="py-20 sm:py-24 bg-gradient-to-br from-iw-purple-50/60 via-white to-iw-teal-50/40"
      aria-labelledby="mission-heading"
    >
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-iw-primary">
              Today's Mission
            </p>
            <h2
              id="mission-heading"
              className="mt-3 font-heading text-3xl sm:text-4xl font-bold text-iw-ink"
            >
              One clear next-best lesson, every day
            </h2>
            <p className="mt-4 text-lg text-iw-ink-muted">
              No endless dashboards. AIVO selects the single most important thing for your learner
              to do today — adapted to their level, energy, and accommodation context.
            </p>
            <ul className="mt-6 space-y-3 text-iw-ink">
              {[
                "Subject, tutor, goal, and estimated time at a glance",
                "One-tap start — no menu navigation required",
                "Visible to parents and teachers in plain language",
              ].map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-iw-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-iw-control bg-iw-primary px-6 py-3 font-semibold text-white shadow-soft-3 transition hover:bg-iw-primary-hover"
              >
                Request a demo
              </Link>
              <Link
                href="/levels"
                className="rounded-iw-control border border-iw-purple-200 bg-white px-6 py-3 font-semibold text-iw-primary transition hover:bg-iw-purple-100"
              >
                See how it works
              </Link>
            </div>
          </div>
          <ProductMockupFrame title="Today's Mission · Maya, Grade 3">
            <div className="rounded-iw-card bg-iw-primary p-5 text-white">
              <p className="text-xs uppercase tracking-wider text-iw-primary-fg/80">Today's mission</p>
              <h3 className="mt-1 font-heading text-2xl font-bold">Multiplying by 3s</h3>
              <p className="mt-1 text-sm text-iw-primary-fg/80">With Atlas · ~15 minutes</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                { label: "Subject", value: "Math" },
                { label: "Tutor", value: "Atlas" },
                { label: "Goal", value: "Mastery" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-iw-border bg-iw-raised/60 p-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-iw-ink-muted">{s.label}</p>
                  <p className="mt-1 font-heading text-sm font-bold text-iw-ink">{s.value}</p>
                </div>
              ))}
            </div>
            <div
              className="mt-4 w-full rounded-iw-control bg-iw-ink py-3 text-center font-semibold text-white"
              aria-hidden
            >
              Start mission →
            </div>
          </ProductMockupFrame>
        </div>
      </Container>
    </section>
  );
}
