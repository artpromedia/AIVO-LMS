"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useBrainState } from "@/hooks/useBrainState";
import { GraduationCap, Flag, ArrowRight, CheckCircle2 } from "lucide-react";

interface GradebookEntry {
  skill: string;
  subject: string;
  masteryScore: number;
}

const GRADE_BANDS = ["KINDER", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH", "ELEVENTH", "TWELFTH"];
const FUNCTIONING_LEVELS = ["PRE_SYMBOLIC", "NON_VERBAL", "LOW_VERBAL", "SUPPORTED", "STANDARD"];

const MILESTONE_THRESHOLDS: Record<string, number> = {
  STANDARD: 0.70, SUPPORTED: 0.60, LOW_VERBAL: 0.50, NON_VERBAL: 0.40, PRE_SYMBOLIC: 0.30,
};

export default function TransitionPlanningPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: learnerId } = useParams() as { id: string };
  const { brainState, loading: brainLoading } = useBrainState(learnerId, accessToken);
  const [gradebook, setGradebook] = useState<GradebookEntry[]>([]);

  useEffect(() => { if (!authLoading && !user) router.push("/login"); }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    const ctl = new AbortController();
    fetch(`/api/learning/gradebook/${learnerId}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: ctl.signal })
      .then(r => r.ok ? r.json() : [])
      .then(g => setGradebook(Array.isArray(g) ? g : []))
      .catch(() => {});
    return () => ctl.abort();
  }, [user, accessToken, learnerId]);

  if (authLoading || !user) return null;

  const level = brainState?.functioningLevelProfile?.level || "STANDARD";
  const threshold = MILESTONE_THRESHOLDS[level] ?? 0.70;
  // brain-svc returns camelCase via _to_camel_case; fall back to snake_case in
  // case an older payload is cached.
  const ca = (brainState as any)?.curriculumAlignment ?? (brainState as any)?.curriculum_alignment;
  const gradeBand: string | null = ca?.gradeBand ?? ca?.grade_band ?? null;

  const masteredCount = gradebook.filter(g => g.masteryScore >= threshold).length;
  const inProgress = gradebook.filter(g => g.masteryScore < threshold && g.masteryScore > 0);
  const overallReadiness = gradebook.length
    ? gradebook.reduce((sum, g) => sum + g.masteryScore, 0) / gradebook.length
    : 0;

  const gradeIdx = gradeBand ? GRADE_BANDS.indexOf(gradeBand) : -1;
  const nextGrade = gradeIdx >= 0 && gradeIdx + 1 < GRADE_BANDS.length ? GRADE_BANDS[gradeIdx + 1] : null;
  const nextLevelIdx = FUNCTIONING_LEVELS.indexOf(level) + 1;
  const nextLevel = nextLevelIdx > 0 && nextLevelIdx < FUNCTIONING_LEVELS.length ? FUNCTIONING_LEVELS[nextLevelIdx] : null;

  return (
    <div className="vi-bg min-h-screen">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={100} height={30} style={{ height: "auto" }} />
        <button onClick={() => router.push(`/dashboard/parent/learner/${learnerId}`)} className="text-sm vi-text-muted hover:text-[hsl(var(--visual-primary))] font-semibold">
          ← Back to learner
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-12 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold vi-text">Transition Planning</h1>
          <p className="vi-text-muted">Where your child is now and what comes next</p>
        </div>

        {brainLoading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-[hsl(var(--visual-primary)/0.2)] border-t-[hsl(var(--visual-primary))] rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <section className="vi-card p-6 space-y-4">
              <h2 className="font-heading font-bold text-xl vi-text flex items-center gap-2">
                <GraduationCap size={20} className="text-[hsl(var(--visual-primary))]" /> Current placement
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Stat label="Grade band" value={gradeBand ?? "—"} />
                <Stat label="Functioning level" value={level} />
                <Stat label="Overall readiness" value={`${Math.round(overallReadiness * 100)}%`} />
              </div>
            </section>

            <section className="vi-card p-6 space-y-4">
              <h2 className="font-heading font-bold text-xl vi-text flex items-center gap-2">
                <Flag size={20} className="text-[hsl(var(--visual-sel))]" /> Next milestones
              </h2>
              <div className="space-y-3">
                <Milestone
                  done={overallReadiness >= threshold && nextGrade !== null}
                  title={nextGrade ? `Move to ${nextGrade} grade band` : "Highest grade band reached"}
                  detail={nextGrade ? `Requires ${Math.round(threshold * 100)}% average mastery (currently ${Math.round(overallReadiness * 100)}%)` : "Continue advanced enrichment"}
                />
                <Milestone
                  done={false}
                  title={nextLevel ? `Step up to ${nextLevel} functioning level` : "Highest functioning level"}
                  detail={nextLevel ? "Re-assess after sustained mastery improvements over 30 days" : "Maintain current supports"}
                />
                <Milestone
                  done={masteredCount >= 5}
                  title="Master 5 core skills"
                  detail={`${masteredCount} of 5 skills mastered at threshold`}
                />
              </div>
            </section>

            <section className="vi-card p-6 space-y-4">
              <h2 className="font-heading font-bold text-xl vi-text">Skills in progress</h2>
              {inProgress.length === 0 ? (
                <p className="text-sm vi-text-muted">No active skills below the mastery threshold.</p>
              ) : (
                <ul className="space-y-2">
                  {inProgress.slice(0, 10).map((g, i) => (
                    <li key={i} className="flex items-center gap-3 py-2 border-b vi-border last:border-0">
                      <ArrowRight size={16} className="text-[hsl(var(--visual-primary))] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{g.skill}</p>
                        <p className="text-xs vi-text-muted">{g.subject} · {Math.round(g.masteryScore * 100)}% / {Math.round(threshold * 100)}% needed</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs vi-text-muted font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-xl font-heading font-bold vi-text mt-1">{value}</p>
    </div>
  );
}

function Milestone({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-2xl ${done ? "bg-emerald-50" : "bg-slate-50"}`}>
      <CheckCircle2 size={20} className={done ? "text-emerald-600 shrink-0" : "text-slate-300 shrink-0"} />
      <div>
        <p className="font-bold text-slate-800">{title}</p>
        <p className="text-sm vi-text-muted">{detail}</p>
      </div>
    </div>
  );
}
