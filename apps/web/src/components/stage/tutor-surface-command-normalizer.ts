/**
 * Normalizes raw tutor surface commands into a form the SurfaceHost can
 * render. Invalid commands are filtered out (and reported via the
 * `rejected` array) so a malformed LLM response never crashes the stage.
 *
 * The normalizer is intentionally framework-free. The renderer component
 * wraps it and emits telemetry; tests exercise the normalizer directly.
 */

import {
  validateTutorSurfaceCommand,
  type SurfaceProtocolProfile,
  type TutorSurfaceCommand,
  type ValidationIssue,
} from "@aivo/tutor-surface-protocol";

export interface NormalizedTutorCommand {
  command: TutorSurfaceCommand;
  surfaceId: string;
  renderable: boolean;
}

export interface NormalizeResult {
  normalized: NormalizedTutorCommand[];
  rejected: Array<{
    commandId?: string;
    surfaceId?: string;
    issues: ValidationIssue[];
  }>;
}

const RENDERABLE_COMMAND_TYPES = new Set([
  "open_scratchpad",
  "show_geometry",
  "show_graph",
  "show_number_line",
  "show_manipulative",
  "show_reading_annotation",
  "show_science_diagram",
]);

export function normalizeTutorSurfaceCommands(
  commands: unknown,
  profile?: SurfaceProtocolProfile,
): NormalizeResult {
  const result: NormalizeResult = { normalized: [], rejected: [] };
  if (!Array.isArray(commands)) {
    return result;
  }
  for (const raw of commands) {
    if (!raw || typeof raw !== "object") {
      result.rejected.push({
        issues: [{ code: "invalid_command", message: "Command must be an object." }],
      });
      continue;
    }
    const candidate = raw as TutorSurfaceCommand;
    const { valid, issues } = validateTutorSurfaceCommand(candidate, profile);
    if (!valid) {
      result.rejected.push({
        commandId: candidate.id,
        surfaceId: candidate.surfaceId,
        issues,
      });
      continue;
    }
    result.normalized.push({
      command: candidate,
      surfaceId: candidate.surfaceId,
      renderable: RENDERABLE_COMMAND_TYPES.has(candidate.commandType),
    });
  }
  return result;
}
