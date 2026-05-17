"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import BrainVisualization from "@/components/BrainVisualization";
import { useTranslations } from "next-intl";
import LearnerCardSkeleton from "@/components/states/LearnerCardSkeleton";
import FetchErrorState from "@/components/states/FetchErrorState";
import EmptyLearnerState from "@/components/states/EmptyLearnerState";
import { IconWell, StatIconWell } from "@/components/discovery/_vi";
import {
  HeartPulse,
  Users,
  Target,
  CheckCircle2,
  Layers,
  ChevronUp,
  ChevronDown,
  Brain,
  Sparkles,
  Heart,
} from "lucide-react";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

interface TherapyGoal {
  id: string;
  learnerId: string;
  title: string;
  category: string;
  progressPct: number;
  targetDate?: string;
  status: string;
}

const LEVEL_STYLES: Record<string, string> = {
  STANDARD: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] border-[hsl(var(--visual-science)/0.3)]",
  SUPPORTED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] border-[hsl(var(--visual-reading)/0.3)]",
  LOW_VERBAL: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  NON_VERBAL: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  PRE_SYMBOLIC: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] border-[hsl(var(--visual-math)/0.3)]",
};

export default function TherapistCaseloadPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("therapist");
  const [learners, setLearners] = useState<ConnectedLearner[]>([]);
  const [therapyGoals, setTherapyGoals] = useState<TherapyGoal[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken || !user) return;
    setFetchError(false);
    setLoadingData(true);
    try {
      const [learnersData, goalsData] = await Promise.all([
        fetch("/api/family/collaboration/connected-learners", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/family/therapy-goals", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => (r.ok ? r.json() : { goals: [] }))
          .catch(() => ({ goals: [] })),
      ]);
      setLearners(Array.isArray(learnersData) ? learnersData : []);
      setTherapyGoals(Array.isArray(goalsData?.goals) ? goalsData.goals : []);
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

  const getGoalsForLearner = (learnerId: string) =>
    therapyGoals.filter((g) => g.learnerId === learnerId);
  const activeGoals = therapyGoals.filter(
    (g) => g.status === "active" || g.status === "in_progress",
  );
  const completedGoals = therapyGoals.filter(
    (g) => g.status === "completed" || g.status === "met",
  );

  const levelDistribution = learners.reduce(
    (acc: Record<string, number>, l) => {
      const level = l.functioningLevel || "Pending";
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto vi-bg">
      <header className="flex items-center gap-4">
        <IconWell color="math">
          <HeartPulse size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold vi-text leading-tight">
            {t("dashboard")}
          </h1>
          <p className="text-sm vi-text-muted font-medium mt-1">
            Your caseload at a glance.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="vi-card p-5">
          <StatIconWell color="math" className="mb-3">
            <Users size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-3xl font-black text-[hsl(var(--visual-math))] leading-none">
            {learners.length}
          </p>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
            Active Clients
          </p>
        </div>

        <div className="vi-card p-5">
          <StatIconWell color="primary" className="mb-3">
            <Target size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-3xl font-black text-[hsl(var(--visual-primary))] leading-none">
            {activeGoals.length}
          </p>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
            Active Goals
          </p>
        </div>

        <div className="vi-card p-5">
          <StatIconWell color="science" className="mb-3">
            <CheckCircle2 size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-3xl font-black text-[hsl(var(--visual-science))] leading-none">
            {completedGoals.length}
          </p>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
            Goals Met
          </p>
        </div>

        <div className="vi-card p-5 col-span-2 lg:col-span-1">
          <StatIconWell color="primary" className="mb-3">
            <Layers size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mb-2">
            Functioning Levels
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(levelDistribution).map(([level, count]) => (
              <span
                key={level}
                className={`px-2 py-0.5 text-[11px] rounded-full font-bold border ${LEVEL_STYLES[level] || "vi-surface-soft vi-text-muted vi-border"}`}
              >
                {level}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {loadingData ? (
        <LearnerCardSkeleton count={4} />
      ) : fetchError ? (
        <FetchErrorState title="Unable to load clients" onRetry={fetchData} />
      ) : learners.length === 0 ? (
        <EmptyLearnerState
          Icon={Heart}
          tone="math"
          title="No clients connected yet"
          description="Parents can invite you to their learner's care team from the Collaboration page in their dashboard."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {learners.map((l) => {
            const goals = getGoalsForLearner(l.id);
            const isExpanded = expandedClient === l.id;
            return (
              <div
                key={l.id}
                className={`vi-card transition-all ${
                  isExpanded
                    ? "border-[hsl(var(--visual-math))] shadow-lg"
                    : "hover:shadow-md hover:border-[hsl(var(--visual-math)/0.4)] hover:-translate-y-0.5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedClient(isExpanded ? null : l.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`client-details-${l.id}`}
                  className="w-full text-left p-6 focus:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--visual-math)/0.3)] rounded-3xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[hsl(var(--visual-math))] text-white flex items-center justify-center font-black text-base shrink-0">
                      {l.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-heading font-bold vi-text leading-tight">
                        {l.name}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {l.gradeLevel && (
                          <span className="text-xs font-semibold vi-text-muted">
                            Grade {l.gradeLevel}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full font-bold border ${LEVEL_STYLES[l.functioningLevel] || "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] border-[hsl(var(--visual-primary)/0.3)]"}`}
                        >
                          <Target size={10} strokeWidth={3} aria-hidden="true" />
                          {l.functioningLevel || "Pending"}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp
                        size={20}
                        strokeWidth={2.5}
                        className="text-[hsl(var(--visual-math))] shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        size={20}
                        strokeWidth={2.5}
                        className="vi-text-muted shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {goals.length > 0 && (
                    <div>
                      <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <Sparkles
                          size={12}
                          strokeWidth={2.5}
                          className="text-[hsl(var(--visual-math))]"
                          aria-hidden="true"
                        />
                        Therapy Goals ({goals.length})
                      </p>
                      <div className="space-y-3">
                        {goals.slice(0, isExpanded ? undefined : 2).map((g) => (
                          <div key={g.id} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-800 truncate">
                                {g.title}
                              </p>
                              <div
                                className="w-full vi-surface-soft rounded-full h-3 mt-1.5 overflow-hidden"
                                role="progressbar"
                                aria-valuenow={g.progressPct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${g.title} progress`}
                              >
                                <div
                                  className="h-full rounded-full bg-[hsl(var(--visual-math))] transition-all"
                                  style={{ width: `${g.progressPct}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-[hsl(var(--visual-math))] font-black shrink-0">
                              {g.progressPct}%
                            </span>
                          </div>
                        ))}
                        {!isExpanded && goals.length > 2 && (
                          <p className="text-xs text-[hsl(var(--visual-math))] font-bold">
                            +{goals.length - 2} more goals
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </button>

                {isExpanded && accessToken && (
                  <div
                    id={`client-details-${l.id}`}
                    className="px-6 pb-6 border-t vi-border"
                  >
                    <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-4 mb-3 flex items-center gap-1.5">
                      <Brain
                        size={12}
                        strokeWidth={2.5}
                        className="text-[hsl(var(--visual-primary))]"
                        aria-hidden="true"
                      />
                      Brain Profile
                    </p>
                    <BrainVisualization
                      learnerId={l.id}
                      learnerName={l.name}
                      accessToken={accessToken}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
