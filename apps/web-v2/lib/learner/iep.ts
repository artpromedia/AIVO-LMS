/**
 * Sprint 6: deterministic IEP extraction.
 *
 * In production this would invoke an LLM with a parser prompt over the
 * uploaded document. For the v2 mock store we don't actually persist file
 * contents — but we still need to produce a structured `IEPExtraction` so the
 * downstream brain-profile generation (Sprint 7) and baseline (Sprint 8) have
 * something real to consume. We synthesize fields from the parent assessment
 * + learner profile, mark the source as `"fallback_from_assessment"`, and
 * always emit the three role-specific summaries (learner-safe, parent,
 * teacher) so the safety boundary between learner UI and the rest is
 * enforced by the data shape itself.
 *
 * The function is also called by `/iep-upload/extract` after a real upload —
 * same logic, same shape. When an LLM adapter is wired in (Sprint 22+) it
 * should write back into this signature without changing callers.
 */
import type {
  IEPExtraction,
  LearnerProfile,
  ParentAssessment,
} from "@/lib/db/types";
import { nowIso } from "@/lib/db/store";

type ExtractInput = {
  learner: LearnerProfile;
  assessment: ParentAssessment | null;
  /** When true, mark output as derived from a real upload rather than skip. */
  hasUploadedDocument: boolean;
};

function pickAnswer<T = unknown>(
  assessment: ParentAssessment | null,
  section: keyof ParentAssessment["answers"],
  field: string,
): T | undefined {
  if (!assessment) return undefined;
  const sec = assessment.answers[section] as Record<string, unknown> | undefined;
  return sec?.[field] as T | undefined;
}

export function buildIEPExtraction(input: ExtractInput): IEPExtraction {
  const { learner, assessment, hasUploadedDocument } = input;

  const knownAccommodations =
    pickAnswer<string[]>(assessment, "accommodations", "known") ?? [];
  const extendedTime = Boolean(
    pickAnswer<boolean>(assessment, "accommodations", "extendedTime"),
  );
  const readAloud = Boolean(
    pickAnswer<boolean>(assessment, "accommodations", "readAloud"),
  );
  const speechToText = Boolean(
    pickAnswer<boolean>(assessment, "accommodations", "speechToText"),
  );
  const movementHelps = Boolean(
    pickAnswer<boolean>(assessment, "attention", "movementHelps"),
  );
  const sensitivities =
    pickAnswer<string[]>(assessment, "sensory", "sensitivities") ?? [];
  const communicationStyle =
    pickAnswer<string>(assessment, "communication", "style") ?? "mixed";
  const aacUsed = Boolean(
    pickAnswer<boolean>(assessment, "communication", "aacUsed"),
  );
  const triggers =
    pickAnswer<string[]>(assessment, "frustration", "triggers") ?? [];

  const accommodations = Array.from(
    new Set<string>([
      ...knownAccommodations,
      ...(extendedTime ? ["Extended time on assignments and assessments"] : []),
      ...(readAloud ? ["Read-aloud support for text-heavy material"] : []),
      ...(speechToText ? ["Speech-to-text for written responses"] : []),
      ...(movementHelps ? ["Movement and stretch breaks during focus blocks"] : []),
      ...(sensitivities.length
        ? [`Sensory-aware environment (mitigates: ${sensitivities.join(", ")})`]
        : []),
      ...(aacUsed ? ["AAC-compatible interaction modes"] : []),
    ]),
  ).slice(0, 20);

  const learningGoals = (
    pickAnswer<string[]>(assessment, "goals", "goals") ?? []
  ).slice(0, 10);

  const serviceAreas = Array.from(
    new Set<string>([
      ...(learner.readingComfort && learner.readingComfort !== "advanced"
        ? ["Reading support"]
        : []),
      ...(learner.mathComfort && learner.mathComfort !== "advanced"
        ? ["Math support"]
        : []),
      ...(triggers.length ? ["Behavioral / regulation support"] : []),
      ...(communicationStyle !== "spoken" && communicationStyle !== "mixed"
        ? ["Communication support"]
        : []),
    ]),
  );

  const assistiveTechnologyNeeds = Array.from(
    new Set<string>([
      ...(readAloud ? ["Text-to-speech reader"] : []),
      ...(speechToText ? ["Speech-to-text dictation"] : []),
      ...(aacUsed ? ["AAC device / app compatibility"] : []),
      ...(learner.accessibilityDefaults.largeText
        ? ["Adjustable text size and spacing"]
        : []),
      ...(learner.accessibilityDefaults.highContrast
        ? ["High-contrast visual themes"] : []),
    ]),
  );

  const name = learner.preferredName?.trim() || learner.firstName.trim() || "your learner";
  const accommodationsLine =
    accommodations.length === 0
      ? "no specific accommodations recorded yet"
      : accommodations.slice(0, 3).join("; ");

  const learnerSafeSummary = `${name}, here are the things AIVO will do to make learning feel good for you: take breaks when you need them, give you time to think, and use the tools that work best for you.`;

  const parentSummary = `Based on ${hasUploadedDocument ? "the IEP you uploaded" : "your parent assessment"}, AIVO will apply these supports for ${name}: ${accommodationsLine}${
    accommodations.length > 3 ? `, and ${accommodations.length - 3} more.` : "."
  } Lessons will respect ${name}'s preferred pace, communication style, and sensory profile.`;

  const teacherSummary = `Learner profile: age range ${learner.ageRange ?? "n/a"}, grade band ${learner.gradeBand ?? "n/a"}. Supports in effect: ${
    accommodations.length === 0 ? "none on file" : accommodations.join("; ")
  }. Service areas: ${serviceAreas.length === 0 ? "none flagged" : serviceAreas.join(", ")}. Assistive tech: ${
    assistiveTechnologyNeeds.length === 0 ? "none" : assistiveTechnologyNeeds.join(", ")
  }.`;

  return {
    accommodations,
    serviceAreas,
    learningGoals,
    assistiveTechnologyNeeds,
    extendedTime,
    readingSupport: Boolean(
      readAloud || (learner.readingComfort && learner.readingComfort !== "advanced"),
    ),
    writingSupport: Boolean(speechToText),
    behavioralSupport: triggers.length > 0,
    sensorySupport: sensitivities.length > 0,
    communicationSupport: aacUsed || communicationStyle === "visual",
    learnerSafeSummary,
    parentSummary,
    teacherSummary,
    generatedAt: nowIso(),
    source: hasUploadedDocument ? "fallback_from_assessment" : "fallback_from_assessment",
  };
}
