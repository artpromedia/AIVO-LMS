"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconWell } from "@/components/discovery/_vi";
import {
  Building2,
  GraduationCap,
  Users,
  School,
  ClipboardList,
  UserCog,
  BookOpen,
  Brain,
  type LucideIcon,
} from "lucide-react";

interface Stats {
  totalUsers: number;
  totalLearners: number;
  totalStaff: number;
  totalParents: number;
  totalSchools: number;
  activeIeps: number;
  roleCounts: { role: string; count: number }[];
  functioningLevelCounts: { level: string; count: number }[];
}

interface TenantInfo {
  id: string;
  name: string;
  type: string;
  slug: string;
  createdAt: string;
}

export default function DistrictDashboardPage() {
  const { user, accessToken } = useAuth();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || !user) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${accessToken}` };

    Promise.all([
      fetch("/api/district/stats", { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/district/tenant", { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([statsData, tenantData]) => {
        setStats(statsData);
        setTenant(tenantData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, user]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded-lg w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-slate-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const flCounts = stats?.functioningLevelCounts ?? [];
  const maxFL = Math.max(1, ...flCounts.map((c) => Number(c?.count) || 0));

  return (
    <div className="p-8 space-y-6">
      <header className="flex items-center gap-4">
        <IconWell color="primary">
          <Building2 size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold text-[hsl(var(--visual-primary))]">
              District Dashboard
            </h1>
            {tenant && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]">
                {tenant.name}
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          <p className="text-sm vi-text-muted">
            Manage your district&apos;s learners, teachers, and content. View progress reports and
            coordinate accommodations.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Active Learners"
          value={stats?.totalLearners ?? 0}
          helper="Students enrolled"
          Icon={GraduationCap}
          accent="bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]"
        />
        <MetricCard
          label="Staff"
          value={stats?.totalStaff ?? 0}
          helper="Teachers, therapists, caregivers"
          Icon={UserCog}
          accent="bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
        />
        <MetricCard
          label="Schools"
          value={stats?.totalSchools ?? 0}
          helper="Active campuses"
          Icon={School}
          accent="bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
        />
        <MetricCard
          label="Active IEPs"
          value={stats?.activeIeps ?? 0}
          helper="Individualized plans"
          Icon={ClipboardList}
          accent="bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Parents"
          value={stats?.totalParents ?? 0}
          helper="Family accounts"
          Icon={Users}
          accent="bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
        />
        <MetricCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          helper="All platform users"
          Icon={Users}
          accent="vi-surface-soft vi-text-muted"
        />
        {stats?.roleCounts
          ?.filter((r) => r.role === "TEACHER")
          .map((r) => (
            <MetricCard
              key="teachers"
              label="Teachers"
              value={Number(r.count)}
              helper="Educators on platform"
              Icon={BookOpen}
              accent="bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
            />
          ))}
        {stats?.roleCounts
          ?.filter((r) => r.role === "THERAPIST")
          .map((r) => (
            <MetricCard
              key="therapists"
              label="Therapists"
              value={Number(r.count)}
              helper="Specialists on platform"
              Icon={Brain}
              accent="bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
            />
          ))}
      </section>

      {flCounts.length > 0 && (
        <section className="vi-card p-6">
          <h2 className="text-lg font-heading font-semibold vi-text mb-4">
            Functioning Level Distribution
          </h2>
          <div className="flex items-end gap-4 h-48">
            {flCounts.map((d) => (
              <div key={d.level} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-sm font-bold vi-text">{d.count}</span>
                <div
                  className="w-full rounded-t-lg bg-[hsl(var(--visual-primary))] transition-all"
                  style={{ height: `${Math.max(8, (Number(d.count) / maxFL) * 100)}%` }}
                />
                <span className="text-[10px] vi-text-muted font-medium text-center">
                  {String(d.level).replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <ActionCard
          title="Schools"
          description="View and manage schools within your district, their enrollment numbers, and staff assignments."
          href="/dashboard/district/schools"
          buttonLabel="Manage Schools"
          Icon={School}
          color="science"
        />
        <ActionCard
          title="Learner Management"
          description="Browse enrolled learners, view progress summaries, manage IEPs and accommodations."
          href="/dashboard/district/learners"
          buttonLabel="View Learners"
          Icon={GraduationCap}
          color="primary"
        />
        <ActionCard
          title="IEP Management"
          description="Track individualized education programs, review dates, and compliance status."
          href="/dashboard/district/iep"
          buttonLabel="View IEPs"
          Icon={ClipboardList}
          color="sel"
        />
        <ActionCard
          title="Staff & Teachers"
          description="Manage teacher assignments, view school placements, and invite new staff members."
          href="/dashboard/district/staff"
          buttonLabel="Manage Staff"
          Icon={UserCog}
          color="reading"
        />
      </section>

      {tenant && (
        <section className="vi-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-semibold vi-text">Organization Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoRow label="Organization" value={tenant.name} />
            <InfoRow label="Type" value={tenant.type} />
            <InfoRow label="Slug" value={tenant.slug} />
            <InfoRow label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  Icon,
  accent,
}: {
  label: string;
  value: number;
  helper: string;
  Icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="vi-card p-5 transition-all hover:shadow-md hover:border-[hsl(var(--visual-primary)/0.3)]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <p className="text-xs vi-text-muted font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-3xl font-bold vi-text">{value.toLocaleString()}</p>
      <p className="text-xs vi-text-muted mt-1">{helper}</p>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  buttonLabel,
  Icon,
  color,
}: {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  Icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="vi-card p-6 transition-all hover:shadow-md hover:border-[hsl(var(--visual-primary)/0.3)] flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <IconWell color={color} size="sm">
          <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <h3 className="text-base font-semibold vi-text">{title}</h3>
      </div>
      <p className="text-sm vi-text-muted flex-1">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] transition"
      >
        {buttonLabel} <span>→</span>
      </Link>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg vi-bg">
      <span className="text-xs vi-text-muted font-medium w-24">{label}</span>
      <span className="text-sm vi-text font-medium">{value}</span>
    </div>
  );
}
