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
  Users,
  GraduationCap,
  Layers,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  Settings,
  Target,
  BookOpen,
} from "lucide-react";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

interface ClassroomGroup {
  grade: string;
  learners: ConnectedLearner[];
}

const LEVEL_STYLES: Record<string, string> = {
  STANDARD:
    "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] border-[hsl(var(--visual-science)/0.3)]",
  SUPPORTED:
    "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] border-[hsl(var(--visual-reading)/0.3)]",
  LOW_VERBAL:
    "bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  NON_VERBAL:
    "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  PRE_SYMBOLIC:
    "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] border-[hsl(var(--visual-math)/0.3)]",
};

export default function TeacherOverviewPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("teacher");
  const [learners, setLearners] = useState<ConnectedLearner[]>([]);
  const [loadingLearners, setLoadingLearners] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [expandedLearner, setExpandedLearner] = useState<string | null>(null);

  const fetchLearners = useCallback(async () => {
    if (!accessToken || !user) return;
    setFetchError(false);
    setLoadingLearners(true);
    try {
      const r = await fetch("/api/family/collaboration/connected-learners", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) {
        setFetchError(true);
        return;
      }
      const data = await r.json();
      setLearners(Array.isArray(data) ? data : []);
    } catch {
      setFetchError(true);
    } finally {
      setLoadingLearners(false);
    }
  }, [accessToken, user]);

  useEffect(() => {
    fetchLearners();
  }, [fetchLearners]);

  if (loading || !user) return null;

  const classrooms: ClassroomGroup[] = Object.values(
    learners.reduce((acc: Record<string, ClassroomGroup>, l) => {
      const grade = l.gradeLevel || "Unassigned";
      if (!acc[grade]) acc[grade] = { grade, learners: [] };
      acc[grade].learners.push(l);
      return acc;
    }, {}),
  );

  const totalLearners = learners.length;
  const functioningLevels = learners.reduce((acc: Record<string, number>, l) => {
    const level = l.functioningLevel || "Pending";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] flex items-center justify-center shrink-0">
          <GraduationCap size={28} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold vi-text leading-tight">
            {t("my_classes")}
          </h1>
          <p className="text-sm vi-text-muted font-medium mt-1">Your classroom at a glance.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="vi-card p-5">
          <StatIconWell color="reading" className="mb-3">
            <Users size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-3xl font-black text-[hsl(var(--visual-reading))] leading-none">
            {totalLearners}
          </p>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
            Total Learners
          </p>
        </div>

        <div className="vi-card p-5">
          <StatIconWell color="primary" className="mb-3">
            <Layers size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-3xl font-black text-[hsl(var(--visual-primary))] leading-none">
            {classrooms.length}
          </p>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mt-1.5">
            Grade Groups
          </p>
        </div>

        <div className="vi-card p-5 col-span-2 lg:col-span-1">
          <StatIconWell color="primary" className="mb-3">
            <Target size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mb-2">
            Functioning Levels
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(functioningLevels).map(([level, count]) => (
              <span
                key={level}
                className={`px-2 py-0.5 text-[11px] rounded-full font-bold border ${LEVEL_STYLES[level] || "vi-surface-soft vi-text-muted vi-border"}`}
              >
                {level}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="vi-card p-5 col-span-2 lg:col-span-1">
          <StatIconWell color="sel" className="mb-3">
            <Sparkles size={22} strokeWidth={2.5} aria-hidden="true" />
          </StatIconWell>
          <p className="text-xs vi-text-muted font-bold uppercase tracking-wide mb-2">
            Quick Actions
          </p>
          <div className="flex flex-col gap-1.5">
            <a
              href="/dashboard/teacher/reports"
              className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--visual-reading))] hover:underline font-bold"
            >
              <FileText size={14} strokeWidth={2.5} aria-hidden="true" />
              View Reports
            </a>
            <a
              href="/dashboard/teacher/settings"
              className="inline-flex items-center gap-1.5 text-sm vi-text hover:underline font-bold"
            >
              <Settings size={14} strokeWidth={2.5} aria-hidden="true" />
              Settings
            </a>
          </div>
        </div>
      </div>

      {loadingLearners ? (
        <LearnerCardSkeleton count={6} />
      ) : fetchError ? (
        <FetchErrorState title="Unable to load learners" onRetry={fetchLearners} />
      ) : learners.length === 0 ? (
        <EmptyLearnerState Icon={BookOpen} tone="reading" />
      ) : (
        <div className="space-y-6">
          {classrooms.map((group) => (
            <div key={group.grade} className="vi-card overflow-hidden">
              <div className="px-6 py-4 border-b vi-border vi-surface-soft flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-2xl bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] flex items-center justify-center text-sm font-black"
                    aria-hidden="true"
                  >
                    {group.grade.replace(/[^0-9KkPp]/g, "").toUpperCase() || "?"}
                  </span>
                  <div>
                    <h3 className="font-heading font-bold vi-text">Grade {group.grade}</h3>
                    <p className="text-xs vi-text-muted font-bold uppercase tracking-wide">
                      {group.learners.length} learner
                      {group.learners.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.learners.map((l) => {
                    const isOpen = expandedLearner === l.id;
                    return (
                      <div
                        key={l.id}
                        className={`rounded-2xl border-2 transition-all ${
                          isOpen
                            ? "border-[hsl(var(--visual-reading))] bg-[hsl(var(--visual-reading)/0.06)]"
                            : "vi-border bg-[hsl(var(--visual-surface))] hover:shadow-sm"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedLearner(isOpen ? null : l.id)}
                          aria-expanded={isOpen}
                          aria-controls={`learner-details-${l.id}`}
                          className="w-full text-left p-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--visual-reading)/0.3)] rounded-2xl"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--visual-reading))] text-white flex items-center justify-center font-black text-sm shrink-0">
                              {l.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold vi-text truncate">{l.name}</h4>
                              {l.gradeLevel && (
                                <p className="text-xs vi-text-muted font-semibold">
                                  Grade {l.gradeLevel}
                                </p>
                              )}
                            </div>
                            {isOpen ? (
                              <ChevronUp
                                size={18}
                                strokeWidth={2.5}
                                className="text-[hsl(var(--visual-reading))] shrink-0"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                size={18}
                                strokeWidth={2.5}
                                className="vi-text-muted shrink-0"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] rounded-full font-bold border ${LEVEL_STYLES[l.functioningLevel] || "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] border-[hsl(var(--visual-primary)/0.3)]"}`}
                          >
                            <Target size={10} strokeWidth={3} aria-hidden="true" />
                            {l.functioningLevel || "Pending"}
                          </span>
                        </button>
                        {isOpen && accessToken && (
                          <div
                            id={`learner-details-${l.id}`}
                            className="px-4 pb-4 border-t vi-border space-y-3"
                          >
                            <BrainVisualization
                              learnerId={l.id}
                              learnerName={l.name}
                              accessToken={accessToken}
                              compact
                            />
                            <a
                              href={`/dashboard/iep-evaluation/${l.id}`}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] hover:bg-[hsl(var(--visual-reading)/0.18)] transition"
                            >
                              <FileText size={12} strokeWidth={2.5} aria-hidden="true" />
                              Open IEP evaluation
                              <ArrowRight size={12} strokeWidth={2.5} aria-hidden="true" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
