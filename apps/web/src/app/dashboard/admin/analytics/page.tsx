"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IconWell } from "@/components/discovery/_vi";
import { BarChart3, BookOpen, Clock, CheckCircle2, type LucideIcon } from "lucide-react";

interface EngagementMetrics {
  totalSessions: number;
  totalDuration: number;
  completionRate: number;
  avgSessionLength: number;
}

interface MasteryMetrics {
  subjects: { subject: string; avgMastery: number; growth: number }[];
}

interface Cohort {
  level: string;
  count: number;
}

export default function AdminAnalyticsPage() {
  const { accessToken } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null);
  const [mastery, setMastery] = useState<MasteryMetrics | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${accessToken}` };
    Promise.all([
      fetch("/api/research/metrics/engagement", { headers })
        .then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/research/metrics/mastery", { headers })
        .then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/research/cohorts", { headers })
        .then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([eng, mast, coh]) => {
      if (eng) {
        setEngagement({
          totalSessions: eng.totalSessions ?? 0,
          totalDuration: 0,
          completionRate: eng.completionRate ?? 0,
          avgSessionLength: eng.avgSessionDurationMin ?? 0,
        });
      }
      if (mast?.subjectBreakdown) {
        const subjects = Object.entries(mast.subjectBreakdown).map(([subject, data]: [string, any]) => ({
          subject: subject.charAt(0).toUpperCase() + subject.slice(1),
          avgMastery: Math.round((data.avgMastery ?? 0) * 100),
          growth: Math.round((data.growth ?? 0) * 100),
        }));
        setMastery({ subjects });
      }
      if (coh?.cohorts) {
        setCohorts(coh.cohorts.map((c: any) => ({ level: c.name || c.id, count: c.count })));
      }
    }).finally(() => setLoading(false));
  }, [accessToken]);

  /* eslint-disable no-restricted-syntax -- semantic data-viz palette for cohort levels; values map to fixed analytic categories, not surface tokens */
  const LEVEL_COLORS: Record<string, string> = {
    STANDARD: "#22C55E",
    SUPPORTED: "#3B82F6",
    LOW_VERBAL: "#F59E0B",
    NON_VERBAL: "#F97316",
    PRE_SYMBOLIC: "#EF4444",
  };
  /* eslint-enable no-restricted-syntax */

  const totalCohort = cohorts.reduce((s, c) => s + c.count, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="reading">
            <BarChart3 size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">{td("analytics")}</h1>
            <p className="text-sm vi-text-muted mt-1">Platform-wide engagement metrics, mastery growth, and research data.</p>
          </div>
        </div>
        <button
          onClick={() => {
            if (accessToken) {
              window.open(`/api/research/export/anonymized`, "_blank");
            }
          }}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
        >
          Export Anonymized Data
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 vi-text-muted animate-pulse">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { label: "Total Sessions", value: engagement?.totalSessions ?? "—", Icon: BookOpen, color: "primary" },
              { label: "Avg Session Length", value: engagement?.avgSessionLength ? `${Math.round(engagement.avgSessionLength)}min` : "—", Icon: Clock, color: "reading" },
              { label: "Completion Rate", value: engagement?.completionRate ? `${Math.round(engagement.completionRate * 100)}%` : "—", Icon: CheckCircle2, color: "science" },
              { label: "Total Duration", value: engagement?.totalDuration ? `${Math.round(engagement.totalDuration / 60)}h` : "—", Icon: BarChart3, color: "math" },
            ] as { label: string; value: string | number; Icon: LucideIcon; color: string }[]).map((m) => {
              const Icon = m.Icon;
              return (
                <div key={m.label} className="bg-white rounded-xl p-5 shadow-sm border vi-border">
                  <div className="mb-3">
                    <IconWell color={m.color} size="sm">
                      <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                    </IconWell>
                  </div>
                  <p className="text-2xl font-bold vi-text">{m.value}</p>
                  <p className="text-xs vi-text-muted font-semibold mt-1">{m.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="vi-card p-6">
              <h2 className="font-heading font-bold text-lg vi-text mb-4">{tc("total")}</h2>
              {cohorts.length > 0 ? (
                <div className="space-y-4">
                  {cohorts.map((c) => {
                    const pct = totalCohort > 0 ? Math.round((c.count / totalCohort) * 100) : 0;
                    // eslint-disable-next-line no-restricted-syntax -- neutral fallback for unknown cohort level
                    const color = LEVEL_COLORS[c.level] || "#94A3B8";
                    return (
                      <div key={c.level}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold vi-text">{c.level.replace(/_/g, " ")}</span>
                          <span className="text-sm font-bold vi-text">{c.count} ({pct}%)</span>
                        </div>
                        <div className="vi-surface-soft rounded-full h-3 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm vi-text-muted text-center py-8">No cohort data available</p>
              )}
            </div>

            <div className="vi-card p-6">
              <h2 className="font-heading font-bold text-lg vi-text mb-4">{td("analytics")}</h2>
              {mastery?.subjects && mastery.subjects.length > 0 ? (
                <div className="space-y-4">
                  {mastery.subjects.map((s) => (
                    <div key={s.subject}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold vi-text">{s.subject}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold vi-text">{Math.round(s.avgMastery)}%</span>
                          {s.growth > 0 && <span className="text-xs text-[hsl(var(--visual-science))]">+{s.growth}%</span>}
                        </div>
                      </div>
                      <div className="vi-surface-soft rounded-full h-3 overflow-hidden">
                        <div className="h-full bg-[hsl(var(--visual-primary))] rounded-full" style={{ width: `${s.avgMastery}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm vi-text-muted text-center py-8">No mastery data available yet</p>
              )}
            </div>
          </div>

          <div className="vi-card p-6">
            <h2 className="font-heading font-bold text-lg mb-2">{tc("download")}</h2>
            <p className="text-sm vi-text-muted mb-4">Export anonymized learner data for research purposes. All data is de-identified per FERPA/COPPA requirements.</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl vi-surface-soft vi-border border">
                <p className="text-sm font-semibold">Anonymized Profiles</p>
                <p className="text-xs vi-text-muted mt-1">Functioning levels, mastery scores, engagement patterns</p>
              </div>
              <div className="p-4 rounded-xl vi-surface-soft vi-border border">
                <p className="text-sm font-semibold">Session Analytics</p>
                <p className="text-xs vi-text-muted mt-1">Duration, completion, difficulty progression</p>
              </div>
              <div className="p-4 rounded-xl vi-surface-soft vi-border border">
                <p className="text-sm font-semibold">Intervention Outcomes</p>
                <p className="text-xs vi-text-muted mt-1">Accommodation effectiveness, mastery growth</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
