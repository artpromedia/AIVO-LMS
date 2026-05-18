/**
 * useBrain
 * --------
 * React Query hooks for the brain-svc API. The previous version of this
 * file modelled an aspirational `BrainProfile` shape that the backend
 * never returned (`learnerName`, `overallLevel`, `domains[]` with
 * `enrolledGrade`/`functioningGrade`/`masteryPercent`). The real API
 * returns the canonical `brain_states` row, camelCased, plus the
 * `xaiExplanation` payload.
 *
 * Endpoints:
 *  - GET  brain-svc   /api/brain/{learnerId}                   → BrainState
 *  - GET  family-svc  /api/family/recommendations/{learnerId}  → BrainRecommendation[]
 *  - POST family-svc  /api/family/recommendations/{learnerId}/{recId}/respond
 *         body: { action: 'APPROVED' | 'DECLINED' | 'ADJUSTED', notes?: string }
 *
 * Note: recommendations are read/written through family-svc (which enforces
 * parent ownership) rather than brain-svc directly, matching the web
 * parent dashboard. Both services talk to the same `brainRecommendations`
 * table.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { API } from "@/constants/api";

export interface AccommodationDecision {
  accommodation: string;
  display_label?: string;
  affects_domains?: string[];
  reasoning?: string;
}

export interface TutorDecision {
  tutor_key: string;
  reasoning?: string;
  affects_domains?: string[];
}

export interface MasteryDecision {
  domain: string;
  score: number;
  display_label?: string;
}

export interface XaiExplanation {
  mastery_decisions?: MasteryDecision[];
  accommodation_decisions?: AccommodationDecision[];
  tutor_decisions?: TutorDecision[];
}

export interface BrainState {
  id?: string;
  learnerId?: string;
  tenantId?: string;
  version?: number;
  approvalStatus?: "pending" | "approved" | "declined" | string;
  masteryLevels?: Record<string, number>;
  activeAccommodations?: string[];
  activeTutors?: string[];
  xaiExplanation?: XaiExplanation;
  updatedAt?: string;
  createdAt?: string;
  /** Legacy nested jsonb column. Prefer top-level fields when both
   *  are populated. */
  state?: BrainState;
}

