export type {
  LearnerSurfaceType,
  FeedbackMode,
  ScoringMode,
  Point,
  LearnerSurfaceSpec,
  SurfaceCaptureSpec,
  SurfaceScoringSpec,
  SurfaceAccessibilitySpec,
  RubricCriterion,
  MisconceptionRule,
  ScratchpadSpec,
  ScratchpadTool,
  AnswerInputSpec,
  ChoiceOption,
  GeometryDiagramSpec,
  GeometryShape,
  GeometryLabel,
  GeometryMeasurement,
  GeometryTool,
  SurfaceResponse,
  GeometryAction,
  CodingSandboxSpec,
  ArtCanvasSpec,
  VoiceResponseSpec,
  VoiceResponsePayload,
  MediaSurfaceSpec,
  SurfaceAssetDescriptor,
  SurfaceUserAccessibilityPreferences,
} from "./types.js";

export { SurfaceHost, type SurfaceHostProps } from "./SurfaceHost.js";
export { ScratchpadSurface, type ScratchpadSurfaceProps } from "./surfaces/ScratchpadSurface.js";
export { GeometrySurface, type GeometrySurfaceProps } from "./surfaces/GeometrySurface.js";
export { ChoiceGridSurface, type ChoiceGridSurfaceProps } from "./surfaces/ChoiceGridSurface.js";
export { NumberLineSurface, type NumberLineSurfaceProps } from "./surfaces/NumberLineSurface.js";
export {
  MathExpressionSurface,
  type MathExpressionSurfaceProps,
} from "./surfaces/MathExpressionSurface.js";
export {
  ReadingAnnotationSurface,
  type ReadingAnnotationSurfaceProps,
} from "./surfaces/ReadingAnnotationSurface.js";
export { GraphSurface, type GraphSurfaceProps } from "./surfaces/GraphSurface.js";
export {
  DragManipulativeSurface,
  type DragManipulativeSurfaceProps,
} from "./surfaces/DragManipulativeSurface.js";
export {
  MultiStepWorkspaceSurface,
  type MultiStepWorkspaceSurfaceProps,
} from "./surfaces/MultiStepWorkspaceSurface.js";
export {
  ScienceDiagramSurface,
  type ScienceDiagramSurfaceProps,
} from "./surfaces/ScienceDiagramSurface.js";
export {
  toggleSpanSelection,
  scoreReadingAnnotation,
  defaultReadingTool,
  pointsMatch,
  snapToGrid,
  scoreGraph,
  scoreDragManipulative,
  targetIsFull,
  normalizeAnswer,
  scoreMultiStep,
  scoreScienceDiagram,
} from "./scoring/activity-scoring.js";
export {
  SurfaceRouter,
  SUPPORTED_RUNTIME_TYPES,
  ITEM_TYPE_TO_RUNTIME,
  toRuntimeSurfaceType,
  type SurfaceRouterAccessibilitySettings,
  type SurfaceRouterItem,
  type SurfaceRouterProps,
  type SurfaceRouterSubmitResult,
  type ItemAuthoredSurfaceType,
  type RouterSurfaceType,
} from "./SurfaceRouter/index.js";
export {
  CodingSandboxSurface,
  type CodingSandboxSurfaceProps,
} from "./surfaces/CodingSandboxSurface.js";
export {
  runJavascriptRubricTests,
  buildSnippetTelemetry,
  type CodingRubric,
  type CodingRubricTest,
  type CodingLanguage,
  type CodingRunResult,
  type CodingTestResult,
  CODING_FIXTURE_ITEMS,
  type CodingFixtureItem,
} from "./CodingSandbox/index.js";
export { ArtCanvasSurface, type ArtCanvasSurfaceProps } from "./surfaces/ArtCanvasSurface.js";
export {
  VoiceResponseSurface,
  type VoiceResponseSurfaceProps,
} from "./surfaces/VoiceResponseSurface.js";
export { VideoSurface, type VideoSurfaceProps } from "./Video/VideoSurface.js";
export { AudioSurface, type AudioSurfaceProps } from "./Audio/AudioSurface.js";

export {
  isSurfaceEntitled,
  isPremiumSurface,
  requiredTutorForSurface,
  requiredTutorsForSurface,
  type SurfaceTutorKey,
} from "./entitlement/required-tutor.js";

export {
  SURFACE_CAPABILITY_REGISTRY,
  ALL_SURFACE_TYPES,
  surfaceSupport,
  isSurfaceFallback,
  type SurfaceCapability,
  type SurfaceSupportLevel,
} from "./SurfaceRouter/surface-capability.js";

export { InkCanvas, type InkCanvasProps } from "./ink/InkCanvas.js";
export {
  createStroke,
  appendStrokePoint,
  addStroke,
  undoStroke,
  clearStrokes,
  exportStrokes,
  type InkPoint,
  type InkStroke,
} from "./ink/stroke-model.js";
export { usePointerInk, type InkTool } from "./ink/usePointerInk.js";

export { distance, midpoint, angleDegrees, toPointString } from "./geometry/primitives.js";
export { renderGeometrySvg, type RenderGeometrySvgProps } from "./geometry/renderGeometrySvg.js";
export { inferMeasurementText, enrichMeasurements } from "./geometry/measurement-tools.js";
export {
  useGeometryInteractions,
  type UseGeometryInteractions,
  type UseGeometryInteractionsOptions,
} from "./geometry/useGeometryInteractions.js";

export {
  createSurfaceEvent,
  type SurfaceTelemetryEvent,
  type SurfaceTelemetryEventType,
} from "./telemetry/surface-events.js";

export { describeSurface } from "./a11y/describeSurface.js";
