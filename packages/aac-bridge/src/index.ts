// Phase 1 — Core types and controllers
export type {
  AACInputMethod,
  AACEvent,
  AACSessionConfig,
  SymbolItem,
  SymbolBoard,
  HighlightStyle,
} from "./types.js";

export { SwitchScanController } from "./SwitchScanController.js";
export { useAACInput } from "./useAACInput.js";
export type { UseAACInputResult } from "./useAACInput.js";

// Sprint 7 — lightweight target registry for wrapping arbitrary UI
// controls (lesson-player buttons, tutor chat composer, etc.) without
// pre-building a SymbolBoard.
export {
  AACTargetProvider,
  AACScanRoot,
  useAACTarget,
  useAACContext,
  type AACTargetProviderProps,
  type AACScanRootProps,
  type AACTargetRegistration,
  type AACProviderContextValue,
  type UseAACTargetResult,
} from "./AACTargetProvider.js";

// OBF / OBZ
export { parseOBF, parseOBZ, validateOBF } from "./obf/OBFImporter.js";
export { exportToOBF } from "./obf/OBFExporter.js";
export type { OBFBoard, OBFManifest, OBFButton, OBFImage } from "./obf/types.js";

// Phase 2 — Adapters
export type { AACInputAdapter } from "./adapters/AACInputAdapter.js";
export { PRCSaltilloAdapter } from "./adapters/PRCSaltilloAdapter.js";
export { TobiiAdapter } from "./adapters/TobiiAdapter.js";
export { AssistiveWareAdapter } from "./adapters/AssistiveWareAdapter.js";
export { detectAndCreateAdapter, listAvailableAdapters } from "./adapters/AdapterFactory.js";

// CoughDrop sync
export { CoughDropSync } from "./coughdrop/CoughDropSync.js";
export type { SyncStatus, SyncState } from "./coughdrop/CoughDropSync.js";

// Core-word vocabulary (board anchoring)
export {
  coreWordsForLocale,
  resolveSymbolUrl,
  CORE_GRID_COLS,
} from "./vocabulary/coreWords.js";
export type { CoreWord } from "./vocabulary/coreWords.js";

// Eye-gaze pipeline (§9.3)
export { CalibrationState, GazeTargetMapper, DwellClickController } from "./eye-gaze/pipeline.js";
export type {
  GazeFrame,
  GazeTarget,
  GazeClickEvent,
  CalibrationPoint,
  DwellClickConfig,
} from "./eye-gaze/pipeline.js";

// Vendor-certification harness (§9.3)
export {
  CONFORMANCE_CHECKS,
  DEFAULT_CONFORMANCE_CONFIG,
  SUITE_VERSION,
  runConformanceSuite,
} from "./certification/conformance.js";
export type {
  CertifiedVendor,
  ConformanceCheck,
  ConformanceResult,
} from "./certification/conformance.js";
export { CERTIFIED_VENDORS, isCertified, certificationsFor } from "./certification/registry.js";
