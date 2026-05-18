"use client";
/**
 * BrainCloneCard
 * --------------
 * Data-bound wrapper around `BrainCloneInteractive`. Fetches the brain
 * state, mastery snapshot, accommodations and tutor recommendations from
 * the existing `/api/brain/{learnerId}` endpoint and shapes them into
 * the `regions` + `metrics` shape `BrainCloneInteractive` expects.
 *
 * Renders three states:
 *  - loading    → tier-themed skeleton
 *  - no-brain   → friendly empty card, links to baseline / brain-review
 *  - ready      → the interactive brain
 *
 * Used in two places:
 *  - parent dashboard home (compact, `variant="card"`)
 *  - `/dashboard/parent/learner/[id]/brain` (full, `variant="full"`)
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, ClipboardList } from "lucide-react";
import BrainCloneInteractive, {
  type BrainRegionDatum,
  type BrainCloneMetrics,
} from "./BrainCloneInteractive";

interface BrainState {
  masteryLevels?: Record<string, number>;
  activeAccommodations?: string[];
  activeTutors?: string[];
  // The XAI explanation (if available) gives us per-domain reasoning.
  xaiExplanation?: {
    mastery_decisions?: Array<{ domain: string; score: number; display_label?: string }>;
    accommodation_decisions?: Array<{
      accommodation: string;
      display_label?: string;
      affects_domains?: string[];
    }>;
    tutor_decisions?: Array<{ tutor_key: string; reasoning?: string; affects_domains?: string[] }>;
  };
  updatedAt?: string;
  version?: number;
}

interface SummaryStats {
  streak?: { currentStreak: number };
  totalXp?: number;
  badgeCount?: number;
  masteryDeltaWeek?: number;
  nextMilestone?: string;
}

interface BrainCloneCardProps {
  learnerId: string;
  learnerName: string;
  enrolledGrade?: string | number | null;
  accessToken: string | null;
  variant?: "card" | "full";
  /** Optional pre-computed summary so the parent dashboard can hand
   *  in the streak/XP it already fetched without an extra round-trip. */
  summary?: SummaryStats;
}

const DOMAIN_LABELS: Record<string, string> = {
  ela: "Reading",
  english: "Reading",
  reading: "Reading",
  math: "Math",
  mathematics: "Math",
  science: "Science",
  sel: "Social-Emotional",
  social_emotional: "Social-Emotional",
  social: "Social-Emotional",
  speech: "Communication",
  communication: "Communication",
  language: "Communication",
  executive_function: "Executive Function",
  ef: "Executive Function",
  exec: "Executive Function",
};

