"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import { Megaphone, User, Globe, Target, DollarSign, type LucideIcon } from "lucide-react";

export default function MarketingDashboard() {
  const { accessToken } = useAuth();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/stats", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }, [accessToken]);

  const channels = [
    {
      name: "Organic Search",
      visitors: 12400,
      signups: 186,
      conversion: 1.5,
      cost: "$0",
      color: "bg-[hsl(var(--visual-science))]",
    },
    {
      name: "Paid Search (Google)",
      visitors: 8200,
      signups: 328,
      conversion: 4.0,
      cost: "$4,920",
      color: "bg-[hsl(var(--visual-reading))]",
    },
    {
      name: "Social Media",
      visitors: 6800,
      signups: 102,
      conversion: 1.5,
      cost: "$1,200",
      color: "bg-pink-500",
    },
    {
      name: "Email Campaigns",
      visitors: 3400,
      signups: 272,
      conversion: 8.0,
      cost: "$340",
      color: "bg-[hsl(var(--visual-primary))]",
    },
    {
      name: "Referral Program",
      visitors: 2100,
      signups: 168,
      conversion: 8.0,
      cost: "$840",
      color: "bg-[hsl(var(--visual-sel))]",
    },
    {
      name: "Content Marketing",
      visitors: 5600,
      signups: 112,
      conversion: 2.0,
      cost: "$800",
      color: "bg-[hsl(var(--visual-reading)/0.7)]",
    },
  ];

  const campaigns = [
    { name: "Back to School 2026", status: "active", leads: 450, spend: "$3,200", cpl: "$7.11" },
    { name: "IEP Awareness Month", status: "active", leads: 280, spend: "$1,800", cpl: "$6.43" },
    { name: "District Outreach Q2", status: "scheduled", leads: 0, spend: "$0", cpl: "—" },
    {
      name: "Parent Webinar Series",
      status: "completed",
      leads: 620,
      spend: "$2,400",
      cpl: "$3.87",
    },
    { name: "Autism Acceptance", status: "completed", leads: 340, spend: "$1,600", cpl: "$4.71" },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <IconWell color="primary">
          <Megaphone size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("overview")}</h1>
          <p className="text-sm vi-text-muted mt-1">
            User acquisition, campaign performance, and content analytics.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(
          [
            {
              label: "Total Signups",
              value: stats?.totalUsers ?? "—",
              Icon: User,
              well: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
              trend: "+24% MoM",
            },
            {
              label: "Monthly Visitors",
              value: "38.5K",
              Icon: Globe,
              well: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
              trend: "+15% MoM",
            },
            {
              label: "Conversion Rate",
              value: "3.1%",
              Icon: Target,
              well: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
              trend: "+0.4pp",
            },
            {
              label: "Cost per Lead",
              value: "$5.82",
              Icon: DollarSign,
              well: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
              trend: "-12% MoM",
            },
          ] as Array<{ label: string; value: any; Icon: LucideIcon; well: string; trend: string }>
        ).map((m) => (
          <div key={m.label} className="vi-card p-5">
            <div className="flex items-center justify-between mb-2">
              <StatIconWell wellClass={m.well}>
                <m.Icon size={22} strokeWidth={2.5} aria-hidden="true" />
              </StatIconWell>
              <span className="text-xs text-[hsl(var(--visual-science))] font-semibold">
                {m.trend}
              </span>
            </div>
            <p className="text-2xl font-bold vi-text">{m.value}</p>
            <p className="text-xs vi-text-muted font-semibold mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">Acquisition Channels</h2>
        <div className="space-y-3">
          {(() => {
            const maxVisitors = Math.max(
              1,
              ...(channels ?? []).map((c) => Number(c?.visitors) || 0),
            );
            return (channels ?? []).map((ch) => {
              const pct = ((Number(ch?.visitors) || 0) / maxVisitors) * 100;
              return (
                <div key={ch.name} className="flex items-center gap-4">
                  <span className="text-sm font-semibold vi-text w-44">{ch.name}</span>
                  <div className="flex-1 vi-surface-soft rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ch.color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs vi-text-muted w-16 text-right">
                    {ch.visitors.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold vi-text w-16 text-right">
                    {ch.signups} leads
                  </span>
                  <span className="text-xs vi-text-muted w-12 text-right">{ch.conversion}%</span>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border">
          <h2 className="font-heading font-bold text-lg vi-text">Campaigns</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Campaign</th>
              <th className="px-5 py-3 font-semibold">{tc("status")}</th>
              <th className="px-5 py-3 font-semibold">Leads</th>
              <th className="px-5 py-3 font-semibold">Spend</th>
              <th className="px-5 py-3 font-semibold">Cost/Lead</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.name} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3 font-medium vi-text">{c.name}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                      c.status === "active"
                        ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                        : c.status === "scheduled"
                          ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                          : "vi-surface-soft vi-text-muted"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-3 vi-text font-semibold">{c.leads}</td>
                <td className="px-5 py-3 vi-text-muted">{c.spend}</td>
                <td className="px-5 py-3 vi-text-muted">{c.cpl}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">Audience Segments</h2>
          <div className="space-y-3">
            {[
              { segment: "Parents (B2C)", pct: 62, color: "bg-purple-400" },
              { segment: "Schools (B2B)", pct: 24, color: "bg-[hsl(var(--visual-reading))]" },
              { segment: "Districts (Enterprise)", pct: 10, color: "bg-[hsl(var(--visual-sel))]" },
              {
                segment: "Therapists/Specialists",
                pct: 4,
                color: "bg-[hsl(var(--visual-science))]",
              },
            ].map((s) => (
              <div key={s.segment}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium vi-text">{s.segment}</span>
                  <span className="text-sm font-bold vi-text">{s.pct}%</span>
                </div>
                <div className="vi-surface-soft rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${s.color}`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">Content Performance</h2>
          <div className="space-y-3">
            {[
              {
                title: "How Brain Clones Help Neurodiverse Learners",
                views: 4200,
                shares: 180,
                type: "Blog",
              },
              {
                title: "5 Signs Your Child Needs Adaptive Learning",
                views: 3100,
                shares: 95,
                type: "Blog",
              },
              {
                title: "AIVO Parent Success Story: The Rivera Family",
                views: 2800,
                shares: 210,
                type: "Video",
              },
              { title: "District ROI Calculator", views: 1900, shares: 45, type: "Tool" },
            ].map((c) => (
              <div
                key={c.title}
                className="flex items-center justify-between p-3 rounded-xl border vi-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium vi-text truncate">{c.title}</p>
                  <p className="text-xs vi-text-muted">
                    {c.type} &middot; {c.views.toLocaleString()} views &middot; {c.shares} shares
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
