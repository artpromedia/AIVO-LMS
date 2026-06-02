import type { Item } from "../../services/types.js";

export const CREATIVE_ARTS_ITEMS: Item[] = [
  {
    id: "ARTS.VIS.LINE.001",
    skillCode: "ARTS.VIS.LINE_SHAPE",
    difficulty: -1.5,
    surface: "art_canvas",
    prompt: "Draw three different kinds of lines (straight, wavy, zig-zag).",
  },
  {
    id: "ARTS.VIS.COLOR.001",
    skillCode: "ARTS.VIS.COLOR",
    difficulty: -0.8,
    surface: "choice_grid",
    prompt: "Yellow + blue makes which color?",
    options: ["Green", "Orange", "Purple", "Brown"],
  },
  {
    id: "ARTS.WRITE.STORY.001",
    skillCode: "ARTS.WRITE.STORY_PARTS",
    difficulty: -0.5,
    surface: "scratchpad",
    prompt:
      "Write three sentences: one for the beginning, one for the middle, one for the end of a story about a lost puppy.",
  },
  {
    id: "ARTS.WRITE.DESCRIBE.001",
    skillCode: "ARTS.WRITE.DESCRIBE",
    difficulty: 0.3,
    surface: "scratchpad",
    prompt: "Describe a freshly baked cookie using three different senses.",
  },
];
