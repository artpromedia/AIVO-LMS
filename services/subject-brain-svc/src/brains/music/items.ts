import type { Item } from "../../services/types.js";

export const MUSIC_ITEMS: Item[] = [
  {
    id: "MUSIC.BEAT.001",
    skillCode: "MUSIC.RHYTHM.STEADY_BEAT",
    difficulty: -1.8,
    surface: "choice_grid",
    prompt:
      "Listen to the music. Clap along to the steady beat. Was the beat fast, slow, or just right?",
    options: ["Fast", "Slow", "Just right"],
  },
  {
    id: "MUSIC.PATTERN.001",
    skillCode: "MUSIC.RHYTHM.PATTERNS",
    difficulty: -1.0,
    surface: "voice_response",
    prompt:
      "Listen to this pattern: clap, clap, rest, clap. Now echo it back by clapping out loud.",
  },
  {
    id: "MUSIC.PITCH.001",
    skillCode: "MUSIC.PITCH.HIGH_LOW",
    difficulty: -1.2,
    surface: "choice_grid",
    prompt: "Listen. Which note was higher — the first one or the second one?",
    options: ["First", "Second", "Same"],
  },
  {
    id: "MUSIC.COMPOSE.001",
    skillCode: "MUSIC.COMPOSE.SIMPLE",
    difficulty: 0.2,
    surface: "scratchpad",
    prompt:
      "Make your own 4-beat pattern using claps and rests (e.g. clap, rest, clap, clap).",
  },
];
