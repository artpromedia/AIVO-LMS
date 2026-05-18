import type { TutorKey } from "@aivo/brand";
import type { LearnerSurfaceSpec, FeedbackMode } from "@aivo/learner-surfaces";

export type AdventurePhase =
  | "loading"
  | "pre-adventure"
  | "map"
  | "chapter-intro"
  | "activity"
  | "chapter-complete"
  | "break"
  | "finale"
  | "results";

export type ActivityInteraction =
  | "tap_image"
  | "tap_word"
  | "drag_sort"
  | "drag_place"
  | "sequence"
  | "emotion_pick"
  | "pattern_fill"
  | "memory"
  | "observation"
  | "choice_grid"
  | "memory_sequence"
  | "draw"
  | "scratchpad"
  | "geometry_workspace"
  | "math_expression"
  | "voice_response"
  | "reading_annotation"
  | "science_diagram";

export type DifficultyTier = "easy" | "medium" | "hard";

export interface ActivityChoice {
  id: string;
  label: string;
  emoji?: string;
  image?: string;
  isCorrect: boolean;
}

export interface Activity {
  id: string;
  title: string;
  narration: string;
  tutorLine: string;
  interaction: ActivityInteraction;
  choices?: ActivityChoice[];
  sceneEmoji: string;
  difficulty: DifficultyTier;
  brainMeasures: string[];
  /**
   * When set, the activity renders through `@aivo/learner-surfaces`
   * `SurfaceHost` instead of the legacy choice tile grid. The
   * surface spec carries diagram/scratchpad/scoring/accessibility
   * metadata.
   */
  surface?: LearnerSurfaceSpec;
  feedbackMode?: FeedbackMode;
  scoring?: {
    mode: "exact" | "rubric" | "process" | "hybrid";
    correctAnswer?: string | number | boolean;
    rubric?: Array<{ id: string; label: string; points: number; description: string }>;
  };
  domain?: string;
  skillCode?: string;
  standardCode?: string;
  estimatedDifficulty?: number;
}

export interface AdventureChapter {
  id: string;
  title: string;
  subtitle: string;
  tutorKey: TutorKey;
  domain: string;
  sceneDescription: string;
  bgGradient: string;
  landmark: { emoji: string; label: string };
  transitionLine: string;
}

export interface ChapterActivities {
  easy: Activity[];
  medium: Activity[];
  hard: Activity[];
}

export interface ChapterResult {
  chapterId: string;
  domain: string;
  correct: number;
  total: number;
  avgLatencyMs: number;
  difficulty: DifficultyTier;
}

export interface DiscoveryState {
  phase: AdventurePhase;
  currentChapterIdx: number;
  currentActivityIdx: number;
  chapterResults: ChapterResult[];
  startedAt: number;
  currentDifficulty: DifficultyTier;
  streakCorrect: number;
  streakWrong: number;
  totalCorrect: number;
  totalAttempts: number;
  xpEarned: number;
  favoriteChapterIdx: number;
  responseLatencies: number[];
}

