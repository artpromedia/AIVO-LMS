import { AudioSurface } from "./Audio/AudioSurface.js";
import { VideoSurface } from "./Video/VideoSurface.js";
import { ArtCanvasSurface } from "./surfaces/ArtCanvasSurface.js";
import { ChoiceGridSurface } from "./surfaces/ChoiceGridSurface.js";
import { CodingSandboxSurface } from "./surfaces/CodingSandboxSurface.js";
import { GeometrySurface } from "./surfaces/GeometrySurface.js";
import { MathExpressionSurface } from "./surfaces/MathExpressionSurface.js";
import { ScratchpadSurface } from "./surfaces/ScratchpadSurface.js";
import { VoiceResponseSurface } from "./surfaces/VoiceResponseSurface.js";
import { ReadingAnnotationSurface } from "./surfaces/ReadingAnnotationSurface.js";
import { GraphSurface } from "./surfaces/GraphSurface.js";
import { DragManipulativeSurface } from "./surfaces/DragManipulativeSurface.js";
import { MultiStepWorkspaceSurface } from "./surfaces/MultiStepWorkspaceSurface.js";
import type { SurfaceTelemetryEvent } from "./telemetry/surface-events.js";
import type {
  LearnerSurfaceSpec,
  SurfaceResponse,
  SurfaceUserAccessibilityPreferences,
} from "./types.js";

export interface SurfaceRouterProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
  accessibilityPreferences?: SurfaceUserAccessibilityPreferences;
}

export function SurfaceRouter({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
  accessibilityPreferences,
}: SurfaceRouterProps) {
  switch (surface.type) {
    case "choice_grid":
      return (
        <ChoiceGridSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "scratchpad":
      return (
        <ScratchpadSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "geometry_workspace":
      return (
        <GeometrySurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "math_expression":
      return (
        <MathExpressionSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "coding_sandbox":
      return (
        <CodingSandboxSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "art_canvas":
      return (
        <ArtCanvasSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "voice_response":
      return (
        <VoiceResponseSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "video":
      return (
        <VideoSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
          accessibilityPreferences={accessibilityPreferences}
        />
      );
    case "audio":
      return (
        <AudioSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
          accessibilityPreferences={accessibilityPreferences}
        />
      );
    case "reading_annotation":
      return (
        <ReadingAnnotationSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "graph":
      return (
        <GraphSurface surface={surface} disabled={disabled} onSubmit={onSubmit} onEvent={onEvent} />
      );
    case "drag_manipulative":
      return (
        <DragManipulativeSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    case "multi_step_workspace":
      return (
        <MultiStepWorkspaceSurface
          surface={surface}
          disabled={disabled}
          onSubmit={onSubmit}
          onEvent={onEvent}
        />
      );
    default:
      return null;
  }
}
