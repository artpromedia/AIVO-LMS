/**
 * Sprint 13 — surface-type → component registry (mirrors the web
 * packages/learner-surfaces router shape, natively).
 *
 * `resolveSurface` never throws: kinds without a dedicated mobile renderer
 * fall back to the ink workspace, exactly the monolith's else-branch — the
 * dispatcher labels those as the simplified experience and telemetry
 * reports `unsupported_surface`, so the downgrade stays explicit.
 */
import type { ComponentType } from "react";
import type { LearnerSurfaceKind } from "@/src/types/learnerSurface";
import type { SurfaceProps } from "./surfaces/types";
import { TextResponseSurface } from "./surfaces/TextResponseSurface";
import { NumberLineSurface } from "./surfaces/NumberLineSurface";
import { FractionBarSurface } from "./surfaces/FractionBarSurface";
import { CodingSandboxSurface } from "./surfaces/CodingSandboxSurface";
import { ArtCanvasSurface } from "./surfaces/ArtCanvasSurface";
import { ReadingAnnotationSurface } from "./surfaces/ReadingAnnotationSurface";
import { VoiceResponseSurface } from "./surfaces/VoiceResponseSurface";
import { GraphSurface } from "./surfaces/GraphSurface";
import { DragManipulativeSurface } from "./surfaces/DragManipulativeSurface";
import { MultiStepSurface } from "./surfaces/MultiStepSurface";
import { ScienceDiagramSurface } from "./surfaces/ScienceDiagramSurface";
import { MusicSequencerSurface } from "./surfaces/MusicSequencerSurface";
import { GeometryWorkspaceSurface } from "./surfaces/GeometryWorkspaceSurface";
import { MediaSurface } from "./surfaces/MediaSurface";
import { ScratchFallbackSurface } from "./surfaces/ScratchFallbackSurface";

export const SURFACE_REGISTRY: Partial<Record<LearnerSurfaceKind, ComponentType<SurfaceProps>>> =
  {
    "text_response": TextResponseSurface,
    "number_line": NumberLineSurface,
    "fraction_bar": FractionBarSurface,
    "coding_sandbox": CodingSandboxSurface,
    "art_canvas": ArtCanvasSurface,
    "reading_annotation": ReadingAnnotationSurface,
    "voice_response": VoiceResponseSurface,
    "graph": GraphSurface,
    "drag_manipulative": DragManipulativeSurface,
    "multi_step_workspace": MultiStepSurface,
    "science_diagram": ScienceDiagramSurface,
    "music_sequencer": MusicSequencerSurface,
    "geometry_workspace": GeometryWorkspaceSurface,
    "video": MediaSurface,
    "audio": MediaSurface,
    "scratchpad": ScratchFallbackSurface,
  };

/** Typed lookup with the monolith's fallback: unknown kinds get the ink
 *  workspace (chart and anything new server-side). */
export function resolveSurface(kind: LearnerSurfaceKind): ComponentType<SurfaceProps> {
  return SURFACE_REGISTRY[kind] ?? ScratchFallbackSurface;
}
