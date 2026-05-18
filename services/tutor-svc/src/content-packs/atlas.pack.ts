/**
 * Starter content pack for Atlas (Geography & World Cultures, K–2).
 *
 * Anchors: `ncge-geography-k2` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const atlasStarterPack: ContentPack = {
  id: "atlas-geography-k2-starter",
  title: "Atlas — Geography K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "geography",
  gradeBand: "K",
  skillGraphRefs: ["ncge-geography-k2"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "atlas.k2.maps.intro",
      title: "What is a map?",
      skillId: "ncge.k2.S1.1",
      type: "narration",
      prompt:
        "A map is a picture from above. It shows where places are. Let's explore the map of our school.",
      difficulty: "intro",
    },
    {
      id: "atlas.k2.maps.tap",
      title: "Find the school",
      skillId: "ncge.k2.S1.1",
      type: "tap",
      prompt: "Tap the building on the map labeled 'school'.",
      difficulty: "core",
      choices: [
        { id: "school", label: "🏫 School", correct: true },
        { id: "park", label: "🌳 Park", correct: false },
        { id: "store", label: "🏪 Store", correct: false },
      ],
    },
    {
      id: "atlas.k2.places.mc",
      title: "Land or water?",
      skillId: "ncge.k2.S2.1",
      type: "multiple_choice",
      prompt: "On a globe, the BLUE parts usually show…",
      difficulty: "core",
      choices: [
        { id: "land", label: "Land", correct: false },
        { id: "water", label: "Water (oceans, lakes, rivers)", correct: true },
        { id: "sky", label: "The sky", correct: false },
      ],
    },
    {
      id: "atlas.k2.regions.stretch",
      title: "Where do we live?",
      skillId: "ncge.k2.S3.1",
      type: "voice",
      prompt: "Tell me the name of the city or town where you live.",
      expectedAnswer: "",
      difficulty: "stretch",
    },
  ],
};
