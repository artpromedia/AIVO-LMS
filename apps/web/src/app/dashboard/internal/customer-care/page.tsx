"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import { Headphones, Inbox, RefreshCw, CheckCircle2, Star, type LucideIcon } from "lucide-react";

export default function CustomerCareDashboard() {
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

  const ticketMetrics = {
    open: 23,
    inProgress: 15,
    awaitingResponse: 8,
    resolved: 142,
    avgFirstResponse: "2.4h",
    avgResolution: "18h",
    csat: 94,
    nps: 72,
  };

  const recentTickets = [
    { id: "T-1042", subject: "Brain clone not completing after baseline", priority: "high", status: "in_progress", user: "Sarah M.", age: "3h", category: "Technical" },
    { id: "T-1041", subject: "Can't access learner dashboard after approval", priority: "high", status: "open", user: "James K.", age: "5h", category: "Access" },
    { id: "T-1040", subject: "How to add a second learner profile", priority: "medium", status: "awaiting_response", user: "Maria L.", age: "1d", category: "How-to" },
    { id: "T-1039", subject: "Subscription billing date question", priority: "low", status: "awaiting_response", user: "David P.", age: "1d", category: "Billing" },
    { id: "T-1038", subject: "Tutor session frozen mid-lesson", priority: "high", status: "in_progress", user: "Angela W.", age: "6h", category: "Technical" },
    { id: "T-1037", subject: "Request to export child's data", priority: "medium", status: "in_progress", user: "Tom R.", age: "2d", category: "Compliance" },
    { id: "T-1036", subject: "IEP upload not processing", priority: "medium", status: "open", user: "Linda C.", age: "4h", category: "Technical" },
  ];

  const categoryBreakdown = [
    { category: "Technical", count: 45, pct: 32 },
    { category: "How-to / Onboarding", count: 38, pct: 27 },
    { category: "Billing", count: 25, pct: 18 },
    { category: "Access / Auth", count: 18, pct: 13 },
    { category: "Compliance / Data", count: 8, pct: 6 },
    { category: "Feature Request", count: 6, pct: 4 },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <IconWell color="primary">
          <Headphones size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("overview")}</h1>
          <p className="text-sm vi-text-muted mt-1">Ticket management, customer satisfaction, and response metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: "Open Tickets", value: ticketMetrics.open, Icon: Inbox, color: "bg-[hsl(var(--visual-math))]" },
          { label: "In Progress", value: ticketMetrics.inProgress, Icon: RefreshCw, color: "bg-[hsl(var(--visual-sel))]" },
          { label: "Resolved (30d)", value: ticketMetrics.resolved, Icon: CheckCircle2, color: "bg-[hsl(var(--visual-reading))]" },
          { label: "CSAT Score", value: `${ticketMetrics.csat}%`, Icon: Star, color: "bg-[hsl(var(--visual-primary))]" },
        ] as Array<{label: string; value: any; Icon: LucideIcon; color: string}>).map((m) => (
          <div key={m.label} className={`${m.color} rounded-2xl p-5 text-white`}>
            <StatIconWell color="overlay">
              <m.Icon size={22} strokeWidth={2.5} aria-hidden="true" />
            </StatIconWell>
            <p className="text-3xl font-bold mt-2">{m.value}</p>
            <p className="text-sm opacity-80 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border vi-border text-center">
          <p className="text-2xl font-bold vi-text">{ticketMetrics.avgFirstResponse}</p>
          <p className="text-xs vi-text-muted font-semibold">Avg First Response</p>
        </div>
        <div className="bg-white rounded-xl p-4 border vi-border text-center">
          <p className="text-2xl font-bold vi-text">{ticketMetrics.avgResolution}</p>
          <p className="text-xs vi-text-muted font-semibold">Avg Resolution Time</p>
        </div>
        <div className="bg-white rounded-xl p-4 border vi-border text-center">
          <p className="text-2xl font-bold vi-text">{ticketMetrics.nps}</p>
          <p className="text-xs vi-text-muted font-semibold">NPS Score</p>
        </div>
        <div className="bg-white rounded-xl p-4 border vi-border text-center">
          <p className="text-2xl font-bold vi-text">{ticketMetrics.awaitingResponse}</p>
          <p className="text-xs vi-text-muted font-semibold">Awaiting Response</p>
        </div>
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg vi-text">{tc("details")}</h2>
          <span className="text-xs vi-text-muted">{recentTickets.length} showing</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">ID</th>
              <th className="px-5 py-3 font-semibold">Subject</th>
              <th className="px-5 py-3 font-semibold">User</th>
              <th className="px-5 py-3 font-semibold">Category</th>
              <th className="px-5 py-3 font-semibold">Priority</th>
              <th className="px-5 py-3 font-semibold">{tc("status")}</th>
              <th className="px-5 py-3 font-semibold">Age</th>
            </tr>
          </thead>
          <tbody>
            {recentTickets.map((t) => (
              <tr key={t.id} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3 font-mono text-xs vi-text-muted">{t.id}</td>
                <td className="px-5 py-3 font-medium vi-text max-w-xs truncate">{t.subject}</td>
                <td className="px-5 py-3 vi-text-muted">{t.user}</td>
                <td className="px-5 py-3"><span className="px-2 py-0.5 text-xs rounded-full vi-surface-soft vi-text-muted font-semibold">{t.category}</span></td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                    t.priority === "high" ? "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" : t.priority === "medium" ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" : "vi-surface-soft vi-text-muted"
                  }`}>{t.priority}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                    t.status === "open" ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : t.status === "in_progress" ? "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                  }`}>{t.status.replace(/_/g, " ")}</span>
                </td>
                <td className="px-5 py-3 vi-text-muted">{t.age}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">Ticket Categories</h2>
        <div className="space-y-3">
          {categoryBreakdown.map((cat) => (
            <div key={cat.category} className="flex items-center gap-4">
              <span className="text-sm font-semibold vi-text w-44">{cat.category}</span>
              <div className="flex-1 vi-surface-soft rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full bg-purple-400 transition-all" style={{ width: `${cat.pct}%` }} />
              </div>
              <span className="text-sm font-bold vi-text w-10 text-right">{cat.count}</span>
              <span className="text-xs vi-text-muted w-10 text-right">{cat.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
