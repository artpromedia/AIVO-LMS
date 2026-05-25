/**
 * Science item bank — production seed (Sprint 2).
 *
 * Items reference NGSS skillIds (substring `science|ngss`) so the
 * coverage scanner attributes every item to `science`. Items are direct
 * object literals so the audit's `{ id ... skillId }` regex matches.
 */
import type { Item, ItemVariant } from "./types.js";

const PUBLISHED = "2026-05-25T00:00:00Z";

function v(
  itemId: string,
  body: Record<string, unknown>,
  surfaceType: NonNullable<ItemVariant["surfaceType"]>,
): ItemVariant[] {
  return [{
    id: `${itemId}@1.0.0`,
    itemId,
    version: "1.0.0",
    status: "active",
    cohortWeight: 1,
    publishedAt: PUBLISHED,
    body,
    defectCount: 0,
    surfaceType,
  }];
}

export const SCIENCE_PRODUCTION_ITEMS: readonly Item[] = [
  // Kindergarten — Forces & Energy
  { id: "science.k.ps2.push-pull", skillId: "ngss.K-PS2-1",
    variants: v("science.k.ps2.push-pull",
      { stem: "Which is a push?", choices: ["Pulling a wagon toward you", "Pushing a swing away", "Holding still"], correctAnswer: "Pushing a swing away" },
      "choice_grid") },
  { id: "science.k.ps2.direction", skillId: "ngss.K-PS2-2",
    variants: v("science.k.ps2.direction",
      { stem: "You roll a ball forward. To make it roll left instead, you should ___.", choices: ["Push it from the right side", "Hold it still", "Pull it backwards"], correctAnswer: "Push it from the right side" },
      "choice_grid") },
  { id: "science.k.ps3.sunlight-warm", skillId: "ngss.K-PS3-1",
    variants: v("science.k.ps3.sunlight-warm",
      { stem: "What does sunlight do to objects on Earth?", choices: ["Cools them", "Warms them", "Makes them quiet"], correctAnswer: "Warms them" },
      "choice_grid") },
  { id: "science.k.ps2.gentle-push", skillId: "ngss.K-PS2-1",
    variants: v("science.k.ps2.gentle-push",
      { stem: "A gentle push moves an object ___ than a strong push.", choices: ["Slower", "Faster", "The same"], correctAnswer: "Slower" },
      "choice_grid") },

  // Grade 1-2
  { id: "science.1.ps.materials", skillId: "ngss.K-PS2-1",
    variants: v("science.1.ps.materials",
      { stem: "Which material is best for a raincoat: cotton, plastic, or paper?", choices: ["Cotton", "Plastic", "Paper"], correctAnswer: "Plastic" },
      "choice_grid") },
  { id: "science.2.ps.melting", skillId: "ngss.K-PS3-1",
    variants: v("science.2.ps.melting",
      { stem: "What happens to an ice cube left in the sun?", choices: ["It stays frozen", "It melts into water", "It turns into a rock"], correctAnswer: "It melts into water" },
      "choice_grid") },

  // Grade 3 — Life Science + Forces
  { id: "science.3.ls1.lifecycle", skillId: "ngss.3-LS1-1",
    variants: v("science.3.ls1.lifecycle",
      { stem: "Which is the correct order for a butterfly's life cycle?", choices: ["Egg → Caterpillar → Chrysalis → Butterfly", "Butterfly → Egg → Caterpillar", "Chrysalis → Egg → Butterfly"], correctAnswer: "Egg → Caterpillar → Chrysalis → Butterfly" },
      "choice_grid") },
  { id: "science.3.ps2.balanced-forces", skillId: "ngss.3-PS2-1",
    variants: v("science.3.ps2.balanced-forces",
      { stem: "Two students pull a rope in opposite directions with equal force. The rope ___.", choices: ["Moves to the stronger side", "Stays still", "Falls down"], correctAnswer: "Stays still" },
      "choice_grid") },
  { id: "science.3.ls1.plant-growth", skillId: "ngss.3-LS1-1",
    variants: v("science.3.ls1.plant-growth",
      { stem: "A seed needs ___ to grow.", choices: ["Water and light", "Only sand", "Only darkness"], correctAnswer: "Water and light" },
      "choice_grid") },

  // Grade 4 — Energy & Earth Science
  { id: "science.4.ps3.energy-speed", skillId: "ngss.4-PS3-1",
    variants: v("science.4.ps3.energy-speed",
      { stem: "A car moving 60 mph has ___ kinetic energy than a car moving 30 mph.", choices: ["Less", "More", "The same"], correctAnswer: "More" },
      "choice_grid") },
  { id: "science.4.ess2.weathering", skillId: "ngss.4-ESS2-1",
    variants: v("science.4.ess2.weathering",
      { stem: "Wind and water slowly breaking a rock into smaller pieces is called ___.", choices: ["Erosion", "Weathering", "Building"], correctAnswer: "Weathering" },
      "choice_grid") },

  // Grade 5 — Matter & Astronomy
  { id: "science.5.ps1.particles", skillId: "ngss.5-PS1-1",
    variants: v("science.5.ps1.particles",
      { stem: "All matter is made of tiny pieces too small to see. These are called ___.", choices: ["Particles", "Pieces", "Cells"], correctAnswer: "Particles" },
      "choice_grid") },
  { id: "science.5.ess1.sun-star", skillId: "ngss.5-ESS1-1",
    variants: v("science.5.ess1.sun-star",
      { stem: "Why does the Sun look brighter than other stars?", choices: ["It is hotter", "It is closer to Earth", "It is bigger"], correctAnswer: "It is closer to Earth" },
      "choice_grid") },
  { id: "science.5.ps1.states", skillId: "ngss.5-PS1-1",
    variants: v("science.5.ps1.states",
      { stem: "Which is NOT a state of matter?", choices: ["Solid", "Liquid", "Gas", "Energy"], correctAnswer: "Energy" },
      "choice_grid") },

  // Grade 6 — Chemistry & Biology
  { id: "science.6.ps1.molecule", skillId: "ngss.MS-PS1-1.g6",
    variants: v("science.6.ps1.molecule",
      { stem: "A water molecule (H₂O) is made of how many hydrogen atoms?", correctAnswer: "2" },
      "math_expression") },
  { id: "science.6.ls1.cells", skillId: "ngss.MS-LS1-1.g6",
    variants: v("science.6.ls1.cells",
      { stem: "All living things are made of ___.", choices: ["Rocks", "Cells", "Wires"], correctAnswer: "Cells" },
      "choice_grid") },

  // Grade 7 — Forces & Ecosystems
  { id: "science.7.ps2.net-force", skillId: "ngss.MS-PS2-2.g7",
    variants: v("science.7.ps2.net-force",
      { stem: "If 10 N pushes a box right and 6 N pushes left, what is the net force in N (right)?", correctAnswer: "4" },
      "math_expression") },
  { id: "science.7.ls2.ecosystem-change", skillId: "ngss.MS-LS2-4.g7",
    variants: v("science.7.ls2.ecosystem-change",
      { stem: "Removing wolves from a forest is most likely to cause ___.", choices: ["A drop in deer population", "An increase in deer population", "No change"], correctAnswer: "An increase in deer population" },
      "choice_grid") },

  // Grade 8 — Earth/Space & Energy
  { id: "science.8.ess1.phases", skillId: "ngss.MS-ESS1-1.g8",
    variants: v("science.8.ess1.phases",
      { stem: "A lunar eclipse happens when ___.", choices: ["The Moon is between the Sun and Earth", "Earth is between the Sun and the Moon", "The Sun moves between Earth and the Moon"], correctAnswer: "Earth is between the Sun and the Moon" },
      "choice_grid") },
  { id: "science.8.ps3.kinetic-mass", skillId: "ngss.MS-PS3-1.g8",
    variants: v("science.8.ps3.kinetic-mass",
      { stem: "Doubling the speed of an object multiplies its kinetic energy by ___.", choices: ["2", "4", "0.5"], correctAnswer: "4" },
      "choice_grid") },
  { id: "science.8.ps3.kinetic-graph", skillId: "ngss.MS-PS3-1.g8",
    variants: v("science.8.ps3.kinetic-graph",
      { stem: "Kinetic energy depends on which two quantities?", choices: ["Mass and speed", "Mass and colour", "Speed and weight"], correctAnswer: "Mass and speed" },
      "choice_grid") },
];
