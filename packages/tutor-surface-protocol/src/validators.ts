import type {
  LearnerSurfaceSpec,
  SurfaceProtocolProfile,
  TutorSurfaceCommand,
  TutorSurfaceCommandType,
  ValidationIssue,
  ValidationResult,
} from "./types.js";

const SUPPORTED_SURFACE_TYPES = new Set([
  "scratchpad",
  "geometry_workspace",
  "graph",
  "number_line",
  "drag_manipulative",
  "reading_annotation",
  "science_diagram",
  "choice_grid",
  "math_expression",
  "voice_response",
  "multi_step_workspace",
]);

const SUPPORTED_COMMAND_TYPES: ReadonlySet<TutorSurfaceCommandType> = new Set([
  "open_scratchpad",
  "show_geometry",
  "show_graph",
  "show_number_line",
  "show_manipulative",
  "show_reading_annotation",
  "show_science_diagram",
  "collect_answer",
  "collect_drawing",
  "highlight_object",
  "update_label",
  "save_snapshot",
]);

const RAW_HTML_PATTERN = /<\s*[a-z!][^>]*>/i;
const RAW_SVG_PATTERN = /<\s*svg\b/i;
const RAW_SCRIPT_PATTERN = /<\s*script\b/i;

const SPEECH_REQUIRED_COMMANDS: ReadonlySet<TutorSurfaceCommandType> = new Set(["collect_answer"]);

function containsUnsafeMarkup(value: string): boolean {
  return (
    RAW_HTML_PATTERN.test(value) || RAW_SVG_PATTERN.test(value) || RAW_SCRIPT_PATTERN.test(value)
  );
}

function scanFreeText(payload: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof payload === "string") {
    if (containsUnsafeMarkup(payload)) {
      issues.push({
        code: "unsafe_markup",
        message: "Raw HTML, SVG, or script content is not allowed in tutor surface commands.",
        path,
      });
    }
    return;
  }
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => scanFreeText(item, `${path}[${index}]`, issues));
    return;
  }
  if (payload && typeof payload === "object") {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      scanFreeText(value, `${path}.${key}`, issues);
    }
  }
}

function validateSurfaceSpec(
  surface: LearnerSurfaceSpec | undefined,
  command: TutorSurfaceCommand,
  issues: ValidationIssue[],
): void {
  if (!surface) {
    if (
      command.commandType === "show_geometry" ||
      command.commandType === "show_graph" ||
      command.commandType === "show_number_line" ||
      command.commandType === "show_manipulative" ||
      command.commandType === "show_science_diagram" ||
      command.commandType === "show_reading_annotation" ||
      command.commandType === "open_scratchpad"
    ) {
      issues.push({
        code: "missing_surface_spec",
        message: `Command ${command.commandType} requires a surface spec.`,
        path: "surface",
      });
    }
    return;
  }
  if (!surface.id) {
    issues.push({
      code: "missing_surface_id",
      message: "Surface must include an id.",
      path: "surface.id",
    });
  }
  if (!surface.type || !SUPPORTED_SURFACE_TYPES.has(surface.type)) {
    issues.push({
      code: "unsupported_surface_type",
      message: `Unsupported surface type: ${surface.type ?? "<missing>"}.`,
      path: "surface.type",
    });
  }
  if (
    !surface.accessibility ||
    !surface.accessibility.altText ||
    surface.accessibility.altText.trim() === ""
  ) {
    issues.push({
      code: "missing_alt_text",
      message: "Surface accessibility.altText is required.",
      path: "surface.accessibility.altText",
    });
  }
  if (surface.accessibility && surface.accessibility.keyboardAlternative === false) {
    issues.push({
      code: "missing_keyboard_alternative",
      message: "Surface must offer a keyboard alternative.",
      path: "surface.accessibility.keyboardAlternative",
    });
  }
  if (command.commandType === "show_geometry") {
    const shapes = surface.diagram?.shapes ?? [];
    if (!Array.isArray(shapes) || shapes.length === 0) {
      issues.push({
        code: "geometry_without_shapes",
        message: "Geometry surface must include at least one shape.",
        path: "surface.diagram.shapes",
      });
    }
  }
  if (command.commandType === "open_scratchpad" || command.commandType === "collect_drawing") {
    if (!surface.scratchpad || surface.scratchpad.enabled === false) {
      issues.push({
        code: "scratchpad_without_ink_capture",
        message: "Scratchpad command must enable ink capture.",
        path: "surface.scratchpad.enabled",
      });
    }
  }
}

