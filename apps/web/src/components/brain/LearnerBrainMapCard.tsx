"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, ClipboardList } from "lucide-react";
import LearnerBrainMap, { type SubjectProfile, type SubjectStatus } from "./LearnerBrainMap";
import { gradeToNumber } from "./BrainCloneInteractive.helpers";

interface LearnerBrainMapCardProps {
  learnerId: string;
  learnerName: string;
  enrolledGrade?: string | number | null;
  accessToken: string;
}

interface BrainState {
  masteryLevels: Record<string, number>;
  activeAccommodations: any[];
  activeTutors: any[];
  xaiExplanation: any;
  updatedAt?: string;
  version?: number;
}

const DOMAIN_LABEL: Record<string, string> = {
  ela: "Reading",
  english: "Reading",
  reading: "Reading",
  math: "Math",
  mathematics: "Math",
  science: "Science",
  stem: "Science",
  overall: "Overall",
  social_emotional: "Social-Emotional",
  socialemotional: "Social-Emotional",
  social: "Social-Emotional",
  communication: "Communication",
  language: "Communication",
  speech: "Communication",
  executive_function: "Executive Function",
  exec: "Executive Function",
  ef: "Executive Function",
};

function labelFor(domain: string): string {
  const key = domain.toLowerCase().trim();
  return DOMAIN_LABEL[key] ?? domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const POSITIONS: Record<string, { x: string; y: string }> = {
  Overall: { x: "19%", y: "33%" },
  Reading: { x: "27%", y: "67%" },
  Math: { x: "73%", y: "42%" },
  Science: { x: "62%", y: "27%" },
  Communication: { x: "62%", y: "65%" },
  "Social-Emotional": { x: "36%", y: "82%" },
  "Executive Function": { x: "82%", y: "70%" },
};

const FALLBACK_POSITIONS = [
  { x: "30%", y: "30%" },
  { x: "70%", y: "30%" },
  { x: "30%", y: "70%" },
  { x: "70%", y: "70%" },
  { x: "50%", y: "20%" },
  { x: "50%", y: "80%" },
];

function statusFromGap(gap: number, hasData: boolean, isOverall: boolean): SubjectStatus {
  if (!hasData) return "noData";
  if (isOverall) return "profile";
  if (gap <= -0.25) return "ahead";
  if (gap <= 1.5) return "onTrack";
  return "needsSupport";
}

function confidenceFor(mastery: number, hasData: boolean): SubjectProfile["confidence"] {
  if (!hasData) return "Not enough data";
  if (mastery >= 0.8) return "High";
  if (mastery >= 0.6) return "Medium";
  return "Low";
}

function formatRelative(iso?: string | null): string {
  if (!iso) return "Updated recently";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Updated recently";
  const diffMs = Date.now() - d.getTime();
  const day = 1000 * 60 * 60 * 24;
  if (diffMs < day) return "Updated today";
  if (diffMs < day * 2) return "Updated yesterday";
  const days = Math.floor(diffMs / day);
  if (days < 14) return `Updated ${days} days ago`;
  return `Updated ${d.toLocaleDateString()}`;
}

function descriptionFor(label: string): string {
  switch (label) {
    case "Reading":
      return "Reading reflects vocabulary, comprehension, fluency, inference, and stamina during literacy activities.";
    case "Math":
      return "Math reflects number sense, operations, problem solving, reasoning, and grade-level procedural fluency.";
    case "Science":
      return "Science reflects concept mastery, observation, cause-and-effect reasoning, and applied scientific vocabulary.";
    case "Communication":
      return "Communication reflects expressive language, receptive understanding, discussion participation, and clarity of response.";
    case "Social-Emotional":
      return "Social-emotional data reflects focus, confidence, frustration tolerance, task persistence, and learning regulation.";
    case "Executive Function":
      return "Executive function reflects planning, working memory, attention regulation, and self-monitoring during tasks.";
    case "Overall":
    default:
      return "The overall learner profile combines performance across assessments, lessons, practice, and learning behavior.";
  }
}

function buildInsights(label: string, status: SubjectStatus, xai: any) {
  const decisions: any[] = xai?.accommodation_decisions ?? [];
  const tutors: any[] = xai?.tutor_decisions ?? [];

  const domainKey = label.toLowerCase();
  const matches = decisions.filter((d) =>
    (d.affects_domains ?? []).some((dom: string) => dom.toLowerCase().includes(domainKey)),
  );
  const tutorMatches = tutors.filter((t) =>
    (t.affects_domains ?? []).some((dom: string) => dom.toLowerCase().includes(domainKey)),
  );

  const supportNeeds = matches
    .map((d) => d.display_label || d.accommodation)
    .filter(Boolean)
    .slice(0, 4);

  const strengths: string[] = [];
  if (status === "ahead") strengths.push("Performing above expected grade level");
  if (status === "onTrack") strengths.push("Aligned with expected grade level");
  if (tutorMatches.length > 0) strengths.push(`${tutorMatches.length} adaptive tutor${tutorMatches.length > 1 ? "s" : ""} active`);

  let recommendation = `Continue grade-level practice in ${label.toLowerCase()}.`;
  if (status === "ahead") {
    recommendation = `Move into enrichment practice with applied ${label.toLowerCase()} challenges.`;
  } else if (status === "needsSupport") {
    recommendation = `Schedule a 15-minute adaptive ${label.toLowerCase()} session focused on the lowest-confidence skills.`;
  } else if (status === "noData") {
    recommendation = `Collect more ${label.toLowerCase()} data through guided activities or short check-ins.`;
  }

  return { strengths, supportNeeds, recommendation };
}

export default function LearnerBrainMapCard({
  learnerId,
  learnerName,
  enrolledGrade,
  accessToken,
}: Readonly<LearnerBrainMapCardProps>) {
  const router = useRouter();
  const [state, setState] = useState<BrainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState<boolean | null>(null);

  const expectedGrade = useMemo(() => gradeToNumber(enrolledGrade), [enrolledGrade]);

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
          setState({
            masteryLevels,
            activeAccommodations,
            activeTutors,
            xaiExplanation,
            updatedAt: data?.updatedAt ?? nested.updated_at ?? nested.updatedAt,
            version: data?.version ?? nested.version,
          });
          setExists(true);
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

  const subjects = useMemo<SubjectProfile[]>(() => {
    if (!state) return [];
    const mastery = state.masteryLevels ?? {};
    const lastUpdated = formatRelative(state.updatedAt);

    // Group by canonical label so duplicate domain keys (e.g. "ela" + "reading") collapse.
    const byLabel = new Map<string, { mastery: number; raw: string }>();
    for (const [domain, score] of Object.entries(mastery)) {
      const numeric = typeof score === "number" ? (score > 1 ? score / 100 : score) : 0;
      const label = labelFor(domain);
      const existing = byLabel.get(label);
      if (!existing || numeric > existing.mastery) {
        byLabel.set(label, { mastery: numeric, raw: domain });
      }
    }

    // Always show these slots, even if empty (status: noData).
    const slots = ["Overall", "Reading", "Math", "Science", "Communication", "Social-Emotional"];
    for (const slot of slots) {
      if (!byLabel.has(slot)) {
        byLabel.set(slot, { mastery: 0, raw: slot.toLowerCase() });
      }
    }

    let fallbackIdx = 0;
    const profiles: SubjectProfile[] = [];
    // Render slots first in canonical order, then any extra labels.
    const ordered: string[] = [
      ...slots.filter((s) => byLabel.has(s)),
      ...Array.from(byLabel.keys()).filter((k) => !slots.includes(k)),
    ];

    for (const label of ordered) {
      const entry = byLabel.get(label);
      if (!entry) continue;
      const hasData = entry.mastery > 0;
      const equivalent = entry.mastery * Math.max(expectedGrade, 1);
      const gap = expectedGrade - equivalent;
      const isOverall = label === "Overall";
      const status = statusFromGap(gap, hasData, isOverall);
      const insights = buildInsights(label, status, state.xaiExplanation);
      const position =
        POSITIONS[label] ?? FALLBACK_POSITIONS[fallbackIdx++ % FALLBACK_POSITIONS.length];

      profiles.push({
        id: entry.raw,
        name: label,
        gradeLevel: hasData ? Number(equivalent.toFixed(1)) : null,
        expectedGrade,
        status,
        confidence: confidenceFor(entry.mastery, hasData),
        position,
        description: descriptionFor(label),
        strengths: insights.strengths,
        supportNeeds: insights.supportNeeds,
        recommendation: insights.recommendation,
        lastUpdated: hasData ? lastUpdated : "Not enough data yet",
      });
    }

    return profiles;
  }, [state, expectedGrade]);

  if (loading) {
    return (
      <div
        className="rounded-2xl border p-6 animate-pulse"
        style={{
          background: "var(--tier-surface, #FFFCF4)",
          borderColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 18%, transparent)",
          minHeight: 360,
        }}
        aria-busy="true"
        aria-label="Loading brain visualization"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full"
            style={{ background: "color-mix(in srgb, var(--tier-primary, #7C3AED) 18%, transparent)" }}
          />
          <div className="flex-1 h-3 rounded" style={{ background: "color-mix(in srgb, var(--tier-primary, #7C3AED) 12%, transparent)" }} />
        </div>
      </div>
    );
  }

  if (!exists || !state || subjects.every((s) => s.gradeLevel === null)) {
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
          Once {learnerName} finishes the baseline adventure, their personalized Brain Clone will appear here.
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
    <LearnerBrainMap
      learnerName={learnerName}
      expectedGrade={expectedGrade}
      subjects={subjects}
    />
  );
}
