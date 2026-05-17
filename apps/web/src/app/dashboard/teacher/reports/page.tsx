"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, AlertTriangle, TrendingUp, Target } from "lucide-react";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

export default function TeacherReportsPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("teacher");
  const [learners, setLearners] = useState<ConnectedLearner[]>([]);

  useEffect(() => {
    if (!accessToken || !user) return;
    fetch("/api/family/collaboration/connected-learners", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setLearners(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [accessToken, user]);

  if (loading || !user) return null;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-heading font-bold vi-text">{t("progress_reports")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="vi-card p-5 hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-2xl bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] flex items-center justify-center" aria-hidden="true">
              <BarChart3 size={20} strokeWidth={2.5} />
            </span>
            <div>
              <h3 className="font-semibold vi-text">Weekly Mastery Report</h3>
              <p className="text-xs vi-text-muted">Generated weekly</p>
            </div>
          </div>
          <p className="text-sm vi-text-muted">Track mastery progress across all your learners by subject and skill area.</p>
        </div>
        <div className="vi-card p-5 hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-2xl bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] flex items-center justify-center" aria-hidden="true">
              <AlertTriangle size={20} strokeWidth={2.5} />
            </span>
            <div>
              <h3 className="font-semibold vi-text">At-Risk Alerts</h3>
              <p className="text-xs vi-text-muted">Updated daily</p>
            </div>
          </div>
          <p className="text-sm vi-text-muted">Identify learners who may need additional support based on engagement and performance patterns.</p>
        </div>
        <div className="vi-card p-5 hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-2xl bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] flex items-center justify-center" aria-hidden="true">
              <TrendingUp size={20} strokeWidth={2.5} />
            </span>
            <div>
              <h3 className="font-semibold vi-text">Session Engagement</h3>
              <p className="text-xs vi-text-muted">Generated weekly</p>
            </div>
          </div>
          <p className="text-sm vi-text-muted">Monitor tutor session frequency, duration, and engagement metrics across your learners.</p>
        </div>
        <div className="vi-card p-5 hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center" aria-hidden="true">
              <Target size={20} strokeWidth={2.5} />
            </span>
            <div>
              <h3 className="font-semibold vi-text">IEP Progress</h3>
              <p className="text-xs vi-text-muted">Generated monthly</p>
            </div>
          </div>
          <p className="text-sm vi-text-muted">Track IEP goal progress for learners with individualized education plans.</p>
        </div>
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">{t("student_overview")}</h2>
        {learners.length === 0 ? (
          <p className="text-sm vi-text-muted">No learners connected. Reports will appear once parents invite you to their learner teams.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Learner roster and functioning-level summary</caption>
              <thead>
                <tr className="border-b vi-border">
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Learner</th>
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Grade</th>
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Functioning Level</th>
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {learners.map(l => (
                  <tr key={l.id} className="border-b vi-border hover:vi-surface-soft">
                    <th scope="row" className="py-3 px-4 font-medium vi-text text-left">{l.name}</th>
                    <td className="py-3 px-4 vi-text-muted">{l.gradeLevel || "\u2014"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-medium">
                        {l.functioningLevel || "Pending"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs rounded-full vi-surface-soft vi-text-muted font-medium" aria-label="Status unavailable">&mdash;</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
