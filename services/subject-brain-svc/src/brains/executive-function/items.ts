import type { Item } from "../../services/types.js";

export const EF_ITEMS: Item[] = [
  {
    id: "EF.WM.001",
    skillCode: "EF.WORKING_MEMORY",
    difficulty: -1.0,
    discrimination: 1.2,
    surface: "drag_manipulative",
    prompt: "Remember this order: square, circle, triangle. Now place them in that order.",
    options: ["square", "circle", "triangle"],
  },
  {
    id: "EF.WM.002",
    skillCode: "EF.WORKING_MEMORY",
    difficulty: 0.0,
    discrimination: 1.4,
    surface: "drag_manipulative",
    prompt: "Repeat this order: 3, 7, 1, 5, 9.",
    options: ["3", "7", "1", "5", "9"],
  },
  {
    id: "EF.IC.001",
    skillCode: "EF.INHIBITION",
    difficulty: -0.5,
    discrimination: 1.3,
    surface: "choice_grid",
    prompt: "Tap the color of the word — not the word itself: RED (printed in blue).",
    options: ["blue", "red", "green", "yellow"],
  },
  {
    id: "EF.FLEX.001",
    skillCode: "EF.FLEX",
    difficulty: 0.5,
    discrimination: 1.5,
    surface: "choice_grid",
    prompt: "Sort by color. Now switch — sort by shape instead.",
    options: ["red circle", "red square", "blue circle", "blue square"],
  },
  {
    id: "EF.PLAN.001",
    skillCode: "EF.PLAN",
    difficulty: 1.0,
    discrimination: 1.4,
    surface: "multi_step_workspace",
    prompt: "Plan the steps to pack a lunch: bread, jam, knife, bag.",
    options: ["get bread", "spread jam", "close sandwich", "put in bag"],
  },
];
