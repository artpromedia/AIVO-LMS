/**
 * Stage types — split between the shared subset (canonical in
 * `@aivo/stage-ui`) and the web-only richer extensions kept here.
 *
 * The shared subset (`FunctioningLevel`, `SensoryLevel`, `SensoryProfile`,
 * `SensoryAdaptations`, `TutorState`, `InteractionType`, `SessionPhase`,
 * `ChoiceOption`) is re-exported below so existing
 * `@/components/stage/types` imports continue to work, but the *definition*
 * lives in `@aivo/stage-ui/types` — a single source of truth shared with
 * the mobile app and `@aivo/stage-runtime`.
 *
 * The richer extensions (`VisualElement`, `DragItem`, `DragZone`,
 * `Beat`-with-`visuals`, `StageTheme`, `TUTOR_THEMES`, `SESSION_DURATIONS`,
 * `CHOICE_COUNTS`, the richer `SessionState` with `tutorKey` / `beats`)
 * remain local because the package versions of the stage components do
 * not yet have feature parity with these DOM-only fields. Once the
 * package gains parity, the local stage components and this file can be
 * deleted in favour of pure re-exports from `@aivo/stage-ui`.
 */
import type { TutorKey } from "@aivo/brand";
import type { LearnerSurfaceSpec } from "@aivo/learner-surfaces";
import type {
  FunctioningLevel,
  SensoryLevel,
  SensoryProfile,
  SensoryAdaptations,
  TutorState,
  InteractionType as SharedInteractionType,
  SessionPhase,
  ChoiceOption,
} from "@aivo/stage-ui";

export type {
  FunctioningLevel,
  SensoryLevel,
  SensoryProfile,
  SensoryAdaptations,
  TutorState,
  SessionPhase,
  ChoiceOption,
};

/**
 * Web-side interactions extend the shared list with surface-aware
 * variants. Legacy values (`multiple_choice`, `drag_drop`, `voice`,
 * `tap`, `match`, `draw`) keep working unchanged.
 */
export type InteractionType =
  | SharedInteractionType
  | "geometry_workspace"
  | "scratchpad"
  | "math_expression";

export interface VisualElement {
  id: string;
  type: "image" | "text" | "shape" | "card" | "manipulative" | "diagram";
  content: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  animation?: "fade_in" | "slide_in" | "bounce" | "pulse" | "float" | "glow";
  emoji?: string;
  color?: string;
}

export interface DragItem {
  id: string;
  label: string;
  emoji?: string;
  targetZone: string;
}

export interface DragZone {
  id: string;
  label: string;
}

export interface Beat {
  id: string;
  type: "narration" | "interaction" | "demonstration" | "celebration" | "reflection";
  narration?: string;
  tutorState: TutorState;
  visuals: VisualElement[];
  interaction?: {
    type: InteractionType;
    prompt?: string;
    choices?: ChoiceOption[];
    dragItems?: DragItem[];
    dragZones?: DragZone[];
    correctAnswer?: string;
  };
  /**
   * Optional inline surface spec for surface-aware beats (geometry,
   * scratchpad, math expression, etc.). When `surfaceId` is set
   * instead, the parent StagePlan must provide a surfaces dictionary
   * the runtime can resolve against.
   */
  surface?: LearnerSurfaceSpec;
  surfaceId?: string;
  durationMs?: number;
  transition?: "fade" | "slide" | "zoom";
}

export interface SessionState {
  phase: SessionPhase;
  currentBeatIndex: number;
  beats: Beat[];
  totalBeats: number;
  xpEarned: number;
  coinsEarned: number;
  correctCount: number;
  totalAttempts: number;
  startedAt: number;
  tutorKey: TutorKey;
  learnerId: string;
  sessionId?: string;
  learnerName?: string;
  functioningLevel: FunctioningLevel;
}

export interface StageTheme {
  bgGradient: string;
  bgPattern: string;
  accentColor: string;
  envEmoji: string;
  envName: string;
}

