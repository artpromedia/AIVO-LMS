import type { Item } from "../../services/types.js";

export const STEM_ITEMS: Item[] = [
  {
    id: "STEM.PROBLEM.001",
    skillCode: "STEM.ENG.PROBLEM",
    difficulty: -1.5,
    surface: "choice_grid",
    prompt:
      "Our paper boat keeps sinking. What problem are we trying to solve?",
    options: [
      "Build a boat that floats",
      "Make a faster car",
      "Draw a picture",
      "Pick a color",
    ],
  },
  {
    id: "STEM.IDEATE.001",
    skillCode: "STEM.ENG.IDEATE",
    difficulty: -1.0,
    surface: "art_canvas",
    prompt:
      "Sketch two different boats you could build with paper and tape.",
  },
  {
    id: "STEM.BUILD.001",
    skillCode: "STEM.ENG.BUILD_TEST",
    difficulty: -0.3,
    surface: "scratchpad",
    prompt:
      "List the steps to build and test the boat you picked. Then mark which step is the test.",
  },
  {
    id: "STEM.ITERATE.001",
    skillCode: "STEM.ENG.ITERATE",
    difficulty: 0.3,
    surface: "choice_grid",
    prompt:
      "Your boat tipped over when you added a coin. Which change is most likely to help?",
    options: [
      "Make the bottom wider",
      "Use thinner paper",
      "Make it taller",
      "Add more coins",
    ],
  },
];
