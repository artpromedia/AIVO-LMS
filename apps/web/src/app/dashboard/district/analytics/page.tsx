"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import { BarChart3, GraduationCap, UserCog, School, ClipboardList, TrendingUp, Trophy, Bell, type LucideIcon } from "lucide-react";

interface Cohort {
  level: string;
  count: number;
  pct: number;
}

interface Engagement {
  totalLearners: number;
  activeLearners: number;
  avgSessionDuration: number;
  completionRate: number;
}

export default function DistrictAnalyticsPage() {
  const { accessToken } = useAuth();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [cohortsTotal, setCohortsTotal] = useState(0);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };
    Promise.all([
      fetch("/api/district/analytics/cohorts", { headers }).then((r) => r.ok ? r.json() : { cohorts: [], total: 0 }),
      fetch("/api/district/analytics/engagement", { headers }).then((r) => r.ok ? r.json() : null),
      fetch("/api/district/stats", { headers }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([cohortData, engData, statsData]) => {
        setCohorts(cohortData.cohorts || []);
        setCohortsTotal(cohortData.total || 0);
        setEngagement(engData);
        setStats(statsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const maxCount = Math.max(1, ...(cohorts ?? []).map((c) => Number(c?.count) || 0));
  const rc = stats?.roleCounts ?? [];

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center gap-4">
        <IconWell color="science">
          <BarChart3 size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Analytics & Reports</h1>
          <p className="text-sm vi-text-muted mt-1">District-wide performance metrics, functioning level distribution, and engagement data.</p>
        </div>
      </header>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-200 rounded-2xl" />)}
          </div>
          <div className="h-64 bg-slate-200 rounded-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Learners" value={stats?.totalLearners ?? 0} Icon={GraduationCap} well="bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" />
            <StatCard label="Total Staff" value={stats?.totalStaff ?? 0} Icon={UserCog} well="bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" />
            <StatCard label="Schools" value={stats?.totalSchools ?? 0} Icon={School} well="bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" />
            <StatCard label="Active IEPs" value={stats?.activeIeps ?? 0} Icon={ClipboardList} well="bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]" />
          </div>

          {cohorts.length > 0 && (
            <div className="vi-card p-6">
              <h2 className="text-lg font-heading font-semibold vi-text mb-1">Functioning Level Distribution</h2>
              <p className="text-xs vi-text-muted mb-4">{cohortsTotal} total learners</p>
              <div className="flex items-end gap-4 h-48">
                {cohorts.map((d) => (
                  <div key={d.level} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-sm font-bold vi-text">{d.count}</span>
                    <div
                      className="w-full rounded-t-lg bg-[hsl(var(--visual-primary))] transition-all"
                      style={{ height: `${Math.max(8, (d.count / maxCount) * 100)}%` }}
                    />
                    <span className="text-[10px] vi-text-muted font-medium text-center">{d.level?.replace(/_/g, " ")}</span>
                    <span className="text-[10px] vi-text-muted">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="vi-card p-6">
              <h2 className="text-lg font-heading font-semibold vi-text mb-3">Role Distribution</h2>
              <div className="space-y-3">
                {rc.map((r: any) => (
                  <div key={r.role} className="flex items-center justify-between">
                    <span className="text-sm vi-text-muted">{r.role?.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 rounded-full vi-surface-soft overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[hsl(var(--visual-primary))]"
                          style={{ width: `${Math.min(100, (Number(r.count) / Math.max(1, stats?.totalUsers ?? 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold vi-text w-8 text-right">{r.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="vi-card p-6">
              <h2 className="text-lg font-heading font-semibold vi-text mb-3">Engagement</h2>
              {engagement ? (
                <div className="space-y-4">
                  <EngagementRow label="Total Learners" value={engagement.totalLearners} />
                  <EngagementRow label="Active Learners" value={engagement.activeLearners} />
                  <EngagementRow label="Avg Session (min)" value={engagement.avgSessionDuration} />
                  <EngagementRow label="Completion Rate" value={`${engagement.completionRate}%`} />
                </div>
              ) : (
                <p className="text-sm vi-text-muted">Engagement data will populate as learners use the platform.</p>
              )}
            </div>
          </div>

          <div className="vi-card p-6">
            <h2 className="text-lg font-heading font-semibold vi-text mb-3">Quick Insights</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <InsightCard Icon={TrendingUp} well="bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" title="Enrollment Growth" description="Track new student enrollments over time to identify trends." />
              <InsightCard Icon={Trophy} well="bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" title="Mastery Tracking" description="Monitor domain mastery across all learners in your district." />
              <InsightCard Icon={Bell} well="bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" title="Intervention Alerts" description="Get notified when learners need additional support or accommodations." />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, well }: { label: string; value: number; Icon: LucideIcon; well: string }) {
  return (
    <div className="vi-card p-5 hover:shadow-md transition">
      <div className="flex items-center gap-3 mb-2">
        <StatIconWell wellClass={well}>
          <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
        </StatIconWell>
        <span className="text-xs vi-text-muted font-medium uppercase">{label}</span>
      </div>
      <p className="text-3xl font-bold vi-text">{value}</p>
    </div>
  );
}

function EngagementRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg vi-bg">
      <span className="text-sm vi-text-muted">{label}</span>
      <span className="text-sm font-bold vi-text">{value}</span>
    </div>
  );
}

function InsightCard({ Icon, well, title, description }: { Icon: LucideIcon; well: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl vi-bg border vi-border">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${well}`}>
        <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold vi-text">{title}</p>
        <p className="text-xs vi-text-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}
