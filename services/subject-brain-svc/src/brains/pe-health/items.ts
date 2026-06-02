import type { Item } from "../../services/types.js";

export const PE_HEALTH_ITEMS: Item[] = [
  {
    id: "PE.LOCO.001",
    skillCode: "PE.MOTOR.LOCOMOTOR",
    difficulty: -1.5,
    surface: "choice_grid",
    prompt: "Which movement uses one foot, then the same foot, then the other foot?",
    options: ["Hop", "Skip", "Run", "Walk"],
  },
  {
    id: "PE.MANIP.001",
    skillCode: "PE.MOTOR.MANIPULATIVE",
    difficulty: -0.8,
    surface: "drag_manipulative",
    prompt:
      "Order the steps of an underhand throw: face the target, step forward, swing back, release low.",
    options: ["face the target", "step forward", "swing back", "release low"],
  },
  {
    id: "HEALTH.FOOD.001",
    skillCode: "HEALTH.NUTRITION.FOOD_GROUPS",
    difficulty: -1.0,
    surface: "choice_grid",
    prompt: "Apples, oranges, and bananas all belong to which group?",
    options: ["Fruits", "Vegetables", "Grains", "Dairy"],
  },
  {
    id: "HEALTH.HYGIENE.001",
    skillCode: "HEALTH.HYGIENE.HAND_WASH",
    difficulty: -1.0,
    surface: "drag_manipulative",
    prompt: "Order the hand-washing steps: wet, soap, scrub for 20s, rinse, dry.",
    options: ["wet", "soap", "scrub for 20s", "rinse", "dry"],
  },
];
