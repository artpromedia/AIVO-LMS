/**
 * StagePlan validator. Generated lessons that fail validation must
 * never be served to learners — quality gate failures return a 422
 * from the lesson session route so the client can re-request or
 * surface a recoverable error.
 *
 * This module is pure (no IO) so it can be exercised in unit tests
 * without booting Fastify.
 */

export type StagePlanQualityIssue = {
  code: string;
  detail: string;
};

export interface StagePlanValidationResult {
  valid: boolean;
  issues: StagePlanQualityIssue[];
}

const HTML_TAG_RE = /<\s*[a-z!][^>]*>/i;
const SCRIPT_TAG_RE = /<\s*script\b/i;

const SUPPORTED_LEGACY_INTERACTIONS = new Set([
  "multiple_choice",
  "drag_drop",
  "voice",
  "tap",
  "match",
  "draw",
  "scratchpad",
  "geometry_workspace",
  "math_expression",
]);

function checkText(text: unknown, where: string, issues: StagePlanQualityIssue[]) {
  if (typeof text !== "string") return;
  if (SCRIPT_TAG_RE.test(text)) issues.push({ code: "script_tag", detail: where });
  if (HTML_TAG_RE.test(text)) issues.push({ code: "raw_html", detail: where });
}

export interface ValidateStagePlanOptions {
  functioningLevel?: string;
  /**
   * When true (Sprint 05), the validator requires the generated plan to
   * record `subjectBrainEvidenceUsed`. Pass true only when the
   * subject-brain context was actually fetched (i.e. the
   * `advancedContentGenerators` flag is on and the service returned).
   */
  requireSubjectBrainEvidence?: boolean;
  /**
   * Optional list of surface types the subject brain said are required for
   * this subject + topic. When provided, the validator fails if no beat /
   * surface in the plan satisfies the requirement.
   */
  requiredSurfaces?: string[];
  /**
   * The subject the lesson was generated for. Used to apply subject-aware
   * surface requirements when explicit requiredSurfaces are not provided.
   */
  subject?: string;
  /**
   * The topic the lesson was generated for. Used together with `subject`
   * to detect e.g. "area of a rectangle" → geometry_workspace required.
   */
  topic?: string;
}

function collectSurfaceTypes(plan: any): Set<string> {
  const types = new Set<string>();
  const surfaces = plan?.surfaces;
  if (surfaces && typeof surfaces === "object") {
    for (const value of Object.values(surfaces)) {
      const t = (value as { type?: string } | undefined)?.type;
      if (typeof t === "string") types.add(t);
    }
  }
  for (const beat of plan?.beats || []) {
    const t = beat?.surface?.type;
    if (typeof t === "string") types.add(t);
    const it = beat?.interaction?.type;
    if (typeof it === "string") types.add(it);
  }
  return types;
}

function detectSubjectSurfaceRequirements(
  subject: string | undefined,
  topic: string | undefined,
): string[] {
  const required: string[] = [];
  if (!subject) return required;
  const subj = subject.toLowerCase();
  const t = (topic ?? "").toLowerCase();
  if (subj === "math") {
    if (/geometry|area|perimeter|rectangle|triangle|angle|polygon|circle/.test(t)) {
      required.push("geometry_workspace");
    }
    if (/computation|arithmetic|add|subtract|multiply|divide|long division/.test(t)) {
      required.push("scratchpad");
    }
  }
  if (subj === "science") {
    if (/classif|sort|group/.test(t)) required.push("drag_manipulative");
    if (/cycle|sequence|order/.test(t)) required.push("science_diagram");
    if (/observ|inference/.test(t)) required.push("reading_annotation");
  }
  if (subj === "ela") {
    if (/read|comprehension/.test(t)) required.push("reading_annotation");
  }
  return required;
}

