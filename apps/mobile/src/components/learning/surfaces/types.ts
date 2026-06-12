/**
 * Sprint 13 — shared contract for the decomposed mobile surface modules.
 *
 * Extracted verbatim from MobileSurfaceRenderer.tsx: the SurfaceCommand
 * union the runtime consumes, the tutor entitlement map (kept in sync with
 * the web learner-surfaces map — mobile must not import that package, it
 * depends on react-dom), and the census of kinds with a dedicated mobile
 * renderer.
 */
import type { TierThemeMobile } from "@aivo/mobile-ui";
import type { LearnerSurfaceKind } from "@/src/types/learnerSurface";
import type { ScratchStroke } from "../ScratchPad";

/**
 * Mobile surface kinds that have a dedicated interactive renderer. Everything
 * else (chart, or an unknown kind) is a fallback: it still lets the learner
 * respond via the ink workspace, but is reported to telemetry as
 * `unsupported_surface` and labelled as a simplified version (Sprint 3).
 */
export const FULL_MOBILE_KINDS = new Set<LearnerSurfaceKind>([
  "text_response",
  "number_line",
  "fraction_bar",
  "coding_sandbox",
  "art_canvas",
  "scratchpad",
  "reading_annotation",
  "voice_response",
  "geometry_workspace",
  "graph",
  "drag_manipulative",
  "multi_step_workspace",
  "science_diagram",
  "video",
  "audio",
  "music_sequencer",
]);

export type SurfaceTutorKey =
  | "nova"
  | "sage"
  | "spark"
  | "chrono"
  | "pixel"
  | "echo"
  | "harmony"
  | "atlas"
  | "cadence"
  | "vigor"
  | "lingua"
  | "forge"
  | "compass"
  | "muse";

/**
 * Mirror of the web `requiredTutorForSurface` map. Kept here so the mobile
 * bundle doesn't have to import the web learner-surfaces package (which
 * depends on `react-dom`). Keep these two in sync.
 */
const REQUIRED_TUTOR: Partial<
  Record<LearnerSurfaceKind, SurfaceTutorKey | readonly SurfaceTutorKey[]>
> = {
  coding_sandbox: "pixel",
  // Sprint 1 fix (kept in sync with the web entitlement map): the art canvas
  // belongs to the art tutor (muse), not the music tutor (cadence).
  art_canvas: "muse",
  // Sprint 8: the music/rhythm sequencer belongs to the music tutor (cadence).
  music_sequencer: "cadence",
  // Follow-up: spoken responses serve speech (echo) and world languages
  // (lingua) — full parity with the web entitlement map.
  voice_response: ["echo", "lingua"],
};

/** Every tutor that unlocks a surface (empty when free). */
export function requiredTutorsFor(kind: LearnerSurfaceKind): readonly SurfaceTutorKey[] {
  const v = REQUIRED_TUTOR[kind];
  if (!v) return [];
  return Array.isArray(v) ? v : [v as SurfaceTutorKey];
}

export function isEntitled(
  kind: LearnerSurfaceKind,
  entitled?: ReadonlySet<SurfaceTutorKey> | readonly SurfaceTutorKey[],
): boolean {
  const required = requiredTutorsFor(kind);
  if (required.length === 0) return true;
  if (entitled === undefined) return true;
  const has = Array.isArray(entitled)
    ? (k: SurfaceTutorKey) => entitled.includes(k)
    : (k: SurfaceTutorKey) => (entitled as ReadonlySet<SurfaceTutorKey>).has(k);
  return required.some(has);
}

export type SurfaceCommand =
  | { kind: "text_response"; text: string }
  | { kind: "number_line"; value: number }
  | { kind: "fraction_bar"; numerator: number; denominator: number }
  | { kind: "scratchpad"; strokes: ScratchStroke[] }
  | { kind: "geometry_workspace"; strokes: ScratchStroke[] }
  | { kind: "chart"; strokes: ScratchStroke[] }
  | { kind: "coding_sandbox"; code: string; language: string }
  | { kind: "art_canvas"; strokes: ScratchStroke[]; color: string }
  | { kind: "reading_annotation"; selectedSpanIds: string[]; tool: string }
  | { kind: "voice_response"; transcript: string }
  | { kind: "graph"; points: { x: number; y: number }[] }
  | { kind: "drag_manipulative"; placement: Record<string, string> }
  | { kind: "multi_step_workspace"; entries: Record<string, string> }
  | { kind: "science_diagram"; placement: Record<string, string> }
  | { kind: "media_complete"; surfaceKind: LearnerSurfaceKind }
  | { kind: "music_sequencer"; pattern: number[][] }
  | { kind: "noop"; surfaceKind: LearnerSurfaceKind };

/**
 * Uniform props every surface module accepts (the registry's component
 * contract). Modules read the slices they need; config parsing that the
 * monolith did at its dispatch site moved INTO the owning module with the
 * same defaults and clamps.
 */
export interface SurfaceProps {
  theme: TierThemeMobile;
  disabled?: boolean;
  surfaceKind: LearnerSurfaceKind;
  cfg: Record<string, unknown> | undefined;
  onSubmit: (c: SurfaceCommand) => void;
}