export const TUTOR_THEMES: Record<string, StageTheme> = {
  nova: {
    bgGradient: "from-indigo-950 via-purple-900 to-slate-900",
    bgPattern: "stars",
    accentColor: "#7C3AED",
    envEmoji: "✨",
    envName: "Cosmic Observatory",
  },
  sage: {
    bgGradient: "from-emerald-900 via-teal-800 to-slate-900",
    bgPattern: "books",
    accentColor: "#10B981",
    envEmoji: "📖",
    envName: "Story Garden",
  },
  spark: {
    bgGradient: "from-amber-900 via-orange-800 to-slate-900",
    bgPattern: "atoms",
    accentColor: "#F59E0B",
    envEmoji: "⚡",
    envName: "Discovery Lab",
  },
  chrono: {
    bgGradient: "from-indigo-900 via-blue-800 to-slate-900",
    bgPattern: "columns",
    accentColor: "#6366F1",
    envEmoji: "⏳",
    envName: "Time Archive",
  },
  pixel: {
    bgGradient: "from-cyan-900 via-sky-800 to-slate-900",
    bgPattern: "grid",
    accentColor: "#06B6D4",
    envEmoji: "💻",
    envName: "Code Realm",
  },
  echo: {
    bgGradient: "from-pink-900 via-rose-800 to-slate-900",
    bgPattern: "waves",
    accentColor: "#EC4899",
    envEmoji: "🎵",
    envName: "Sound Studio",
  },
  harmony: {
    bgGradient: "from-violet-900 via-purple-800 to-slate-900",
    bgPattern: "hearts",
    accentColor: "#8B5CF6",
    envEmoji: "💜",
    envName: "Harmony Haven",
  },
  atlas: {
    bgGradient: "from-teal-900 via-emerald-800 to-slate-900",
    bgPattern: "globe",
    accentColor: "#14B8A6",
    envEmoji: "🌍",
    envName: "World Explorer",
  },
  cadence: {
    bgGradient: "from-fuchsia-900 via-pink-800 to-slate-900",
    bgPattern: "notes",
    accentColor: "#D946EF",
    envEmoji: "🎶",
    envName: "Rhythm Studio",
  },
  vigor: {
    bgGradient: "from-green-900 via-lime-800 to-slate-900",
    bgPattern: "motion",
    accentColor: "#22C55E",
    envEmoji: "🏃",
    envName: "Active Arena",
  },
  lingua: {
    bgGradient: "from-sky-900 via-blue-800 to-slate-900",
    bgPattern: "flags",
    accentColor: "#0EA5E9",
    envEmoji: "🌐",
    envName: "Language Bridge",
  },
  forge: {
    bgGradient: "from-red-900 via-orange-800 to-slate-900",
    bgPattern: "gears",
    accentColor: "#EF4444",
    envEmoji: "⚙️",
    envName: "Forge Workshop",
  },
  compass: {
    bgGradient: "from-orange-900 via-amber-800 to-slate-900",
    bgPattern: "paths",
    accentColor: "#F97316",
    envEmoji: "🧭",
    envName: "Life Path",
  },
  muse: {
    bgGradient: "from-purple-900 via-violet-800 to-slate-900",
    bgPattern: "palette",
    accentColor: "#A855F7",
    envEmoji: "🎨",
    envName: "Creative Studio",
  },
};

export const SESSION_DURATIONS: Record<FunctioningLevel, { min: number; max: number }> = {
  STANDARD: { min: 10, max: 15 },
  SUPPORTED: { min: 8, max: 12 },
  LOW_VERBAL: { min: 3, max: 5 },
  NON_VERBAL: { min: 2, max: 3 },
  PRE_SYMBOLIC: { min: 1, max: 2 },
};

export const CHOICE_COUNTS: Record<FunctioningLevel, number> = {
  STANDARD: 4,
  SUPPORTED: 3,
  LOW_VERBAL: 2,
  NON_VERBAL: 2,
  PRE_SYMBOLIC: 2,
};