export function validateStagePlan(
  plan: any,
  opts?: ValidateStagePlanOptions,
): StagePlanValidationResult {
  const issues: StagePlanQualityIssue[] = [];

  if (!plan || typeof plan !== "object") {
    return { valid: false, issues: [{ code: "not_object", detail: "stageplan" }] };
  }

  if (!plan.title || typeof plan.title !== "string")
    issues.push({ code: "missing_title", detail: "title" });
  if (!plan.objective || typeof plan.objective !== "string")
    issues.push({ code: "missing_objective", detail: "objective" });
  if (!Array.isArray(plan.beats) || plan.beats.length === 0) {
    issues.push({ code: "missing_beats", detail: "beats" });
  }

  checkText(plan.title, "title", issues);
  checkText(plan.objective, "objective", issues);

  const seenBeatIds = new Set<string>();
  const seenSurfaceIds = new Set<string>();

  const surfaces: Record<string, any> =
    plan.surfaces && typeof plan.surfaces === "object" ? plan.surfaces : {};
  for (const [id, surface] of Object.entries(surfaces)) {
    if (seenSurfaceIds.has(id)) issues.push({ code: "duplicate_surface_id", detail: id });
    seenSurfaceIds.add(id);
    if (!surface || typeof surface !== "object") {
      issues.push({ code: "invalid_surface", detail: id });
      continue;
    }
    if (!(surface as any).accessibility?.altText) {
      issues.push({ code: "surface_missing_alt_text", detail: id });
    }
    if ((surface as any).type === "geometry_workspace") {
      const shapes = (surface as any).diagram?.shapes;
      if (!Array.isArray(shapes) || shapes.length === 0) {
        issues.push({ code: "geometry_missing_shapes", detail: id });
      }
    }
    if ((surface as any).scratchpad?.enabled && (surface as any).capture?.inkStrokes !== true) {
      issues.push({ code: "scratchpad_missing_ink_capture", detail: id });
    }
  }

  for (const beat of plan.beats || []) {
    if (!beat || typeof beat !== "object") {
      issues.push({ code: "invalid_beat", detail: "non_object_beat" });
      continue;
    }
    if (!beat.id) issues.push({ code: "beat_missing_id", detail: "beat_missing_id" });
    if (beat.id) {
      if (seenBeatIds.has(beat.id)) issues.push({ code: "duplicate_beat_id", detail: beat.id });
      seenBeatIds.add(beat.id);
    }
    checkText(beat.narration, `beat:${beat.id}:narration`, issues);

    if (beat.surfaceId && !surfaces[beat.surfaceId]) {
      issues.push({ code: "unresolved_surface_id", detail: `${beat.id} -> ${beat.surfaceId}` });
    }

    if (beat.type === "interaction") {
      const hasSurface = beat.surface || (beat.surfaceId && surfaces[beat.surfaceId]);
      const legacyType = beat.interaction?.type;
      if (!hasSurface && (!legacyType || !SUPPORTED_LEGACY_INTERACTIONS.has(legacyType))) {
        issues.push({ code: "interaction_without_surface_or_legacy_type", detail: beat.id ?? "" });
      }
    }
  }

  // Functioning-level guards.
  const fl = opts?.functioningLevel;
  if (fl === "LOW_VERBAL" || fl === "NON_VERBAL" || fl === "PRE_SYMBOLIC") {
    for (const beat of plan.beats || []) {
      if (typeof beat?.narration === "string" && beat.narration.length > 240) {
        issues.push({ code: "narration_too_long_for_low_verbal", detail: beat.id ?? "" });
      }
    }
  }

  // Sprint 05: when subject-brain context was fetched, the generated plan
  // MUST record `subjectBrainEvidenceUsed`. Sprint C harden: the field is
  // no longer satisfied by an empty object — the generator must echo at
  // least one `relevantSkills` entry back so a plan that ignored the
  // brain's grounding cannot pass validation.
  if (opts?.requireSubjectBrainEvidence) {
    const evidence = (plan as { subjectBrainEvidenceUsed?: unknown }).subjectBrainEvidenceUsed;
    if (!evidence || typeof evidence !== "object") {
      issues.push({
        code: "missing_subject_brain_evidence",
        detail: "subjectBrainEvidenceUsed must be set when subject-brain context is available",
      });
    } else {
      const ev = evidence as {
        relevantSkills?: unknown;
        standards?: unknown;
      };
      const skills = Array.isArray(ev.relevantSkills) ? ev.relevantSkills : [];
      const standards = Array.isArray(ev.standards) ? ev.standards : [];
      if (skills.length === 0 && standards.length === 0) {
        issues.push({
          code: "empty_subject_brain_evidence",
          detail:
            "subjectBrainEvidenceUsed.relevantSkills or .standards must be non-empty",
        });
      }
    }
  }

  // Sprint 05: surface-type requirements. Either the explicit list passed
  // in opts.requiredSurfaces or a subject-derived set.
  const requiredSurfaces = new Set<string>([
    ...(opts?.requiredSurfaces ?? []),
    ...detectSubjectSurfaceRequirements(opts?.subject, opts?.topic),
  ]);
  if (requiredSurfaces.size > 0) {
    const present = collectSurfaceTypes(plan);
    for (const required of requiredSurfaces) {
      if (!present.has(required)) {
        issues.push({
          code: `missing_required_surface_${required}`,
          detail: `plan does not contain a ${required} surface`,
        });
      }
    }
  }

  // Sprint 05: profile-adaptation evidence. When the learner is on a
  // functioning level that requires adaptation, the plan must record at
  // least one applied accommodation in `accommodationsApplied` OR a
  // profile note inside `subjectBrainEvidenceUsed.profileAdaptations`.
  if (fl === "LOW_VERBAL" || fl === "NON_VERBAL" || fl === "PRE_SYMBOLIC" || fl === "DEVELOPING") {
    const applied = Array.isArray(plan.accommodationsApplied) ? plan.accommodationsApplied : [];
    const evidence = (plan as { subjectBrainEvidenceUsed?: { profileAdaptations?: unknown } })
      .subjectBrainEvidenceUsed;
    const adaptations = Array.isArray(evidence?.profileAdaptations)
      ? (evidence!.profileAdaptations as unknown[])
      : [];
    if (applied.length === 0 && adaptations.length === 0) {
      issues.push({
        code: "missing_profile_adaptations",
        detail: `functioning level ${fl} requires adaptations but none recorded`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
