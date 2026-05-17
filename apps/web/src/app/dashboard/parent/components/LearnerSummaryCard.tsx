"use client";
import { useRouter } from "next/navigation";
import {
  Flame,
  Star,
  Brain,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  ChevronRight,
  Target,
  TrendingUp,
} from "lucide-react";
import BrainCloneCard from "@/components/brain/BrainCloneCard";

interface LearnerSummaryCardProps {
  learner: {
    id: string;
    name: string;
    functioningLevel?: string;
    gradeLevel?: string;
    curriculumFramework?: string;
  };
  streak?: { currentStreak: number; longestStreak: number };
  badgeCount?: number;
  hasBrain?: boolean;
  pendingReview?: boolean;
  baselineCompleted?: boolean;
  pendingRecommendations?: number;
  /** Token used to fetch the brain preview. When omitted, the preview
   *  is hidden — the parent dashboard supplies it once authenticated. */
  accessToken?: string | null;
}

const LEVEL_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  SUPPORTED: "Supported",
  LOW_VERBAL: "Low Verbal",
  NON_VERBAL: "Non-Verbal",
  PRE_SYMBOLIC: "Emerging",
};

const LEVEL_STYLES: Record<string, string> = {
  STANDARD: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] border-[hsl(var(--visual-science)/0.3)]",
  SUPPORTED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] border-[hsl(var(--visual-reading)/0.3)]",
  LOW_VERBAL: "bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  NON_VERBAL: "bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
  PRE_SYMBOLIC: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] border-[hsl(var(--visual-math)/0.3)]",
};

export function LearnerSummaryCard({
  learner,
  streak,
  badgeCount = 0,
  hasBrain = false,
  pendingReview = false,
  baselineCompleted = false,
  pendingRecommendations = 0,
  accessToken,
}: Readonly<LearnerSummaryCardProps>) {
  const router = useRouter();

  type Status = {
    type: "action" | "attention" | "good";
    label: string;
    Icon: typeof CheckCircle2;
    container: string;
    iconWrap: string;
  };

  let status: Status = {
    type: "good",
    label: "On track",
    Icon: CheckCircle2,
    container: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] border-[hsl(var(--visual-science)/0.3)]",
    iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-science))]",
  };

  if (pendingReview) {
    status = {
      type: "action",
      label: "Brain review needed",
      Icon: AlertCircle,
      container: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))] border-[hsl(var(--visual-math)/0.3)]",
      iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-math))]",
    };
  } else if (pendingRecommendations > 0) {
    status = {
      type: "attention",
      label: `${pendingRecommendations} recommendation${pendingRecommendations > 1 ? "s" : ""} pending`,
      Icon: AlertCircle,
      container: "bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
      iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-sel))]",
    };
  } else if (!baselineCompleted && !hasBrain) {
    status = {
      type: "attention",
      label: "Assessment needed",
      Icon: ClipboardList,
      container: "bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] border-[hsl(var(--visual-sel)/0.3)]",
      iconWrap: "bg-[hsl(var(--visual-surface))] text-[hsl(var(--visual-sel))]",
    };
  }

  const goToLearner = () => router.push(`/dashboard/parent/learner/${learner.id}`);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/prefer-tag-over-role
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") goToLearner();
      }}
      onClick={goToLearner}
      className="group vi-card hover:shadow-lg hover:border-[hsl(var(--visual-primary)/0.4)] hover:-translate-y-0.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--visual-primary)/0.3)]"
    >
      <div className="p-5 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--visual-primary))] flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
              {learner.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-lg font-heading font-bold vi-text leading-tight">
                {learner.name}
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {learner.gradeLevel && (
                  <span className="text-xs font-semibold vi-text-muted">
                    Grade {learner.gradeLevel}
                  </span>
                )}
                {learner.functioningLevel && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${LEVEL_STYLES[learner.functioningLevel] || "vi-surface-soft vi-text-muted vi-border"}`}
                  >
                    <Target size={10} strokeWidth={3} aria-hidden="true" />
                    {LEVEL_LABELS[learner.functioningLevel] ||
                      learner.functioningLevel.replaceAll("_", " ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight
            className="vi-text-muted group-hover:text-[hsl(var(--visual-primary))] group-hover:translate-x-1 transition-all"
            size={20}
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>

        {(streak?.currentStreak || badgeCount > 0) && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {streak && streak.currentStreak > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-sel)/0.12)] border border-[hsl(var(--visual-sel)/0.3)] text-[hsl(var(--visual-sel))] text-xs font-bold">
                <Flame size={14} strokeWidth={2.5} aria-hidden="true" />
                {streak.currentStreak}-day streak
              </span>
            )}
            {badgeCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--visual-sel)/0.12)] border border-[hsl(var(--visual-sel)/0.3)] text-[hsl(var(--visual-sel))] text-xs font-bold">
                <Star size={14} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
                {badgeCount} badge{badgeCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )}

        {/* Brain map preview — only shown once the brain has been built.
            Stops click-bubbling so interacting with the brain (hover/click
            a region) does not also navigate to the learner detail page. */}
        {/* Brain Clone preview — compact variant for the dashboard card.
            Stops click-bubbling so interacting with the brain (hover/click
            a region) does not also navigate to the learner detail page. */}
        {hasBrain && accessToken && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
          <div
            className="mb-4"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <BrainCloneCard
              learnerId={learner.id}
              learnerName={learner.name}
              enrolledGrade={learner.gradeLevel ?? null}
              accessToken={accessToken}
              variant="card"
              summary={{ streak, badgeCount }}
            />
          </div>
        )}

        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm border ${status.container}`}
        >
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${status.iconWrap}`}
          >
            <status.Icon size={16} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="font-bold">{status.label}</span>
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <fieldset
          className="flex gap-2 mt-4 flex-wrap border-0 p-0 m-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => router.push(`/dashboard/parent/learner/${learner.id}/progress`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] font-bold hover:bg-[hsl(var(--visual-primary)/0.2)] transition border border-[hsl(var(--visual-primary)/0.3)]"
            style={{ minHeight: 44 }}
          >
            <TrendingUp size={14} strokeWidth={2.5} aria-hidden="true" />
            View Progress
          </button>
          {hasBrain && (
            <button
              onClick={() => router.push(`/dashboard/parent/learner/${learner.id}/brain`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] font-bold hover:bg-[hsl(var(--visual-science)/0.2)] transition border border-[hsl(var(--visual-science)/0.3)]"
              style={{ minHeight: 44 }}
            >
              <Brain size={14} strokeWidth={2.5} aria-hidden="true" />
              Open Brain
            </button>
          )}
          {pendingReview && (
            <button
              onClick={() => router.push(`/dashboard/parent/learner/${learner.id}/brain-review`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] font-bold hover:bg-[hsl(var(--visual-sel)/0.2)] transition border-2 border-[hsl(var(--visual-sel)/0.3)]"
              style={{ minHeight: 44 }}
            >
              <AlertCircle size={14} strokeWidth={2.5} aria-hidden="true" />
              Review Brain
            </button>
          )}
          {!baselineCompleted && !hasBrain && (
            <button
              onClick={() => router.push(`/dashboard/parent/learner/${learner.id}/assessment`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-full bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] font-bold hover:bg-[hsl(var(--visual-reading)/0.2)] transition border border-[hsl(var(--visual-reading)/0.3)]"
              style={{ minHeight: 44 }}
            >
              <ClipboardList size={14} strokeWidth={2.5} aria-hidden="true" />
              Start Assessment
            </button>
          )}
        </fieldset>
      </div>
    </div>
  );
}
