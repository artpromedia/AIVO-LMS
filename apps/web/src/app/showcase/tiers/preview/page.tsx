"use client";

import { TierThemeProvider, type AgeTier } from "@aivo/learner-ui";
import { Compass, Sparkles, ClipboardList, ChevronRight, Play } from "lucide-react";

/**
 * Public showcase: representative chrome from the baseline-assessment and
 * lesson-stage flows, rendered side-by-side in each of the three age tiers.
 * Lets us verify (without authenticating) that the same components re-skin
 * automatically when wrapped in `<TierThemeProvider>`.
 */

const TIERS: { id: AgeTier; label: string; sub: string; sampleGrade: string }[] = [
  { id: "EARLY", label: "K–5 · Soft Meadow", sub: "picture-book daylight", sampleGrade: "3" },
  { id: "MIDDLE", label: "6–8 · Study Treehouse", sub: "twilight discovery", sampleGrade: "7" },
  { id: "HIGH", label: "9–12 · Focus Studio", sub: "editorial calm", sampleGrade: "10" },
];

function AssessmentChrome({ learnerName }: { learnerName: string }) {
  // Mirrors the parent-assessment-required gate from
  // apps/web/src/app/dashboard/learner/assessment/page.tsx so reviewers see
  // exactly how the live chrome shifts per tier (only the `vi-*` system
  // classes drive the surface; tutor logic untouched).
  return (
    <div className="vi-bg p-6 rounded-3xl">
      <section className="vi-card p-6 text-center relative overflow-hidden">
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <div className="mx-auto mb-4 inline-flex w-14 h-14 rounded-2xl items-center justify-center bg-[hsl(262_83%_58%/0.12)] text-[hsl(262_83%_58%)]">
            <Compass className="w-7 h-7" strokeWidth={2.5} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(262_83%_58%)] mb-2">
            Baseline assessment
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2 leading-tight">
            Ready, {learnerName}?
          </h1>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            We'll take a few minutes to learn how you think — then your tutors will know exactly
            where to start.
          </p>

          <div className="vi-card p-3 mb-5 text-left bg-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-[hsl(262_83%_58%/0.12)] text-[hsl(262_83%_58%)]">
                <ClipboardList className="w-4 h-4" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-extrabold text-sm">Discovery Adventure</p>
                <p className="text-slate-500 text-xs">~10 min · 5 chapters</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[hsl(43_100%_50%/0.16)] text-[hsl(43_100%_50%)] text-[9px] font-extrabold uppercase tracking-wider whitespace-nowrap">
                Begin
              </span>
            </div>
          </div>

          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold text-base shadow-xl shadow-[hsl(262_83%_58%/0.3)]"
            style={{ minHeight: "44px" }}
          >
            Start adventure <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </section>
    </div>
  );
}

function StageChrome({ tutorName, learnerName }: { tutorName: string; learnerName: string }) {
  // Mirrors the not-started gate from the lesson stage, with the per-tutor
  // accent kept (Nova = math = violet here, just for sample purposes).
  return (
    <div className="vi-bg p-6 rounded-3xl">
      <section className="vi-card p-6 text-center relative overflow-hidden">
        <div
          className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(262_83%_58%/0.20)] blur-2xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl"
          aria-hidden
        />
        <div className="relative">
          <div className="relative w-24 h-24 rounded-3xl border-4 mx-auto mb-4 flex items-center justify-center text-4xl bg-[hsl(262_83%_58%/0.12)] border-[hsl(262_83%_58%)]">
            ✨
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(262_83%_58%)] mb-2">
            Today's session
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900 mb-2 leading-tight">
            Learn with {tutorName} <Sparkles className="inline w-5 h-5 text-[hsl(43_100%_50%)]" />
          </h1>
          <p className="text-sm text-slate-500 mb-5">
            Ready, {learnerName}? Let's pick up where we left off.
          </p>

          <button className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-white font-extrabold text-lg shadow-xl bg-[hsl(262_83%_58%)] shadow-[hsl(262_83%_58%/0.4)]">
            <Play className="w-5 h-5 fill-white" /> Start learning
          </button>
        </div>
      </section>
    </div>
  );
}

export default function TiersPreviewPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#1a1320", padding: "32px 24px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ marginBottom: 32, color: "#F5EBD8" }}>
          <h1
            style={{
              fontFamily: "'Fredoka', system-ui",
              fontSize: 32,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Baseline Assessment & Stage — three age tiers
          </h1>
          <p style={{ fontFamily: "'Nunito', system-ui", color: "#B89A72", maxWidth: 640 }}>
            Same components, same brand. The active tier is derived from the learner's gradeLevel
            via <code>gradeToTier()</code>, which sets <code>data-tier</code> on{" "}
            <code>&lt;html&gt;</code> — the existing <code>.vi-*</code> chrome re-skins
            automatically. Promote a learner from 5th → 6th and the next render uses the MIDDLE
            palette with no extra trigger.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {TIERS.map((t) => (
            <div key={t.id}>
              <div
                style={{ marginBottom: 12, color: "#F5EBD8", fontFamily: "'Fredoka', system-ui" }}
              >
                <div style={{ fontSize: 18, fontWeight: 600 }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "#B89A72", fontFamily: "'Nunito', system-ui" }}>
                  {t.sub} · derived from gradeLevel="{t.sampleGrade}"
                </div>
              </div>
              {/* scopeToRoot=false keeps each preview's tier scoped to its own
                  panel so we can show all three at once on the same page. */}
              <TierThemeProvider tier={t.id} scopeToRoot={false}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <AssessmentChrome
                    learnerName={t.id === "HIGH" ? "Atlas" : t.id === "MIDDLE" ? "Kai" : "Sora"}
                  />
                  <StageChrome
                    tutorName="Nova"
                    learnerName={t.id === "HIGH" ? "Atlas" : t.id === "MIDDLE" ? "Kai" : "Sora"}
                  />
                </div>
              </TierThemeProvider>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
