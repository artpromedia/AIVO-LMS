"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Lightbulb, AlertTriangle, TrendingUp, Activity } from "lucide-react";

interface Session {
  id: string;
  subject: string;
  status: string;
  completedAt: string | null;
  durationSeconds: number | null;
  sessionData?: {
    completionQuality?: number;
    scoringSignals?: {
      correctAnswers?: number;
      attemptedAnswers?: number;
      engagementBeats?: number;
      breaksUsed?: number;
      masteryDelta?: number;
    };
  };
}

interface GradebookEntry {
  skill: string;
  subject: string;
  masteryScore: number;
  trend: string | null;
}

interface Insight {
  severity: "positive" | "neutral" | "watch" | "concern";
  title: string;
  detail: string;
  evidence: string;
}

const SEVERITY_STYLES: Record<Insight["severity"], { bg: string; icon: React.ReactNode; iconColor: string }> = {
  positive: { bg: "bg-emerald-50 border-emerald-200", icon: <TrendingUp size={18} />, iconColor: "text-emerald-600" },
  neutral:  { bg: "bg-slate-50 border-slate-200", icon: <Activity size={18} />, iconColor: "text-slate-600" },
  watch:    { bg: "bg-amber-50 border-amber-200", icon: <Lightbulb size={18} />, iconColor: "text-amber-700" },
  concern:  { bg: "bg-rose-50 border-rose-200", icon: <AlertTriangle size={18} />, iconColor: "text-rose-700" },
};

function deriveInsights(sessions: Session[], gradebook: GradebookEntry[]): Insight[] {
  const insights: Insight[] = [];
  const completed = sessions.filter(s => s.status === "COMPLETED");
  const recent = completed
    .filter(s => s.completedAt && Date.now() - new Date(s.completedAt).getTime() < 14 * 86400000);

  if (recent.length === 0 && completed.length === 0) {
    return [{
      severity: "neutral",
      title: "Not enough data yet",
      detail: "Complete a few sessions to unlock personalized insights.",
      evidence: "0 sessions in the last 14 days",
    }];
  }

  // Avg quality
  const qualities = recent.map(s => s.sessionData?.completionQuality).filter((q): q is number => typeof q === "number");
  const avgQuality = qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0;

  // Correctness vs engagement
  const totals = recent.reduce((acc, s) => {
    const sig = s.sessionData?.scoringSignals;
    if (!sig) return acc;
    acc.correct += sig.correctAnswers || 0;
    acc.attempted += sig.attemptedAnswers || 0;
    acc.beats += sig.engagementBeats || 0;
    acc.breaks += sig.breaksUsed || 0;
    return acc;
  }, { correct: 0, attempted: 0, beats: 0, breaks: 0 });

  const correctness = totals.attempted > 0 ? totals.correct / totals.attempted : null;

  if (avgQuality >= 0.75 && qualities.length >= 3) {
    insights.push({
      severity: "positive",
      title: "Strong learning quality",
      detail: "Sessions are well-paced with good completion and correctness. Consider introducing harder topics.",
      evidence: `${Math.round(avgQuality * 100)}% average quality across ${qualities.length} recent sessions`,
    });
  }

  if (correctness !== null && correctness < 0.4 && totals.beats > 10) {
    insights.push({
      severity: "watch",
      title: "Trying hard but struggling",
      detail: "High engagement with low correctness usually means the material is too advanced. Easier topics or scaffolded prompts may help.",
      evidence: `${Math.round(correctness * 100)}% correct over ${totals.attempted} attempts`,
    });
  }

  if (correctness !== null && correctness >= 0.85) {
    insights.push({
      severity: "positive",
      title: "Mastering current material",
      detail: "Consider promoting to the next topic — your child is consistently getting answers right.",
      evidence: `${Math.round(correctness * 100)}% correct`,
    });
  }

  if (totals.breaks > recent.length * 2 && recent.length >= 3) {
    insights.push({
      severity: "watch",
      title: "Frequent breaks",
      detail: "Multiple breaks per session can mean focus fatigue or sensory overload. Try shorter sessions or check the sensory profile.",
      evidence: `${totals.breaks} breaks across ${recent.length} sessions`,
    });
  }

  const declining = gradebook.filter(g => g.trend === "declining");
  if (declining.length >= 2) {
    insights.push({
      severity: "concern",
      title: "Skills regressing",
      detail: "Two or more skills are trending downward. Schedule a review session to refresh foundations.",
      evidence: declining.slice(0, 3).map(d => d.skill).join(", "),
    });
  }

  const improving = gradebook.filter(g => g.trend === "improving");
  if (improving.length >= 3) {
    insights.push({
      severity: "positive",
      title: "Multiple skills improving",
      detail: "Consistent upward momentum — keep the current learning rhythm.",
      evidence: `${improving.length} skills trending up`,
    });
  }

  // Streak
  if (recent.length >= 7) {
    insights.push({
      severity: "positive",
      title: "Strong recent activity",
      detail: "7+ sessions in the last two weeks builds durable habits.",
      evidence: `${recent.length} sessions in 14 days`,
    });
  } else if (recent.length === 0) {
    insights.push({
      severity: "watch",
      title: "Quiet recently",
      detail: "No completed sessions in the last 14 days. A short session today helps maintain momentum.",
      evidence: "0 sessions in 14 days",
    });
  }

  if (insights.length === 0) {
    insights.push({
      severity: "neutral",
      title: "Steady progress",
      detail: "Nothing notable to flag — keep going at the current pace.",
      evidence: `${recent.length} recent sessions`,
    });
  }

  return insights;
}

export default function CausalInsightsPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: learnerId } = useParams() as { id: string };

  const [sessions, setSessions] = useState<Session[]>([]);
  const [gradebook, setGradebook] = useState<GradebookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) router.push("/login"); }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    const ctl = new AbortController();
    const headers = { Authorization: `Bearer ${accessToken}` };
    Promise.all([
      fetch(`/api/learning/sessions?learnerId=${learnerId}`, { headers, signal: ctl.signal }).then(r => r.ok ? r.json() : []),
      fetch(`/api/learning/gradebook/${learnerId}`, { headers, signal: ctl.signal }).then(r => r.ok ? r.json() : []),
    ])
      .then(([s, g]) => { setSessions(Array.isArray(s) ? s : []); setGradebook(Array.isArray(g) ? g : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [user, accessToken, learnerId]);

  if (authLoading || !user) return null;

  const insights = deriveInsights(sessions, gradebook);

  return (
    <div className="vi-bg min-h-screen">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={100} height={30} style={{ height: "auto" }} />
        <button onClick={() => router.push(`/dashboard/parent/learner/${learnerId}`)} className="text-sm vi-text-muted hover:text-[hsl(var(--visual-primary))] font-semibold">
          ← Back to learner
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-12 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold vi-text">Insights</h1>
          <p className="vi-text-muted">What the recent learning data is telling us</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-[hsl(var(--visual-primary)/0.2)] border-t-[hsl(var(--visual-primary))] rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((ins, i) => {
              const s = SEVERITY_STYLES[ins.severity];
              return (
                <div key={i} className={`p-5 rounded-2xl border-2 ${s.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 ${s.iconColor}`}>{s.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800">{ins.title}</p>
                      <p className="text-sm text-slate-700 mt-1">{ins.detail}</p>
                      <p className="text-xs vi-text-muted mt-2 font-semibold">Based on: {ins.evidence}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs vi-text-muted">
          Insights are generated from the last 14 days of session data and current mastery trends.
        </p>
      </main>
    </div>
  );
}
