"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import {
  LayoutDashboard,
  User,
  GraduationCap,
  Building2,
  Zap,
  School,
  Brain,
  ShieldCheck,
  Settings,
  CreditCard,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalLearners: number;
  totalTenants: number;
  roleCounts: { role: string; count: number }[];
  recentUsers: { id: string; name: string; email: string; role: string; createdAt: string }[];
  recentLearners: { id: string; name: string; functioningLevel: string | null; gradeLevel: string | null; createdAt: string }[];
}

interface ServiceHealth {
  name: string;
  status: "operational" | "degraded" | "down" | "checking";
  latency?: number;
}

interface StatusOverview {
  overall: string;
  services: { name: string; status: string; latencyMs: number }[];
  timestamp: string;
}

const ROLE_COLORS: Record<string, string> = {
  PARENT: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  LEARNER: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  TEACHER: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  THERAPIST: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  CAREGIVER: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  PLATFORM_ADMIN: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  DISTRICT_ADMIN: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  SALES: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  MARKETING: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  CUSTOMER_CARE: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  SUPPORT: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  FINANCE: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  DEVOPS: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
};

export default function AdminOverview() {
  const { user, accessToken } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statusOverview, setStatusOverview] = useState<StatusOverview | null>(null);
  const [uptime, setUptime] = useState<any>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/stats", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {});

    fetch("/api/status/overview")
      .then((r) => r.ok ? r.json() : null)
      .then(setStatusOverview)
      .catch(() => {});

    fetch("/api/status/uptime")
      .then((r) => r.ok ? r.json() : null)
      .then(setUptime)
      .catch(() => {});
  }, [accessToken]);

  const healthyCount = statusOverview?.services?.filter((s: any) => s.status === "healthy").length ?? 0;
  const totalServices = statusOverview?.services?.length ?? 0;
  const platformStatus = statusOverview?.overall ?? "checking";

  const statCards: { title: string; value: string | number; Icon: LucideIcon; bg: string; link: string }[] = [
    { title: t("total_users"), value: stats?.totalUsers ?? "—", Icon: User, bg: "bg-[hsl(var(--visual-primary))]", link: "/dashboard/admin/users" },
    { title: td("total_learners"), value: stats?.totalLearners ?? "—", Icon: GraduationCap, bg: "bg-[hsl(var(--visual-science))]", link: "/dashboard/admin/learners" },
    { title: t("tenants"), value: stats?.totalTenants ?? "—", Icon: Building2, bg: "bg-[hsl(var(--visual-math))]", link: "/dashboard/admin/tenants" },
    { title: t("services"), value: totalServices > 0 ? `${healthyCount}/${totalServices}` : "—", Icon: Zap, bg: "bg-[hsl(var(--visual-reading))]", link: "/dashboard/admin/services" },
  ];

  const quickActions: { label: string; href: string; Icon: LucideIcon; color: string }[] = [
    { label: "Create District", href: "/dashboard/admin/tenants", Icon: School, color: "math" },
    { label: "View Brain Models", href: "/dashboard/admin/ai", Icon: Brain, color: "primary" },
    { label: "Audit Logs", href: "/dashboard/admin/compliance", Icon: ShieldCheck, color: "science" },
    { label: "Platform Settings", href: "/dashboard/admin/settings", Icon: Settings, color: "reading" },
    { label: "Billing", href: "/dashboard/admin/billing", Icon: CreditCard, color: "primary" },
    { label: "Research Data", href: "/dashboard/admin/analytics", Icon: TrendingUp, color: "sel" },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <IconWell color="primary">
            <LayoutDashboard size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">{td("overview")}</h1>
            <p className="text-sm vi-text-muted mt-1">{td("welcome_message", { name: user?.name ?? "" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
            platformStatus === "operational" ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" :
            platformStatus === "degraded" ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" :
            "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              platformStatus === "operational" ? "bg-[hsl(var(--visual-science))]" :
              platformStatus === "degraded" ? "bg-[hsl(var(--visual-sel))] animate-pulse" :
              "bg-[hsl(var(--visual-math))] animate-pulse"
            }`} />
            {platformStatus === "operational" ? "All Systems Operational" :
             platformStatus === "degraded" ? "Degraded Performance" :
             platformStatus === "checking" ? "Checking..." : "Service Issues"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((c) => {
          const Icon = c.Icon;
          return (
            <Link key={c.title} href={c.link} className="group">
              <div className={`${c.bg} rounded-2xl p-5 text-white shadow-lg group-hover:shadow-xl transition-all group-hover:scale-[1.02]`}>
                <div className="flex items-center justify-between mb-3">
                  <StatIconWell color="overlay">
                    <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
                  </StatIconWell>
                  <span className="text-xs opacity-75 group-hover:opacity-100">View →</span>
                </div>
                <div className="text-3xl font-bold">{c.value}</div>
                <div className="text-sm opacity-80 mt-1">{c.title}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 vi-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-lg vi-text">Users by Role</h2>
            <Link href="/dashboard/admin/users" className="text-xs text-[hsl(var(--visual-primary))] font-semibold hover:underline">View All →</Link>
          </div>
          {stats?.roleCounts && stats.roleCounts.length > 0 ? (
            <div className="space-y-3">
              {(() => {
                const roleCounts = stats?.roleCounts ?? [];
                const max = Math.max(1, ...roleCounts.map((r) => Number(r?.count) || 0));
                return roleCounts.map((rc) => {
                  const pct = ((Number(rc?.count) || 0) / max) * 100;
                return (
                  <div key={rc.role} className="flex items-center gap-4">
                    <span className={`px-3 py-1 text-xs rounded-full font-semibold w-36 text-center ${ROLE_COLORS[rc.role] || "vi-surface-soft vi-text-muted"}`}>
                      {rc.role.replace(/_/g, " ")}
                    </span>
                    <div className="flex-1 vi-surface-soft rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-[hsl(var(--visual-primary))] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold vi-text w-10 text-right">{rc.count}</span>
                  </div>
                );
                });
              })()}
            </div>
          ) : (
            <p className="text-sm vi-text-muted">Loading role data...</p>
          )}
        </div>

        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-5">{td("quick_actions")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((a) => {
              const Icon = a.Icon;
              return (
                <Link key={a.label} href={a.href}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border vi-border hover:border-[hsl(var(--visual-primary)/0.3)] hover:vi-surface-soft transition text-center group">
                  <div className="group-hover:scale-110 transition-transform">
                    <IconWell color={a.color} size="sm">
                      <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                    </IconWell>
                  </div>
                  <span className="text-xs font-semibold vi-text-muted group-hover:text-[hsl(var(--visual-primary))]">{a.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vi-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-lg vi-text">{t("system_health")}</h2>
            <Link href="/dashboard/admin/services" className="text-xs text-[hsl(var(--visual-primary))] font-semibold hover:underline">Details →</Link>
          </div>
          <div className="space-y-2">
            {(statusOverview?.services || []).map((svc: any) => (
              <div key={svc.name} className="flex items-center justify-between py-2 border-b vi-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    svc.status === "healthy" ? "bg-[hsl(var(--visual-science))]" : svc.status === "degraded" ? "bg-[hsl(var(--visual-sel))] animate-pulse" : "bg-[hsl(var(--visual-math))]"
                  }`} />
                  <span className="text-sm font-medium vi-text">{svc.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {svc.latencyMs > 0 && <span className="text-xs vi-text-muted">{svc.latencyMs}ms</span>}
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    svc.status === "healthy" ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" : svc.status === "degraded" ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                  }`}>
                    {svc.status}
                  </span>
                </div>
              </div>
            ))}
            {(!statusOverview?.services || statusOverview.services.length === 0) && (
              <p className="text-sm vi-text-muted text-center py-4">Loading service status...</p>
            )}
          </div>
        </div>

        <div className="vi-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-heading font-bold text-lg vi-text">Recent Users</h2>
            <Link href="/dashboard/admin/users" className="text-xs text-[hsl(var(--visual-primary))] font-semibold hover:underline">View All →</Link>
          </div>
          {stats?.recentUsers && stats.recentUsers.length > 0 ? (
            <div className="space-y-2">
              {stats.recentUsers.slice(0, 8).map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b vi-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--visual-primary))] flex items-center justify-center text-white text-xs font-bold">
                      {u.name?.charAt(0) || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium vi-text">{u.name}</p>
                      <p className="text-xs vi-text-muted">{u.email || "No email"}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ROLE_COLORS[u.role] || "vi-surface-soft"}`}>
                    {u.role.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm vi-text-muted text-center py-4">Loading...</p>
          )}
        </div>
      </div>

      {uptime && (
        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg mb-4">30-Day Uptime</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-3xl font-bold">{uptime.uptime?.overall ?? "99.9"}%</p>
              <p className="text-sm vi-text-muted">Overall Uptime</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{uptime.period ?? "30d"}</p>
              <p className="text-sm vi-text-muted">Monitoring Period</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{uptime.uptime?.byService?.length ?? 0}</p>
              <p className="text-sm vi-text-muted">Monitored Services</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{healthyCount}/{totalServices}</p>
              <p className="text-sm vi-text-muted">Services Online</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
