import type { Item } from "../../services/types.js";

export const CODING_ITEMS: Item[] = [
  {
    id: "CODE.SEQ.001",
    skillCode: "CODE.FOUND.SEQUENCING",
    difficulty: -1.5,
    surface: "drag_manipulative",
    prompt:
      "Order the steps a robot follows to draw a square: turn right, move forward, turn right, move forward, turn right, move forward, move forward.",
    options: [
      "move forward",
      "turn right",
      "move forward",
      "turn right",
      "move forward",
      "turn right",
      "move forward",
    ],
  },
  {
    id: "CODE.LOOP.001",
    skillCode: "CODE.FOUND.LOOPS",
    difficulty: -1.0,
    surface: "choice_grid",
    prompt: "Which is the shortest way to make the cat take 4 steps forward?",
    options: [
      "Repeat 4 times: move forward",
      "move forward, move forward, move forward, move forward",
      "Repeat 2 times: move forward",
      "move forward",
    ],
  },
  {
    id: "CODE.COND.001",
    skillCode: "CODE.FOUND.CONDITIONALS",
    difficulty: -0.5,
    surface: "choice_grid",
    prompt: "We want the robot to honk only when it sees a sign. Which block fits?",
    options: ["if sees-sign then honk", "always honk", "never honk", "repeat honk"],
  },
  {
    id: "CODE.DEBUG.001",
    skillCode: "CODE.FOUND.DEBUG",
    difficulty: 0.0,
    surface: "scratchpad",
    prompt:
      "The program is: move forward, move forward, turn left, move forward. It should turn right, not left. Fix it.",
    options: ["turn left", "turn right"],
  },
];
