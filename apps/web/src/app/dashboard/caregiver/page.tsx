"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import BrainVisualization from "@/components/BrainVisualization";
import { useTranslations } from "next-intl";
import LearnerCardSkeleton from "@/components/states/LearnerCardSkeleton";
import FetchErrorState from "@/components/states/FetchErrorState";
import EmptyLearnerState from "@/components/states/EmptyLearnerState";
import { StatIconWell } from "@/components/discovery/_vi";
import {
  HandHeart,
  User,
  Target,
  ClipboardCheck,
  Users,
  Brain,
  ChevronDown,
  Sparkles,
  Sprout,
} from "lucide-react";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

interface IepGoal {
  id: string;
  learnerId: string;
  title: string;
  progressPct: number;
  targetDate?: string;
  status: string;
}

const LEVEL_STYLES: Record<string, string> = {
  STANDARD:
    "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] border-[hsl(var(--visual-science)/0.3)]",
  SUPPORTED:
    "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] border-[hsl(var(--visual-reading)/0.3)]",
  LOW_VERBAL:
    "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  NON_VERBAL:
    "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  PRE_SYMBOLIC:
    "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] border-[hsl(var(--visual-math)/0.3)]",
};

export default function CaregiverOverviewPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("caregiver");
  const [learners, setLearners] = useState<ConnectedLearner[]>([]);
  const [iepGoals, setIepGoals] = useState<IepGoal[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedLearner, setSelectedLearner] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken || !user) return;
    setFetchError(false);
    setLoadingData(true);
    try {
      const [learnersData, goalsData] = await Promise.all([
        fetch("/api/family/collaboration/connected-learners", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/family/iep-goals", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => (r.ok ? r.json() : { goals: [] }))
          .catch(() => ({ goals: [] })),
      ]);
      const parsed = Array.isArray(learnersData) ? learnersData : [];
      setLearners(parsed);
      setIepGoals(Array.isArray(goalsData?.goals) ? goalsData.goals : []);
      setSelectedLearner((prev) => {
        if (prev && parsed.some((l) => l.id === prev)) return prev;
        return parsed.length > 0 ? parsed[0].id : null;
      });
    } catch {
      setFetchError(true);
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading || !user) return null;

  const activeLearner = learners.find((l) => l.id === selectedLearner);
  const learnerGoals = iepGoals.filter((g) => g.learnerId === selectedLearner);
  const activeGoalCount = iepGoals.filter(
    (g) => g.status === "active" || g.status === "in_progress",
  ).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] flex items-center justify-center shrink-0">
            <HandHeart size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold vi-text leading-tight">
              {t("dashboard")}
            </h1>
            <p className="text-sm vi-text-muted font-medium mt-1">
              Supporting your learners' journey.
            </p>
          </div>
        </div>
        {learners.length > 1 && (
          <div className="relative">
            <select
              value={selectedLearner || ""}
              onChange={(e) => setSelectedLearner(e.target.value)}
              aria-label="Select learner"
              className="appearance-none pl-4 pr-10 py-2.5 rounded-full border vi-border text-sm font-bold bg-[hsl(var(--visual-surface))] vi-text focus:outline-none focus:ring-4 focus:ring-[hsl(var(--visual-science)/0.25)]"
              style={{ minHeight: 44 }}
            >
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              strokeWidth={2.5}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--visual-science))] pointer-events-none"
              aria-hidden="true"
            />
          </div>
        )}
      </header>

      {loadingData ? (
        <LearnerCardSkeleton count={3} />
      ) : fetchError ? (
        <FetchErrorState title="Unable to load data" onRetry={fetchData} />
      ) : learners.length === 0 ? (
        <EmptyLearnerState
          Icon={Sprout}
          tone="science"
          title="No learners connected yet"
          description="Parents can invite you to their learner's care team from the Collaboration page in their dashboard."
        />
      ) : (
        activeLearner && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="vi-card p-5">
                <StatIconWell color="science" className="mb-3">
                  <User size={22} strokeWidth={2.5} aria-hidden="true" />
                </StatIconWell>
                <p className="text-xl font-black vi-text leading-tight">{activeLearner.name}</p>
                <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
                  Grade {activeLearner.gradeLevel || "—"}
                </p>
              </div>

              <div className="vi-card p-5">
                <StatIconWell color="primary" className="mb-3">
                  <Target size={22} strokeWidth={2.5} aria-hidden="true" />
                </StatIconWell>
                <p className="text-xl font-black text-[hsl(var(--visual-primary))] leading-tight">
                  {activeLearner.functioningLevel || "Pending"}
                </p>
                <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
                  Functioning Level
                </p>
              </div>

              <div className="vi-card p-5">
                <StatIconWell color="sel" className="mb-3">
                  <ClipboardCheck size={22} strokeWidth={2.5} aria-hidden="true" />
                </StatIconWell>
                <p className="text-3xl font-black text-[hsl(var(--visual-sel))] leading-none">
                  {learnerGoals.length}
                </p>
                <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
                  IEP Goals · {activeGoalCount} active
                </p>
              </div>

              <div className="vi-card p-5">
                <StatIconWell color="reading" className="mb-3">
                  <Users size={22} strokeWidth={2.5} aria-hidden="true" />
                </StatIconWell>
                <p className="text-3xl font-black text-[hsl(var(--visual-reading))] leading-none">
                  {learners.length}
                </p>
                <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
                  Connected Learners
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="vi-card p-6">
                <h3 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center shrink-0">
                    <Brain size={18} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  {t("progress_tracking")}
                </h3>
                {accessToken && (
                  <BrainVisualization
                    learnerId={activeLearner.id}
                    learnerName={activeLearner.name}
                    accessToken={accessToken}
                    compact
                  />
                )}
              </div>

              <div className="vi-card p-6">
                <h3 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] flex items-center justify-center shrink-0">
                    <ClipboardCheck size={18} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  {t("iep_goals")}
                </h3>
                {learnerGoals.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 rounded-2xl vi-surface-soft border vi-border">
                    <Sparkles
                      size={18}
                      strokeWidth={2.5}
                      className="vi-text-muted shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-sm vi-text-muted font-medium">
                      No IEP goals recorded for this learner.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {learnerGoals.slice(0, 4).map((g) => (
                      <div key={g.id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-bold text-slate-800 truncate">{g.title}</p>
                          <span className="text-xs text-[hsl(var(--visual-science))] font-black ml-2 shrink-0">
                            {g.progressPct}%
                          </span>
                        </div>
                        <div
                          className="w-full bg-[hsl(var(--visual-surface-soft))] rounded-full h-3 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={g.progressPct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${g.title} progress`}
                        >
                          <div
                            className="h-full rounded-full bg-[hsl(var(--visual-science))] transition-all"
                            style={{ width: `${g.progressPct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {learners.length > 1 && (
              <div className="vi-card p-6">
                <h3 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] flex items-center justify-center shrink-0">
                    <Users size={18} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  {t("my_learners")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {learners.map((l) => {
                    const isActive = l.id === selectedLearner;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setSelectedLearner(l.id)}
                        style={{ minHeight: 44 }}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${
                          isActive
                            ? "border-[hsl(var(--visual-science))] bg-[hsl(var(--visual-science)/0.08)] shadow-md"
                            : "vi-border hover:border-[hsl(var(--visual-science)/0.5)] bg-[hsl(var(--visual-surface))] hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                              isActive
                                ? "bg-[hsl(var(--visual-science))] text-white"
                                : "vi-surface-soft vi-text-muted"
                            }`}
                          >
                            {l.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold vi-text truncate">{l.name}</p>
                            <p className="text-xs vi-text-muted font-semibold mt-0.5 truncate">
                              Grade {l.gradeLevel || "—"} · {l.functioningLevel || "Pending"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
