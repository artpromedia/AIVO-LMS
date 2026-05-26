/**
 * Life Skills item bank — baseline fallback seed (Sprint 3).
 *
 * Curated multiple-choice items covering safety, daily routines, money,
 * hygiene, and self-care. Skill IDs use the `life-skills` prefix so the
 * coverage scanner attributes every item to life_skills.
 */
import type { Item, ItemVariant } from "./types.js";

const PUBLISHED = "2026-05-25T00:00:00Z";

function v(
  itemId: string,
  body: Record<string, unknown>,
  surfaceType: NonNullable<ItemVariant["surfaceType"]> = "choice_grid",
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

export const LIFE_SKILLS_PRODUCTION_ITEMS: readonly Item[] = [
  // K-2 — hygiene, basic safety, daily routines
  { id: "life-skills.k.hyg.1.wash-hands", skillId: "life-skills.K.hygiene.1",
    variants: v("life-skills.k.hyg.1.wash-hands",
      { stem: "When should you wash your hands?", choices: ["Before eating", "Only on Sundays", "Never"], correctAnswer: "Before eating" }) },
  { id: "life-skills.k.saf.1.cross-street", skillId: "life-skills.K.safety.1",
    variants: v("life-skills.k.saf.1.cross-street",
      { stem: "Before crossing the street, you should:", choices: ["Look both ways", "Close your eyes and run", "Look only up"], correctAnswer: "Look both ways" }) },
  { id: "life-skills.k.rou.1.brush-teeth", skillId: "life-skills.K.routine.1",
    variants: v("life-skills.k.rou.1.brush-teeth",
      { stem: "How often should you brush your teeth?", choices: ["Twice a day", "Once a month", "Never"], correctAnswer: "Twice a day" }) },
  { id: "life-skills.1.saf.1.stranger", skillId: "life-skills.1.safety.1",
    variants: v("life-skills.1.saf.1.stranger",
      { stem: "A grown-up you don't know asks you to get in their car. You should:", choices: ["Say no and find a trusted adult", "Get in the car", "Wave back and walk away alone"], correctAnswer: "Say no and find a trusted adult" }) },
  { id: "life-skills.1.hyg.1.cover-cough", skillId: "life-skills.1.hygiene.1",
    variants: v("life-skills.1.hyg.1.cover-cough",
      { stem: "When you cough, you should:", choices: ["Cover your mouth with your elbow", "Cough on your friend", "Hold it in"], correctAnswer: "Cover your mouth with your elbow" }) },
  { id: "life-skills.2.money.1.coins", skillId: "life-skills.2.money.1",
    variants: v("life-skills.2.money.1.coins",
      { stem: "How many cents is a quarter worth?", choices: ["25", "10", "5"], correctAnswer: "25" }) },
  { id: "life-skills.2.saf.1.fire", skillId: "life-skills.2.safety.1",
    variants: v("life-skills.2.saf.1.fire",
      { stem: "If your clothes catch fire, what should you do?", choices: ["Stop, drop, and roll", "Run as fast as you can", "Jump up and down"], correctAnswer: "Stop, drop, and roll" }) },

  // 3-5 — money, kitchen, time
  { id: "life-skills.3.money.1.change", skillId: "life-skills.3.money.1",
    variants: v("life-skills.3.money.1.change",
      { stem: "A snack costs $3. You pay with $5. How much change should you get?", choices: ["$2", "$3", "$8"], correctAnswer: "$2" }) },
  { id: "life-skills.3.kit.1.knife", skillId: "life-skills.3.kitchen.1",
    variants: v("life-skills.3.kit.1.knife",
      { stem: "When using a knife, you should:", choices: ["Cut away from your fingers", "Cut toward your hand", "Throw it across the room"], correctAnswer: "Cut away from your fingers" }) },
  { id: "life-skills.3.tim.1.am-pm", skillId: "life-skills.3.time.1",
    variants: v("life-skills.3.tim.1.am-pm",
      { stem: "Which time is in the morning?", choices: ["7:00 AM", "7:00 PM", "11:00 PM"], correctAnswer: "7:00 AM" }) },
  { id: "life-skills.4.money.1.budget", skillId: "life-skills.4.money.1",
    variants: v("life-skills.4.money.1.budget",
      { stem: "You have $20 and want to buy a $15 book and a $7 snack. Can you afford both?", choices: ["No, $22 is more than $20", "Yes", "Only if you skip the snack first"], correctAnswer: "No, $22 is more than $20" }) },
  { id: "life-skills.4.saf.1.911", skillId: "life-skills.4.safety.1",
    variants: v("life-skills.4.saf.1.911",
      { stem: "When should you call 911?", choices: ["A real emergency", "To talk to friends", "When you're bored"], correctAnswer: "A real emergency" }) },
  { id: "life-skills.5.kit.1.stove", skillId: "life-skills.5.kitchen.1",
    variants: v("life-skills.5.kit.1.stove",
      { stem: "Before walking away from a stove, you should:", choices: ["Turn it off", "Leave the burner on low", "Throw water on it"], correctAnswer: "Turn it off" }) },
  { id: "life-skills.5.rou.1.laundry", skillId: "life-skills.5.routine.1",
    variants: v("life-skills.5.rou.1.laundry",
      { stem: "Which clothes should NOT go in a hot dryer?", choices: ["Wool sweaters", "Cotton socks", "Jeans"], correctAnswer: "Wool sweaters" }) },

  // 6-8 — independence, decision making
  { id: "life-skills.6.money.1.tip", skillId: "life-skills.6.money.1",
    variants: v("life-skills.6.money.1.tip",
      { stem: "A meal costs $20. A 15% tip is closest to:", choices: ["$3", "$1", "$15"], correctAnswer: "$3" }) },
  { id: "life-skills.6.saf.1.medicine", skillId: "life-skills.6.safety.1",
    variants: v("life-skills.6.saf.1.medicine",
      { stem: "Before taking any medicine, you should:", choices: ["Read the label or ask an adult", "Take two to be safe", "Share it with friends"], correctAnswer: "Read the label or ask an adult" }) },
  { id: "life-skills.6.tim.1.plan", skillId: "life-skills.6.time.1",
    variants: v("life-skills.6.tim.1.plan",
      { stem: "School starts at 8:00. The bus takes 20 minutes. What time should you leave?", choices: ["7:40", "8:20", "7:55"], correctAnswer: "7:40" }) },
  { id: "life-skills.7.dig.1.password", skillId: "life-skills.7.digital.1",
    variants: v("life-skills.7.dig.1.password",
      { stem: "Which is the SAFEST password to use?", choices: ["A long mix of words and symbols", "Your birthday", "'password123'"], correctAnswer: "A long mix of words and symbols" }) },
  { id: "life-skills.7.dig.2.share", skillId: "life-skills.7.digital.2",
    variants: v("life-skills.7.dig.2.share",
      { stem: "Someone online you don't know asks for your home address. You should:", choices: ["Not share and tell a trusted adult", "Send it", "Send a fake one and keep chatting"], correctAnswer: "Not share and tell a trusted adult" }) },
  { id: "life-skills.7.money.1.savings", skillId: "life-skills.7.money.1",
    variants: v("life-skills.7.money.1.savings",
      { stem: "Saving money is most useful for:", choices: ["Bigger purchases or emergencies", "Looking rich", "Avoiding family talk"], correctAnswer: "Bigger purchases or emergencies" }) },
  { id: "life-skills.8.rou.1.appt", skillId: "life-skills.8.routine.1",
    variants: v("life-skills.8.rou.1.appt",
      { stem: "You have a 3:00 doctor appointment that takes 45 minutes. When will it end?", choices: ["3:45", "3:15", "4:30"], correctAnswer: "3:45" }) },
  { id: "life-skills.8.saf.1.address", skillId: "life-skills.8.safety.1",
    variants: v("life-skills.8.saf.1.address",
      { stem: "If you're lost in a city, the SAFEST thing to do is:", choices: ["Ask staff at a store", "Wander into alleys", "Follow any stranger"], correctAnswer: "Ask staff at a store" }) },
];