function validateProfile(
  command: TutorSurfaceCommand,
  profile: SurfaceProtocolProfile | undefined,
  issues: ValidationIssue[],
): void {
  if (!profile) return;
  const speechRequired = SPEECH_REQUIRED_COMMANDS.has(command.commandType);
  if (
    speechRequired &&
    profile.functioningLevel === "NON_VERBAL" &&
    profile.speechAvailable !== true
  ) {
    issues.push({
      code: "speech_required_for_non_verbal",
      message: "Speech-required command is not permitted for NON_VERBAL profile.",
      path: "commandType",
    });
  }
  const longResponseExpected =
    command.expectedLearnerAction === "type_long_response" ||
    command.expectedLearnerAction === "essay";
  if (
    longResponseExpected &&
    (profile.functioningLevel === "LOW_VERBAL" || profile.functioningLevel === "PRE_SYMBOLIC")
  ) {
    issues.push({
      code: "long_text_for_low_verbal",
      message: "Long typed response is not appropriate for LOW_VERBAL or PRE_SYMBOLIC profile.",
      path: "expectedLearnerAction",
    });
  }
}

export function validateTutorSurfaceCommand(
  command: TutorSurfaceCommand,
  profile?: SurfaceProtocolProfile,
): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!command || typeof command !== "object") {
    issues.push({ code: "invalid_command", message: "Command must be an object." });
    return { valid: false, issues };
  }

  if (!command.id) {
    issues.push({ code: "missing_command_id", message: "Command must include an id.", path: "id" });
  }
  if (!command.surfaceId) {
    issues.push({
      code: "missing_surface_id",
      message: "Command must include a surfaceId.",
      path: "surfaceId",
    });
  }
  if (!command.reason || command.reason.trim() === "") {
    issues.push({
      code: "missing_reason",
      message: "Command must include a reason.",
      path: "reason",
    });
  }
  if (!SUPPORTED_COMMAND_TYPES.has(command.commandType)) {
    issues.push({
      code: "unsupported_command_type",
      message: `Unsupported commandType: ${command.commandType}.`,
      path: "commandType",
    });
  }

  // Scan command and any nested payload for raw HTML/SVG/script injections.
  scanFreeText(command.reason, "reason", issues);
  scanFreeText(command.expectedLearnerAction, "expectedLearnerAction", issues);
  scanFreeText(command.profileAdaptationRationale, "profileAdaptationRationale", issues);
  scanFreeText(command.commandPayload, "commandPayload", issues);
  if (command.surface) {
    scanFreeText(command.surface.prompt, "surface.prompt", issues);
    scanFreeText(command.surface.instructions, "surface.instructions", issues);
    scanFreeText(command.surface.accessibility?.altText, "surface.accessibility.altText", issues);
  }

  validateSurfaceSpec(command.surface, command, issues);
  validateProfile(command, profile, issues);

  return { valid: issues.length === 0, issues };
}

export function validateTutorSurfaceCommands(
  commands: TutorSurfaceCommand[],
  profile?: SurfaceProtocolProfile,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  for (const command of commands) {
    if (command.id) {
      if (ids.has(command.id)) {
        issues.push({
          code: "duplicate_command_id",
          message: `Duplicate command id: ${command.id}`,
          path: "id",
        });
      }
      ids.add(command.id);
    }
    const result = validateTutorSurfaceCommand(command, profile);
    issues.push(...result.issues);
  }
  return { valid: issues.length === 0, issues };
}
