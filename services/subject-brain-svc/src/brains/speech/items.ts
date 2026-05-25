import type { Item } from "../../services/types.js";

export const SPEECH_ITEMS: Item[] = [
  {
    id: "SPEECH.IDENT.001",
    skillCode: "SPEECH.ARTIC.SOUND_IDENT",
    difficulty: -2.0,
    surface: "choice_grid",
    prompt: "Listen. Which picture starts with the /s/ sound?",
    options: ["sun", "moon", "tree", "dog"],
  },
  {
    id: "SPEECH.PRODUCE.001",
    skillCode: "SPEECH.ARTIC.PRODUCE",
    difficulty: -1.5,
    surface: "voice_response",
    prompt: "Say the sound /s/ three times.",
  },
  {
    id: "SPEECH.WORD.001",
    skillCode: "SPEECH.ARTIC.WORD_LEVEL",
    difficulty: -0.8,
    surface: "voice_response",
    prompt: "Say the word 'sun'.",
  },
  {
    id: "SPEECH.WORD.002",
    skillCode: "SPEECH.ARTIC.WORD_LEVEL",
    difficulty: -0.3,
    surface: "voice_response",
    prompt: "Say the word 'sister'.",
  },
  {
    id: "SPEECH.FLUENCY.001",
    skillCode: "SPEECH.FLUENCY.PACING",
    difficulty: 0.2,
    surface: "voice_response",
    prompt: "Read aloud, slowly: 'Sally sells seashells.'",
  },
];
