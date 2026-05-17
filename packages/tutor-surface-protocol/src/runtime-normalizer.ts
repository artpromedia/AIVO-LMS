/**
 * Tutor Surface Protocol — runtime normalizer.
 *
 * Sprint 04: when the tutor LLM emits a structured surface response
 * (`{ commands: [...] }`), this module coerces the raw model output
 * into a clean, schema-valid `TutorSurfaceCommand[]` so the web and
 * mobile runtimes can render it without per-call defensive branches.
 *
 * Behavior summary:
 *   • Accepts either `{ commands: [...] }` or a bare array.
 *   • Fills safe defaults for accessibility fields (keyboardAlternative
 *     defaults to true; altText defaults to the command reason).
 *   • Validates each command via {@link validateTutorSurfaceCommand}.
 *     Commands with hard errors (missing id, unsafe markup, unsupported
 *     command type) are *dropped* and their issues are recorded.
 *   • Commands with only soft warnings are kept.
 *   • Reports per-command issues and totals so the caller can log
 *     model-quality regressions.
 */
import type {
  SurfaceProtocolProfile,
  TutorSurfaceCommand,
  ValidationIssue,
} from "./types.js";
import { validateTutorSurfaceCommand } from "./validators.js";

export interface NormalizationOutcome {
  /** Commands that passed validation (or were repaired into validity). */
  commands: TutorSurfaceCommand[];
  /**
   * Issues encountered while normalizing. Includes issues for dropped
   * commands so callers can build a single observability event.
   */
  issues: Array<ValidationIssue & { commandId?: string; dropped?: boolean }>;
  /** Total raw entries received in the response. */
  totalReceived: number;
  /** Total entries dropped because they were unrecoverable. */
  totalDropped: number;
}

const HARD_ERROR_CODES = new Set([
  "invalid_command",
  "missing_command_id",
  "missing_surface_id",
  "missing_reason",
  "unsupported_command_type",
  "unsafe_markup",
  "speech_required_for_non_verbal",
  "long_text_for_low_verbal",
  "duplicate_command_id",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRawCommands(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw) && Array.isArray(raw.commands)) return raw.commands;
  return [];
}

function repairCommand(raw: unknown): TutorSurfaceCommand | undefined {
  if (!isRecord(raw)) return undefined;
  const id = typeof raw.id === "string" ? raw.id : undefined;
  const commandType = typeof raw.commandType === "string" ? raw.commandType : undefined;
  const surfaceId = typeof raw.surfaceId === "string" ? raw.surfaceId : undefined;
  const reason = typeof raw.reason === "string" ? raw.reason.trim() : "";
  if (!id || !commandType || !surfaceId || reason === "") return undefined;

  const surfaceRaw = isRecord(raw.surface) ? raw.surface : undefined;
  let surface = surfaceRaw as TutorSurfaceCommand["surface"];
  if (surfaceRaw) {
    const accessibilityRaw = isRecord(surfaceRaw.accessibility) ? surfaceRaw.accessibility : {};
    const altText =
      typeof accessibilityRaw.altText === "string" && accessibilityRaw.altText.trim() !== ""
        ? accessibilityRaw.altText
        : reason;
    const keyboardAlternative =
      accessibilityRaw.keyboardAlternative === false ? false : true;
    const reduceMotionSafe =
      accessibilityRaw.reduceMotionSafe === false ? false : true;
    surface = {
      ...(surfaceRaw as Record<string, unknown>),
      id: typeof surfaceRaw.id === "string" ? surfaceRaw.id : surfaceId,
      type: typeof surfaceRaw.type === "string" ? surfaceRaw.type : "choice_grid",
      prompt: typeof surfaceRaw.prompt === "string" ? surfaceRaw.prompt : reason,
      accessibility: {
        ...accessibilityRaw,
        altText,
        keyboardAlternative,
        reduceMotionSafe,
      },
    } as TutorSurfaceCommand["surface"];
  }

  return {
    id,
    commandType: commandType as TutorSurfaceCommand["commandType"],
    surfaceId,
    reason,
    expectedLearnerAction:
      typeof raw.expectedLearnerAction === "string" ? raw.expectedLearnerAction : undefined,
    profileAdaptationRationale:
      typeof raw.profileAdaptationRationale === "string"
        ? raw.profileAdaptationRationale
        : undefined,
    surface,
    commandPayload: isRecord(raw.commandPayload)
      ? (raw.commandPayload as Record<string, unknown>)
      : undefined,
  };
}

/**
 * Normalize a raw LLM tutor surface response into a validated command
 * list. Always returns a result (never throws); the caller decides
 * whether the issue stream warrants a hard failure or a model retry.
 */
export function normalizeTutorSurfaceResponse(
  raw: unknown,
  profile?: SurfaceProtocolProfile,
): NormalizationOutcome {
  const rawCommands = extractRawCommands(raw);
  const accepted: TutorSurfaceCommand[] = [];
  const issues: NormalizationOutcome["issues"] = [];
  const seenIds = new Set<string>();
  let dropped = 0;

  for (let i = 0; i < rawCommands.length; i++) {
    const entry = rawCommands[i];
    const repaired = repairCommand(entry);
    if (!repaired) {
      dropped++;
      issues.push({
        code: "invalid_command",
        message: `Command at index ${i} could not be repaired (missing required fields).`,
        path: `commands[${i}]`,
        dropped: true,
      });
      continue;
    }
    if (seenIds.has(repaired.id)) {
      dropped++;
      issues.push({
        code: "duplicate_command_id",
        message: `Duplicate command id: ${repaired.id}`,
        path: `commands[${i}].id`,
        commandId: repaired.id,
        dropped: true,
      });
      continue;
    }
    const result = validateTutorSurfaceCommand(repaired, profile);
    if (result.valid) {
      accepted.push(repaired);
      seenIds.add(repaired.id);
      continue;
    }
    const hasHardError = result.issues.some((iss) => HARD_ERROR_CODES.has(iss.code));
    if (hasHardError) {
      dropped++;
      for (const iss of result.issues) {
        issues.push({ ...iss, commandId: repaired.id, dropped: true });
      }
      continue;
    }
    accepted.push(repaired);
    seenIds.add(repaired.id);
    for (const iss of result.issues) {
      issues.push({ ...iss, commandId: repaired.id, dropped: false });
    }
  }

  return {
    commands: accepted,
    issues,
    totalReceived: rawCommands.length,
    totalDropped: dropped,
  };
}
