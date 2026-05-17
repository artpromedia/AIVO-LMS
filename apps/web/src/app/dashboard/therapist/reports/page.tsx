"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface TherapyGoal {
  id: string;
  learnerId: string;
  title: string;
  category: string;
  progressPct: number;
  targetDate?: string;
  status: string;
}

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

export default function TherapistReportsPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("therapist");
  const [learners, setLearners] = useState<ConnectedLearner[]>([]);
  const [therapyGoals, setTherapyGoals] = useState<TherapyGoal[]>([]);

  useEffect(() => {
    if (!accessToken || !user) return;
    Promise.all([
      fetch("/api/family/collaboration/connected-learners", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(r => r.ok ? r.json() : []),
      fetch("/api/family/therapy-goals", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(r => r.ok ? r.json() : { goals: [] }).catch(() => ({ goals: [] })),
    ]).then(([learnersData, goalsData]) => {
      setLearners(Array.isArray(learnersData) ? learnersData : []);
      setTherapyGoals(Array.isArray(goalsData?.goals) ? goalsData.goals : []);
    }).catch(() => {});
  }, [accessToken, user]);

  if (loading || !user) return null;

  return (
    <div className="p-8 space-y-6 vi-bg">
      <h1 className="text-3xl font-heading font-bold vi-text">{t("iep_goals")}</h1>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">Therapy Goals Overview</h2>
        {therapyGoals.length === 0 ? (
          <p className="text-sm vi-text-muted">No therapy goals recorded yet. Goals will appear as they are added to learner IEP profiles.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Therapy goals for all clients</caption>
              <thead>
                <tr className="border-b vi-border">
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Learner</th>
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Goal</th>
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Category</th>
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Progress</th>
                  <th scope="col" className="text-left py-3 px-4 vi-text-muted font-semibold text-xs uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {therapyGoals.map(g => {
                  const learner = learners.find(l => l.id === g.learnerId);
                  return (
                    <tr key={g.id} className="border-b vi-border hover:vi-surface-soft">
                      <td className="py-3 px-4 font-medium vi-text">{learner?.name || "Unknown"}</td>
                      <td className="py-3 px-4 vi-text-muted">{g.title}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] font-bold">{g.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 vi-surface-soft rounded-full h-1.5" role="progressbar" aria-valuenow={g.progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.title} progress`}>
                            <div className="h-1.5 rounded-full bg-[hsl(var(--visual-math))]" style={{ width: `${g.progressPct}%` }} />
                          </div>
                          <span className="text-xs vi-text-muted">{g.progressPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${g.status === "completed" || g.status === "met" ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]" : "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]"}`}>
                          {g.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
