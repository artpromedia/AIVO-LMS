"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconWell } from "@/components/discovery/_vi";
import { TrendingUp, DollarSign, BarChart3, User, TrendingDown, type LucideIcon } from "lucide-react";

export default function BillingRevenuePage() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/stats", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenueData = months.map((m, i) => ({
    month: m,
    mrr: Math.round(2000 + i * 450 + Math.random() * 300),
    newSubs: Math.round(5 + i * 2 + Math.random() * 3),
    churn: Math.round(Math.random() * 3),
  }));

  const currentMRR = revenueData[revenueData.length - 1].mrr;
  const totalSubs = stats?.totalTenants ?? 0;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-48 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3 text-sm vi-text-muted">
        <Link href="/dashboard/admin/billing" className="hover:text-[hsl(var(--visual-primary))] transition">Billing</Link>
        <span>/</span>
        <span className="vi-text font-medium">Revenue</span>
      </div>

      <div className="flex items-center gap-4">
        <IconWell color="science">
          <TrendingUp size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">Revenue Dashboard</h1>
          <p className="text-sm vi-text-muted mt-1">Track MRR, subscriber growth, and churn metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: "Monthly Recurring Revenue", value: `$${currentMRR.toLocaleString()}`, Icon: DollarSign, color: "science", change: "+12.3%" },
          { label: "Active Subscriptions", value: totalSubs, Icon: BarChart3, color: "reading", change: "+8 this month" },
          { label: "Avg Revenue Per User", value: `$${totalSubs > 0 ? Math.round(currentMRR / totalSubs) : 0}`, Icon: User, color: "primary", change: "" },
          { label: "Churn Rate", value: "2.1%", Icon: TrendingDown, color: "math", change: "-0.3% vs last month" },
        ] as { label: string; value: string | number; Icon: LucideIcon; color: string; change: string }[]).map((m) => {
          const Icon = m.Icon;
          return (
            <div key={m.label} className="bg-white rounded-xl p-5 shadow-sm border vi-border">
              <div className="mb-2">
                <IconWell color={m.color} size="sm">
                  <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                </IconWell>
              </div>
              <p className="text-2xl font-bold vi-text mt-2">{m.value}</p>
              <p className="text-xs vi-text-muted font-semibold mt-1">{m.label}</p>
              {m.change && <p className="text-xs text-[hsl(var(--visual-science))] mt-1">{m.change}</p>}
            </div>
          );
        })}
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">MRR Trend</h2>
        <div className="flex items-end gap-2 h-48">
          {(() => {
            const maxMRR = Math.max(1, ...(revenueData ?? []).map((r) => Number(r?.mrr) || 0));
            return (revenueData ?? []).map((d) => {
              const height = ((Number(d?.mrr) || 0) / maxMRR) * 100;
            return (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] vi-text-muted font-semibold">${(d.mrr / 1000).toFixed(1)}k</span>
                <div
                  className="w-full bg-[hsl(var(--visual-primary))] rounded-t-lg transition-all hover:opacity-90"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] vi-text-muted">{d.month}</span>
              </div>
            );
            });
          })()}
        </div>
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border">
          <h2 className="font-heading font-bold text-lg vi-text">Monthly Breakdown</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Month</th>
              <th className="px-5 py-3 font-semibold">MRR</th>
              <th className="px-5 py-3 font-semibold">New Subscribers</th>
              <th className="px-5 py-3 font-semibold">Churned</th>
              <th className="px-5 py-3 font-semibold">Net Change</th>
            </tr>
          </thead>
          <tbody>
            {revenueData.slice().reverse().map((d) => (
              <tr key={d.month} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3 font-medium vi-text">{d.month} 2026</td>
                <td className="px-5 py-3 vi-text">${d.mrr.toLocaleString()}</td>
                <td className="px-5 py-3 text-[hsl(var(--visual-science))]">+{d.newSubs}</td>
                <td className="px-5 py-3 text-[hsl(var(--visual-math))]">-{d.churn}</td>
                <td className="px-5 py-3">
                  <span className={d.newSubs - d.churn >= 0 ? "text-[hsl(var(--visual-science))]" : "text-[hsl(var(--visual-math))]"}>
                    {d.newSubs - d.churn >= 0 ? "+" : ""}{d.newSubs - d.churn}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