export const ADVENTURE_CHAPTERS: AdventureChapter[] = [
  {
    id: "sage_story_garden",
    title: "Sage's Story Garden",
    subtitle: "Reading & Language",
    domain: "ela",
    tutorKey: "sage" as TutorKey,
    bgGradient: "from-emerald-900 via-teal-800 to-slate-900",
    sceneDescription:
      "An illustrated garden where words grow on trees, sentences bloom as flowers, and stories hide in magical books.",
    landmark: { emoji: "🌳", label: "Story Garden" },
    transitionLine: "Your story garden is growing beautifully! Let me introduce you to my friend.",
  },
  {
    id: "nova_number_galaxy",
    title: "Nova's Number Galaxy",
    subtitle: "Mathematics",
    domain: "math",
    tutorKey: "nova" as TutorKey,
    bgGradient: "from-indigo-950 via-purple-900 to-slate-900",
    sceneDescription: "A cosmic scene with planets, stars, and gently floating asteroids.",
    landmark: { emoji: "⭐", label: "Number Galaxy" },
    transitionLine: "You are a star navigator! Someone else wants to show you their world.",
  },
  {
    id: "spark_discovery_lab",
    title: "Spark's Discovery Lab",
    subtitle: "Science",
    domain: "science",
    tutorKey: "spark" as TutorKey,
    bgGradient: "from-amber-900 via-orange-800 to-slate-900",
    sceneDescription:
      "A colorful laboratory with bubbling beakers, a terrarium with plants, and a microscope.",
    landmark: { emoji: "🧪", label: "Discovery Lab" },
    transitionLine: "Science is all around us! Let's visit someone very special next.",
  },
  {
    id: "harmony_feelings_treehouse",
    title: "Harmony's Feelings Treehouse",
    subtitle: "Social-Emotional Learning",
    domain: "sel",
    tutorKey: "harmony" as TutorKey,
    bgGradient: "from-violet-900 via-purple-800 to-slate-900",
    sceneDescription:
      "A warm, cozy treehouse with soft lighting, cushions, and a window showing the outside world.",
    landmark: { emoji: "🏡", label: "Feelings Treehouse" },
    transitionLine: "You are so kind and thoughtful! One more friend wants to meet you.",
  },
  {
    id: "echo_sound_studio",
    title: "Echo's Sound Studio",
    subtitle: "Speech & Language",
    domain: "speech",
    tutorKey: "echo" as TutorKey,
    bgGradient: "from-pink-900 via-rose-800 to-slate-900",
    sceneDescription:
      "A friendly recording studio with microphones, sound waves, and musical notes.",
    landmark: { emoji: "🎵", label: "Sound Studio" },
    transitionLine: "Your voice is music to my ears! Time for one last adventure.",
  },
  {
    id: "pixel_puzzle_palace",
    title: "Pixel's Puzzle Palace",
    subtitle: "Executive Function & Problem Solving",
    domain: "executive_function",
    tutorKey: "pixel" as TutorKey,
    bgGradient: "from-cyan-900 via-sky-800 to-slate-900",
    sceneDescription:
      "A colorful puzzle room where logic rules and patterns create the environment.",
    landmark: { emoji: "🔮", label: "Puzzle Palace" },
    transitionLine: "You solved every puzzle! What an amazing adventure.",
  },
];

export interface TutorIntro {
  tutorKey: TutorKey;
  name: string;
  line: string;
  emoji: string;
  color: string;
}

export const TUTOR_INTROS: TutorIntro[] = [
  {
    tutorKey: "sage" as TutorKey,
    name: "Sage",
    line: "I know the best stories!",
    emoji: "📖",
    color: "#10B981",
  },
  {
    tutorKey: "nova" as TutorKey,
    name: "Nova",
    line: "I love stars and numbers!",
    emoji: "✨",
    color: "#7C3AED",
  },
  {
    tutorKey: "spark" as TutorKey,
    name: "Spark",
    line: "Want to see something cool?",
    emoji: "⚡",
    color: "#F59E0B",
  },
  {
    tutorKey: "harmony" as TutorKey,
    name: "Harmony",
    line: "I care about how you feel!",
    emoji: "💜",
    color: "#8B5CF6",
  },
  {
    tutorKey: "echo" as TutorKey,
    name: "Echo",
    line: "Let's make some sounds together!",
    emoji: "🎵",
    color: "#EC4899",
  },
  {
    tutorKey: "pixel" as TutorKey,
    name: "Pixel",
    line: "I have the best puzzles!",
    emoji: "🧩",
    color: "#06B6D4",
  },
];

export const FUNCTIONING_LEVEL_CONFIG = {
  STANDARD: { chaptersCount: 6, activitiesPerChapter: 5, choiceCount: 4, narrationAuto: false },
  SUPPORTED: { chaptersCount: 6, activitiesPerChapter: 4, choiceCount: 3, narrationAuto: true },
  LOW_VERBAL: { chaptersCount: 6, activitiesPerChapter: 3, choiceCount: 2, narrationAuto: true },
  NON_VERBAL: { chaptersCount: 4, activitiesPerChapter: 3, choiceCount: 2, narrationAuto: true },
  PRE_SYMBOLIC: { chaptersCount: 0, activitiesPerChapter: 0, choiceCount: 0, narrationAuto: true },
} as const;

export type BreakType = "music" | "word_game" | "exercise";

export interface BreakOption {
  type: BreakType;
  label: string;
  emoji: string;
  description: string;
  durationSec: number;
}

export const BREAK_OPTIONS: BreakOption[] = [
  {
    type: "music",
    label: "Listen to Music",
    emoji: "🎵",
    description: "Relax with some calming tunes",
    durationSec: 35,
  },
  {
    type: "word_game",
    label: "Word Game",
    emoji: "🔤",
    description: "Play a quick word scramble",
    durationSec: 40,
  },
  {
    type: "exercise",
    label: "Move & Stretch",
    emoji: "🤸",
    description: "Do some fun stretches",
    durationSec: 30,
  },
];

export type FunctioningLevel = keyof typeof FUNCTIONING_LEVEL_CONFIG;