function labelFor(domain: string): string {
  const key = domain.toLowerCase().replace(/[\s-]+/g, "_");
  return DOMAIN_LABELS[key] || domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BrainCloneCard({
  learnerId,
  learnerName,
  enrolledGrade,
  accessToken,
  variant = "card",
  summary,
}: BrainCloneCardProps) {
  const router = useRouter();
  const [state, setState] = useState<BrainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!accessToken || !learnerId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/brain/${learnerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          // The brain API camelCases top-level columns, but the legacy
          // `state` jsonb column keeps snake_case keys (e.g.
          // `mastery_levels`). Some installs only ever populated the
          // legacy jsonb and left the dedicated columns empty. Merge so
          // either source produces a usable BrainState.
          const nested = data?.state ?? {};
          const hasTopLevelMastery =
            data?.masteryLevels && Object.keys(data.masteryLevels).length > 0;
          const masteryLevels = hasTopLevelMastery
            ? data.masteryLevels
            : (nested.mastery_levels ?? nested.masteryLevels ?? {});
          const activeAccommodations =
            (data?.activeAccommodations && data.activeAccommodations.length
              ? data.activeAccommodations
              : (nested.active_accommodations ?? nested.activeAccommodations)) ?? [];
          const activeTutors =
            (data?.activeTutors && data.activeTutors.length
              ? data.activeTutors
              : (nested.active_tutors ?? nested.activeTutors)) ?? [];
          const xaiExplanation =
            data?.xaiExplanation && Object.keys(data.xaiExplanation).length > 0
              ? data.xaiExplanation
              : (nested.xai_explanation ?? nested.xaiExplanation ?? {});
          const chosen: BrainState = {
            masteryLevels,
            activeAccommodations,
            activeTutors,
            xaiExplanation,
            updatedAt: data?.updatedAt ?? nested.updated_at ?? nested.updatedAt,
            version: data?.version ?? nested.version,
          };
          setState(chosen);
          setExists(true);
        } else if (res.status === 404) {
          setExists(false);
        } else {
          setExists(false);
        }
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId, accessToken]);

  const regions: BrainRegionDatum[] = useMemo(() => {
    if (!state) return [];
    const mastery = state.masteryLevels ?? {};
    const accommodationDecisions = state.xaiExplanation?.accommodation_decisions ?? [];
    const tutorDecisions = state.xaiExplanation?.tutor_decisions ?? [];

    const accomByDomain: Record<string, string[]> = {};
    for (const a of accommodationDecisions) {
      const label = a.display_label || a.accommodation;
      const domains = a.affects_domains?.length ? a.affects_domains : [];
      for (const d of domains) {
        const key = d.toLowerCase();
        accomByDomain[key] = accomByDomain[key] ?? [];
        if (!accomByDomain[key].includes(label)) accomByDomain[key].push(label);
      }
    }
    const tutorByDomain: Record<string, string[]> = {};
    for (const t of tutorDecisions) {
      const domains = t.affects_domains?.length ? t.affects_domains : [];
      for (const d of domains) {
        const key = d.toLowerCase();
        tutorByDomain[key] = tutorByDomain[key] ?? [];
        if (!tutorByDomain[key].includes(t.tutor_key)) tutorByDomain[key].push(t.tutor_key);
      }
    }

    return Object.entries(mastery).map(([domain, score]) => ({
      id: domain,
      domain,
      label: labelFor(domain),
      // The brain API normally returns mastery on a 0..1 scale, but a
      // few legacy code paths still hand back 0..100 percentages. We
      // guard by treating any value > 1 as a percentage and dividing —
      // safe because a real mastery probability can never exceed 1.0.
      mastery: typeof score === "number" ? (score > 1 ? score / 100 : score) : 0,
      lastActivity: state.updatedAt ?? null,
      accommodations: accomByDomain[domain.toLowerCase()] ?? [],
      tutors: tutorByDomain[domain.toLowerCase()] ?? [],
    }));
  }, [state]);

  const metrics: BrainCloneMetrics | undefined = useMemo(() => {
    if (!summary && !state) return undefined;
    return {
      streakDays: summary?.streak?.currentStreak,
      totalXp: summary?.totalXp,
      badgeCount: summary?.badgeCount,
      masteryDeltaWeek: summary?.masteryDeltaWeek,
      nextMilestone: summary?.nextMilestone,
    };
  }, [summary, state]);

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-6 animate-pulse"
        style={{
          background: "var(--tier-surface, #FFFCF4)",
          borderColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 18%, transparent)",
          minHeight: variant === "card" ? 240 : 360,
        }}
        aria-busy="true"
        aria-label="Loading brain visualization"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--tier-primary, #7C3AED) 18%, transparent)",
            }}
          />
          <div
            className="flex-1 h-3 rounded"
            style={{
              background: "color-mix(in srgb, var(--tier-primary, #7C3AED) 12%, transparent)",
            }}
          />
        </div>
      </div>
    );
  }

  if (!exists || !state || regions.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5 text-center"
        style={{
          background: "var(--tier-surface, #FFFCF4)",
          borderColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 18%, transparent)",
          color: "var(--tier-text, #292F3D)",
        }}
      >
        <div
          className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--tier-primary, #7C3AED) 14%, transparent)",
            color: "var(--tier-primary, #7C3AED)",
          }}
        >
          <Brain className="w-6 h-6" aria-hidden="true" />
        </div>
        <p className="font-heading font-bold mb-1">Brain not built yet</p>
        <p className="text-xs mb-3" style={{ color: "var(--tier-text-soft, #5C5067)" }}>
          Once {learnerName} finishes the baseline adventure, their personalized Brain Clone will
          appear here.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/dashboard/parent/learner/${learnerId}/brain-review`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold focus:outline-none focus-visible:ring-2"
          style={{
            background: "color-mix(in srgb, var(--tier-primary, #7C3AED) 14%, transparent)",
            color: "var(--tier-primary, #7C3AED)",
            border: "1px solid color-mix(in srgb, var(--tier-primary, #7C3AED) 38%, transparent)",
          }}
        >
          <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
          Build the Brain
        </button>
      </div>
    );
  }

  return (
    <BrainCloneInteractive
      variant={variant}
      learnerName={learnerName}
      enrolledGrade={enrolledGrade}
      regions={regions}
      metrics={metrics}
      onOpenFull={
        variant === "card"
          ? () => router.push(`/dashboard/parent/learner/${learnerId}/brain`)
          : undefined
      }
    />
  );
}
