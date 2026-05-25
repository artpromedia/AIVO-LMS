import type { Item } from "../../services/types.js";

export const LIFE_ITEMS: Item[] = [
  {
    id: "LIFE.SC.001",
    skillCode: "LIFE.SELF_CARE",
    difficulty: -1.5,
    surface: "drag_manipulative",
    prompt: "Put the steps of brushing teeth in order.",
    options: ["wet brush", "add paste", "brush all sides", "rinse"],
  },
  {
    id: "LIFE.SAFE.001",
    skillCode: "LIFE.SAFETY",
    difficulty: -1.0,
    surface: "choice_grid",
    prompt: "You smell smoke at home. What is the first thing to do?",
    options: ["Tell an adult", "Hide", "Open every window", "Wait and see"],
  },
  {
    id: "LIFE.MONEY.001",
    skillCode: "LIFE.MONEY",
    difficulty: -0.5,
    surface: "choice_grid",
    prompt: "Which coin is worth 25 cents?",
    options: ["Penny", "Nickel", "Dime", "Quarter"],
  },
  {
    id: "LIFE.HH.001",
    skillCode: "LIFE.HOUSEHOLD",
    difficulty: 0.0,
    surface: "drag_manipulative",
    prompt: "Put these laundry steps in order.",
    options: ["sort colors", "load machine", "add soap", "start cycle", "dry"],
  },
  {
    id: "LIFE.COMM.001",
    skillCode: "LIFE.COMMUNITY",
    difficulty: 0.5,
    surface: "choice_grid",
    prompt: "You are lost in a store. Whom should you ask for help?",
    options: ["A store worker (vest/badge)", "Any stranger", "Wait alone", "Run outside"],
  },
];
