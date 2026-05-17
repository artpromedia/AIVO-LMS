/**
 * Tutor Surface Protocol — runtime response validator.
 *
 * Sprint 04: a response-level guard that runs after
 * {@link normalizeTutorSurfaceResponse}. While the normalizer is
 * permissive (it repairs and keeps usable commands), this validator is
 * strict: it confirms the *whole response* is fit to render and surfaces
 * a single boolean `valid` so callers can fail closed before they ship
 * the beats to a learner.
 *
 * The validator enforces:
 *   • at least one command,
 *   • all command-level invariants via {@link validateTutorSurfaceCommand},
 *   • surface ids referenced from `surfaceId` resolve to a real surface
 *     attached to *some* command in the same response.
 */
import type {
  SurfaceProtocolProfile,
  TutorSurfaceCommand,
  ValidationIssue,
  ValidationResult,
} from "./types.js";
import { validateTutorSurfaceCommands } from "./validators.js";

export interface TutorSurfaceResponse {
  commands: TutorSurfaceCommand[];
  rationale?: string;
}

export function validateTutorSurfaceResponse(
  response: TutorSurfaceResponse,
  profile?: SurfaceProtocolProfile,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!response || !Array.isArray(response.commands)) {
    issues.push({
      code: "missing_commands",
      message: "Tutor surface response must include a `commands` array.",
      path: "commands",
    });
    return { valid: false, issues };
  }
  if (response.commands.length === 0) {
    issues.push({
      code: "empty_response",
      message: "Tutor surface response must include at least one command.",
      path: "commands",
    });
    return { valid: false, issues };
  }

  const cmdResult = validateTutorSurfaceCommands(response.commands, profile);
  issues.push(...cmdResult.issues);

  // Cross-command: every `surfaceId` should resolve to a command that
  // attaches an inline surface, OR be a self-reference (the command
  // attaches its own surface with the matching id).
  const surfaceIds = new Set<string>();
  for (const c of response.commands) {
    if (c.surface?.id) surfaceIds.add(c.surface.id);
  }
  for (const c of response.commands) {
    if (!c.surfaceId) continue;
    if (!surfaceIds.has(c.surfaceId) && c.surface?.id !== c.surfaceId) {
      issues.push({
        code: "unresolved_surface_reference",
        message: `Command "${c.id}" references surfaceId "${c.surfaceId}" but no command attaches that surface.`,
        path: "surfaceId",
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
