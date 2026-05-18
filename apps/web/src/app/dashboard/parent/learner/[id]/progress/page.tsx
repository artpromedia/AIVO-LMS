"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { TrendingUp, Trophy, Clock, Target, Sparkles } from "lucide-react";

interface Session {
  id: string;
  subject: string;
  status: string;
  xpEarned: number | null;
  durationSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  sessionData?: any;
}

interface GradebookEntry {
  id: string;
  subject: string;
  skill: string;
  masteryScore: number;
  attemptsCount: number;
  trend: string | null;
  lastAssessedAt: string;
}

const TREND_BADGE: Record<string, string> = {
  improving: "bg-emerald-100 text-emerald-700",
  declining: "bg-amber-100 text-amber-800",
  stable: "bg-slate-100 text-slate-700",
};

export default function ParentProgressPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: learnerId } = useParams() as { id: string };

  const [sessions, setSessions] = useState<Session[]>([]);
  const [gradebook, setGradebook] = useState<GradebookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || !accessToken) return;
    const ctl = new AbortController();
    const headers = { Authorization: `Bearer ${accessToken}` };
    Promise.all([
      fetch(`/api/learning/sessions?learnerId=${learnerId}`, { headers, signal: ctl.signal }).then(
        (r) => (r.ok ? r.json() : []),
      ),
      fetch(`/api/learning/gradebook/${learnerId}`, { headers, signal: ctl.signal }).then((r) =>
        r.ok ? r.json() : [],
      ),
    ])
      .then(([s, g]) => {
        setSessions(Array.isArray(s) ? s : []);
        setGradebook(Array.isArray(g) ? g : []);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          /* swallow */
        }
      })
      .finally(() => setLoading(false));
    return () => ctl.abort();
  }, [user, accessToken, learnerId]);

  if (authLoading || !user) return null;

  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const totalXp = completed.reduce((sum, s) => sum + (s.xpEarned || 0), 0);
  const totalMinutes = Math.round(
    completed.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / 60,
  );
  const avgQuality = completed.length
    ? completed.reduce((sum, s) => sum + (s.sessionData?.completionQuality || 0), 0) /
      completed.length
    : 0;
  const xpLast7 = completed
    .filter((s) => s.completedAt && Date.now() - new Date(s.completedAt).getTime() < 7 * 86400000)
    .reduce((sum, s) => sum + (s.xpEarned || 0), 0);

  return (
    <div className="vi-bg min-h-screen">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={100}
          height={30}
          style={{ height: "auto" }}
        />
        <button
          onClick={() => router.push(`/dashboard/parent/learner/${learnerId}`)}
          className="text-sm vi-text-muted hover:text-[hsl(var(--visual-primary))] font-semibold"
        >
          ← Back to learner
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold vi-text">Learning Progress</h1>
          <p className="vi-text-muted">XP, mastery, and recent activity</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-[hsl(var(--visual-primary)/0.2)] border-t-[hsl(var(--visual-primary))] rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Trophy size={20} />}
                label="Total XP"
                value={totalXp.toLocaleString()}
                color="primary"
              />
              <StatCard
                icon={<Sparkles size={20} />}
                label="XP last 7 days"
                value={xpLast7.toLocaleString()}
                color="reading"
              />
              <StatCard
                icon={<Clock size={20} />}
                label="Time on task"
                value={`${totalMinutes}m`}
                color="science"
              />
              <StatCard
                icon={<Target size={20} />}
                label="Avg quality"
                value={`${Math.round(avgQuality * 100)}%`}
                color="sel"
              />
            </div>

            <section className="vi-card p-6 space-y-4">
              <h2 className="font-heading font-bold text-xl vi-text flex items-center gap-2">
                <TrendingUp size={20} className="text-[hsl(var(--visual-primary))]" /> Mastery by
                skill
              </h2>
              {gradebook.length === 0 ? (
                <p className="text-sm vi-text-muted">
                  No mastery data yet — complete a few lessons to see scores here.
                </p>
              ) : (
                <div className="space-y-2">
                  {gradebook.slice(0, 12).map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-3 py-2 border-b vi-border last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{g.skill}</p>
                        <p className="text-xs vi-text-muted">
                          {g.subject} · {g.attemptsCount} attempts
                        </p>
                      </div>
                      <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[hsl(var(--visual-primary))]"
                          style={{ width: `${Math.round((g.masteryScore || 0) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-800 w-12 text-right">
                        {Math.round((g.masteryScore || 0) * 100)}%
                      </span>
                      {g.trend && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${TREND_BADGE[g.trend] || TREND_BADGE.stable}`}
                        >
                          {g.trend}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="vi-card p-6 space-y-4">
              <h2 className="font-heading font-bold text-xl vi-text">Recent sessions</h2>
              {completed.length === 0 ? (
                <p className="text-sm vi-text-muted">No completed sessions yet.</p>
              ) : (
                <div className="space-y-2">
                  {completed.slice(0, 10).map((s) => {
                    const minutes = s.durationSeconds ? Math.round(s.durationSeconds / 60) : 0;
                    const quality = s.sessionData?.completionQuality;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 py-2 border-b vi-border last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{s.subject}</p>
                          <p className="text-xs vi-text-muted">
                            {s.completedAt ? new Date(s.completedAt).toLocaleDateString() : "—"} ·{" "}
                            {minutes}m
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[hsl(var(--visual-primary))]">
                          +{s.xpEarned || 0} XP
                        </span>
                        {typeof quality === "number" && (
                          <span className="text-xs vi-text-muted w-16 text-right">
                            {Math.round(quality * 100)}% quality
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="vi-card p-4">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 bg-[hsl(var(--visual-${color})/0.12)] text-[hsl(var(--visual-${color}))]`}
      >
        {icon}
      </div>
      <p className="text-xs vi-text-muted font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-heading font-bold vi-text">{value}</p>
    </div>
  );
}
