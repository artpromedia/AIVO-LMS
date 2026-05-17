"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import { Wallet, DollarSign, TrendingUp, User, TrendingDown, type LucideIcon } from "lucide-react";

export default function FinanceDashboard() {
  const { accessToken } = useAuth();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/admin-svc/stats", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {});
  }, [accessToken]);

  const revenueMetrics: Array<{label: string; value: string; trend: string; Icon: LucideIcon; well: string}> = [
    { label: "Monthly Recurring Revenue", value: "$48,200", trend: "+18%", Icon: DollarSign, well: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" },
    { label: "Annual Run Rate", value: "$578,400", trend: "+22%", Icon: TrendingUp, well: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" },
    { label: "Avg Revenue per User", value: "$24.50", trend: "+$2.30", Icon: User, well: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" },
    { label: "Churn Rate", value: "3.2%", trend: "-0.8pp", Icon: TrendingDown, well: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]" },
  ];

  const subscriptionBreakdown = [
    { plan: "Free Trial", count: 245, revenue: "$0", pct: 0, color: "bg-slate-300" },
    { plan: "Family ($29/mo)", count: 680, revenue: "$19,720", pct: 41, color: "bg-purple-400" },
    { plan: "Family Plus ($49/mo)", count: 420, revenue: "$20,580", pct: 43, color: "bg-[hsl(var(--visual-reading))]" },
    { plan: "Enterprise", count: 12, revenue: "$7,900", pct: 16, color: "bg-[hsl(var(--visual-sel))]" },
  ];

  const paymentHealth = [
    { metric: "Successful Payments (30d)", value: "1,142", status: "good" },
    { metric: "Failed Payments", value: "23", status: "warning" },
    { metric: "Dunning Recovery Rate", value: "68%", status: "good" },
    { metric: "Refunds Issued", value: "8", status: "neutral" },
    { metric: "Outstanding Invoices", value: "5", status: "warning" },
    { metric: "Average Days to Pay", value: "2.3d", status: "good" },
  ];

  const recentTransactions = [
    { date: "Today", description: "Family Plus — Annual Renewal", amount: "$588.00", status: "completed", method: "Stripe" },
    { date: "Today", description: "Enterprise — Metro ISD Q2", amount: "$18,750.00", status: "completed", method: "Invoice" },
    { date: "Yesterday", description: "Family — Monthly Subscription", amount: "$29.00", status: "completed", method: "Stripe" },
    { date: "Yesterday", description: "Family Plus — Monthly", amount: "$49.00", status: "failed", method: "Stripe" },
    { date: "2d ago", description: "Family — Monthly Subscription", amount: "$29.00", status: "refunded", method: "Stripe" },
    { date: "3d ago", description: "Enterprise — Fairfax Schools", amount: "$25,000.00", status: "pending", method: "Invoice" },
  ];

  const costBreakdown = [
    { category: "AI / LLM API Costs", amount: "$8,400", pct: 42 },
    { category: "Infrastructure (Hetzner)", amount: "$3,200", pct: 16 },
    { category: "Database & Storage", amount: "$1,800", pct: 9 },
    { category: "Payment Processing Fees", amount: "$1,450", pct: 7 },
    { category: "Third-party Services", amount: "$2,100", pct: 10 },
    { category: "Operations / Other", amount: "$3,050", pct: 16 },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <IconWell color="science">
          <Wallet size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("overview")}</h1>
          <p className="text-sm vi-text-muted mt-1">Revenue tracking, subscription analytics, and financial health.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {revenueMetrics.map((m) => (
          <div key={m.label} className="vi-card p-5">
            <div className="flex items-center justify-between mb-2">
              <StatIconWell wellClass={m.well}>
                <m.Icon size={22} strokeWidth={2.5} aria-hidden="true" />
              </StatIconWell>
              <span className="text-xs text-[hsl(var(--visual-science))] font-semibold">{m.trend}</span>
            </div>
            <p className="text-2xl font-bold vi-text">{m.value}</p>
            <p className="text-xs vi-text-muted font-semibold mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">Revenue by Plan</h2>
          <div className="space-y-4">
            {subscriptionBreakdown.map((plan) => (
              <div key={plan.plan}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold vi-text">{plan.plan}</span>
                    <span className="text-xs vi-text-muted">{plan.count} subscribers</span>
                  </div>
                  <span className="text-sm font-bold vi-text">{plan.revenue}/mo</span>
                </div>
                <div className="vi-surface-soft rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full ${plan.color} transition-all`} style={{ width: `${plan.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">Cost Breakdown (Monthly)</h2>
          <div className="space-y-3">
            {costBreakdown.map((cost) => (
              <div key={cost.category} className="flex items-center gap-4">
                <span className="text-sm font-medium vi-text w-48">{cost.category}</span>
                <div className="flex-1 vi-surface-soft rounded-full h-2.5 overflow-hidden">
                  <div className="h-full rounded-full bg-[hsl(var(--visual-math))] transition-all" style={{ width: `${cost.pct}%` }} />
                </div>
                <span className="text-sm font-bold vi-text w-20 text-right">{cost.amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t vi-border flex justify-between">
            <span className="text-sm font-semibold vi-text">Total Monthly Costs</span>
            <span className="text-sm font-bold vi-text">$20,000</span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs vi-text-muted">Gross Margin</span>
            <span className="text-xs font-bold text-[hsl(var(--visual-science))]">58.5%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {paymentHealth.map((ph) => (
          <div key={ph.metric} className="bg-white rounded-xl p-4 border vi-border text-center">
            <p className={`text-xl font-bold ${ph.status === "good" ? "text-[hsl(var(--visual-science))]" : ph.status === "warning" ? "text-[hsl(var(--visual-sel))]" : "vi-text"}`}>
              {ph.value}
            </p>
            <p className="text-[10px] vi-text-muted font-semibold mt-1">{ph.metric}</p>
          </div>
        ))}
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border">
          <h2 className="font-heading font-bold text-lg vi-text">Recent Transactions</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold">Description</th>
              <th className="px-5 py-3 font-semibold">Amount</th>
              <th className="px-5 py-3 font-semibold">Method</th>
              <th className="px-5 py-3 font-semibold">{tc("status")}</th>
            </tr>
          </thead>
          <tbody>
            {recentTransactions.map((tx, i) => (
              <tr key={i} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3 vi-text-muted">{tx.date}</td>
                <td className="px-5 py-3 font-medium vi-text">{tx.description}</td>
                <td className="px-5 py-3 font-semibold vi-text">{tx.amount}</td>
                <td className="px-5 py-3 vi-text-muted">{tx.method}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                    tx.status === "completed" ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" :
                    tx.status === "pending" ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" :
                    tx.status === "failed" ? "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" :
                    "vi-surface-soft vi-text-muted"
                  }`}>{tx.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
