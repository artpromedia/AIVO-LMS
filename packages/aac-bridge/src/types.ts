/**
 * Core AAC event and configuration types for the AIVO AAC Bridge.
 */

export type AACInputMethod =
  | "touch"
  | "switch_1"
  | "switch_2"
  | "eye_gaze"
  | "partner_assisted"
  | "head_pointer"
  | "mouse_keyboard";

export interface AACEvent {
  method: AACInputMethod;
  /** The symbol or UI element ID the event targets. */
  targetId: string;
  timestamp: number;
  /** Dwell duration in milliseconds (eye-gaze dwell-based selection). */
  dwellMs?: number;
  /** Current scanner position (for switch scanning). */
  scanStep?: number;
  /** Eye-gaze fixation confidence 0–1. */
  confidence?: number;
}

export interface AACSessionConfig {
  method: AACInputMethod;
  /** Milliseconds between automatic scan advances (default 1000). */
  scanDelayMs: number;
  /** Dwell time to activate a selection in eye-gaze mode (default 800). */
  dwellTimeMs: number;
  auditoryFeedback: boolean;
  highlightStyle: "box" | "invert" | "glow";
  /** Auto-start scanning on component mount. */
  autoStart: boolean;
}

export interface SymbolItem {
  id: string;
  label: string;
  imageUrl: string;
  /** Pre-recorded TTS audio URL for the symbol label. */
  audioUrl?: string;
  boardId: string;
  position: { row: number; col: number };
  backgroundColor?: string;
  borderColor?: string;
}

export interface SymbolBoard {
  id: string;
  name: string;
  locale: string;
  items: SymbolItem[];
  grid: { rows: number; cols: number };
}

export type HighlightStyle = AACSessionConfig["highlightStyle"];
