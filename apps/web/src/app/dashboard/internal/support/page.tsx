"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function SupportDashboard() {
  const { accessToken } = useAuth();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [statusOverview, setStatusOverview] = useState<any>(null);

  useEffect(() => {
    fetch("/api/status/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatusOverview)
      .catch(() => {});
  }, []);

  const escalations = [
    {
      id: "ESC-201",
      title: "Brain-svc 502 errors during peak hours",
      severity: "P1",
      assignee: "Backend Team",
      status: "investigating",
      age: "2h",
      affected: 12,
    },
    {
      id: "ESC-200",
      title: "Baseline assessment data loss — 3 reports",
      severity: "P2",
      assignee: "Data Team",
      status: "mitigating",
      age: "1d",
      affected: 3,
    },
    {
      id: "ESC-199",
      title: "iOS app crash on learner dashboard",
      severity: "P2",
      assignee: "Mobile Team",
      status: "fix_deployed",
      age: "3d",
      affected: 45,
    },
    {
      id: "ESC-198",
      title: "Slow tutor response times > 10s",
      severity: "P3",
      assignee: "AI Team",
      status: "monitoring",
      age: "5d",
      affected: 28,
    },
  ];

  const knowledgeBase = [
    {
      title: "Brain Clone Troubleshooting Guide",
      articles: 12,
      lastUpdated: "2d ago",
      category: "Brain System",
    },
    {
      title: "Baseline Assessment FAQ",
      articles: 8,
      lastUpdated: "1w ago",
      category: "Assessments",
    },
    {
      title: "Parent Onboarding Playbook",
      articles: 15,
      lastUpdated: "3d ago",
      category: "Onboarding",
    },
    {
      title: "Billing & Subscription Issues",
      articles: 6,
      lastUpdated: "1w ago",
      category: "Billing",
    },
    { title: "IEP Upload & Processing", articles: 5, lastUpdated: "2w ago", category: "Documents" },
    {
      title: "Functioning Level Explanations",
      articles: 10,
      lastUpdated: "1w ago",
      category: "Brain System",
    },
  ];

  const commonIssues = [
    {
      issue: "Brain clone stuck in 'building' state",
      occurrences: 18,
      resolution: "Clear brain_states cache, re-trigger clone",
      avgResolveTime: "15min",
    },
    {
      issue: "Parent can't see learner after approval",
      occurrences: 12,
      resolution: "Check tenant association, verify learner.parentId",
      avgResolveTime: "10min",
    },
    {
      issue: "Assessment not saving progress",
      occurrences: 8,
      resolution: "Check assessment_attempts status, verify session",
      avgResolveTime: "20min",
    },
    {
      issue: "Tutor chat unresponsive",
      occurrences: 6,
      resolution: "Check ai-svc health, verify LLM API key",
      avgResolveTime: "5min",
    },
    {
      issue: "Login 401 after password reset",
      occurrences: 5,
      resolution: "Clear browser cache, re-issue JWT",
      avgResolveTime: "5min",
    },
  ];

  const healthyCount =
    statusOverview?.services?.filter((s: any) => s.status === "healthy").length ?? 0;
  const totalServices = statusOverview?.services?.length ?? 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text">{t("overview")}</h1>
        <p className="text-sm vi-text-muted mt-1">
          Escalation management, knowledge base, and system diagnostics.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">
            {escalations.filter((e) => e.status !== "fix_deployed").length}
          </p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Active Escalations</p>
        </div>
        <div className="bg-white rounded-xl p-5 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">
            {healthyCount}/{totalServices}
          </p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Services Online</p>
        </div>
        <div className="bg-white rounded-xl p-5 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">
            {knowledgeBase.reduce((s, kb) => s + kb.articles, 0)}
          </p>
          <p className="text-xs vi-text-muted font-semibold mt-1">KB Articles</p>
        </div>
        <div className="bg-white rounded-xl p-5 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">88%</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">First Contact Resolution</p>
        </div>
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border">
          <h2 className="font-heading font-bold text-lg vi-text">Active Escalations</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
              <th className="px-5 py-3 font-semibold">ID</th>
              <th className="px-5 py-3 font-semibold">Issue</th>
              <th className="px-5 py-3 font-semibold">Severity</th>
              <th className="px-5 py-3 font-semibold">Assignee</th>
              <th className="px-5 py-3 font-semibold">{tc("status")}</th>
              <th className="px-5 py-3 font-semibold">Affected</th>
              <th className="px-5 py-3 font-semibold">Age</th>
            </tr>
          </thead>
          <tbody>
            {escalations.map((e) => (
              <tr key={e.id} className="border-b vi-border hover:vi-bg/50 transition">
                <td className="px-5 py-3 font-mono text-xs vi-text-muted">{e.id}</td>
                <td className="px-5 py-3 font-medium vi-text max-w-xs truncate">{e.title}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                      e.severity === "P1"
                        ? "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                        : e.severity === "P2"
                          ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                          : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                    }`}
                  >
                    {e.severity}
                  </span>
                </td>
                <td className="px-5 py-3 vi-text-muted">{e.assignee}</td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                      e.status === "investigating"
                        ? "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                        : e.status === "mitigating"
                          ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                          : e.status === "monitoring"
                            ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                            : "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                    }`}
                  >
                    {e.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-5 py-3 vi-text-muted">{e.affected} users</td>
                <td className="px-5 py-3 vi-text-muted">{e.age}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">Common Issues & Runbooks</h2>
          <div className="space-y-3">
            {commonIssues.map((ci) => (
              <div key={ci.issue} className="p-4 rounded-xl border vi-border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold vi-text">{ci.issue}</p>
                  <span className="text-xs vi-text-muted">{ci.occurrences}x / 30d</span>
                </div>
                <p className="text-xs vi-text-muted">{ci.resolution}</p>
                <p className="text-[10px] vi-text-muted mt-1">Avg resolve: {ci.avgResolveTime}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">Knowledge Base</h2>
          <div className="space-y-3">
            {knowledgeBase.map((kb) => (
              <div
                key={kb.title}
                className="flex items-center justify-between p-3 rounded-xl border vi-border hover:border-[hsl(var(--visual-primary)/0.3)] transition"
              >
                <div>
                  <p className="text-sm font-medium vi-text">{kb.title}</p>
                  <p className="text-xs vi-text-muted">
                    {kb.category} &middot; {kb.articles} articles &middot; Updated {kb.lastUpdated}
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