export interface BrainRecommendation {
  id: string;
  learnerId: string;
  tenantId: string;
  type: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "ADJUSTED" | string;
  title: string;
  description?: string | null;
  payload?: Record<string, unknown> | null;
  amendedPayload?: Record<string, unknown> | null;
  appliedPayload?: Record<string, unknown> | null;
  evidence?: Record<string, unknown> | null;
  sourceSignals?: unknown[] | null;
  confidence?: number | null;
  applyError?: string | null;
  parentNotes?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

/** Legacy per-domain shape used by older screens. Synthesised from
 *  `BrainState` by `deriveDomains`. */
export interface BrainDomain {
  domain: string;
  enrolledGrade: string;
  functioningGrade: string;
  masteryPercent: number;
  accommodations: string[];
  tutors: string[];
}

export function useBrain(learnerId: string) {
  return useQuery<BrainState>({
    queryKey: ["brain", learnerId],
    queryFn: async () => {
      const res = await apiFetch(API.BRAIN, `/api/brain/${learnerId}`);
      if (!res.ok) throw new Error("Failed to fetch brain state");
      const data: BrainState = await res.json();
      const nested = data?.state;
      const hasTopLevel = Boolean(data && (data.masteryLevels || data.version || data.updatedAt));
      const hasNested = Boolean(
        nested && (nested.masteryLevels || nested.version || nested.updatedAt),
      );
      if (hasTopLevel) return data;
      if (hasNested && nested) return nested;
      return data ?? {};
    },
    enabled: !!learnerId,
    staleTime: 5 * 60 * 1000,
  });
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

export function labelForDomain(domain: string): string {
  const key = domain.toLowerCase().replace(/[\s-]+/g, "_");
  return DOMAIN_LABELS[key] || domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Reshape a `BrainState` plus the learner's enrolled grade into the
 *  legacy per-domain list shape consumers used to expect. Mastery is
 *  normalised to 0..1 then converted to a percent. The functioning
 *  grade is approximated as `mastery * enrolledGrade`. */
export function deriveDomains(
  brain: BrainState | null | undefined,
  enrolledGrade?: string | number | null,
): BrainDomain[] {
  if (!brain?.masteryLevels) return [];
  const enrolledNum = parseGrade(enrolledGrade);
  const enrolledStr = String(enrolledGrade ?? "");

  const accomByDomain: Record<string, string[]> = {};
  for (const a of brain.xaiExplanation?.accommodation_decisions ?? []) {
    const label = a.display_label || a.accommodation;
    for (const d of a.affects_domains ?? []) {
      const k = d.toLowerCase();
      accomByDomain[k] = accomByDomain[k] ?? [];
      if (!accomByDomain[k].includes(label)) accomByDomain[k].push(label);
    }
  }
  const tutorByDomain: Record<string, string[]> = {};
  for (const t of brain.xaiExplanation?.tutor_decisions ?? []) {
    for (const d of t.affects_domains ?? []) {
      const k = d.toLowerCase();
      tutorByDomain[k] = tutorByDomain[k] ?? [];
      if (!tutorByDomain[k].includes(t.tutor_key)) {
        tutorByDomain[k].push(t.tutor_key);
      }
    }
  }

  return Object.entries(brain.masteryLevels).map(([domain, raw]) => {
    const norm = typeof raw === "number" ? (raw > 1 ? raw / 100 : raw) : 0;
    const masteryPercent = Math.round(Math.max(0, Math.min(1, norm)) * 100);
    const functioningNum = enrolledNum ? Math.max(0.5, +(norm * enrolledNum).toFixed(1)) : null;
    return {
      domain: labelForDomain(domain),
      enrolledGrade: enrolledStr || "—",
      functioningGrade: functioningNum != null ? String(functioningNum) : "—",
      masteryPercent,
      accommodations: accomByDomain[domain.toLowerCase()] ?? [],
      tutors: tutorByDomain[domain.toLowerCase()] ?? [],
    };
  });
}

function parseGrade(grade: string | number | null | undefined): number | null {
  if (grade == null || grade === "") return null;
  if (typeof grade === "number") return grade;
  const s = grade.toLowerCase().trim();
  if (s === "k" || s === "kindergarten" || s === "kg") return 0;
  if (s === "pre-k" || s === "prek" || s === "pk") return -1;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Derived hook: returns `BrainDomain[]` for legacy screens. */
export function useBrainDomains(
  learnerId: string,
  opts: { enrolledGrade?: string | number | null } = {},
) {
  const query = useBrain(learnerId);
  const domains = useMemo(
    () => deriveDomains(query.data, opts.enrolledGrade),
    [query.data, opts.enrolledGrade],
  );
  return { ...query, domains };
}

export function useBrainRecommendations(learnerId: string) {
  return useQuery<BrainRecommendation[]>({
    queryKey: ["brain", learnerId, "recommendations"],
    queryFn: async () => {
      const res = await apiFetch(API.FAMILY, `/api/family/recommendations/${learnerId}`);
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
    enabled: !!learnerId,
  });
}

export type RecommendationAction = "approve" | "decline" | "adjust";

export interface RecommendationAmendedPayload {
  accommodation?: string;
  tutor?: string;
  level?: string;
  subject?: string;
  curriculumId?: string;
  proposedValue?: unknown;
  [k: string]: unknown;
}

export function useRecommendationAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      learnerId,
      recommendationId,
      action,
      parentNotes,
      amendedPayload,
    }: {
      learnerId: string;
      recommendationId: string;
      action: RecommendationAction;
      parentNotes?: string;
      amendedPayload?: RecommendationAmendedPayload;
    }) => {
      const apiAction =
        action === "approve" ? "APPROVED" : action === "adjust" ? "ADJUSTED" : "DECLINED";
      const body: Record<string, unknown> = {
        action: apiAction,
        notes: parentNotes,
      };
      if (action === "adjust" && amendedPayload) {
        body.amendedPayload = amendedPayload;
      }
      const res = await apiFetch(
        API.FAMILY,
        `/api/family/recommendations/${learnerId}/${recommendationId}/respond`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Action failed");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["brain", variables.learnerId, "recommendations"],
      });
    },
  });
}
