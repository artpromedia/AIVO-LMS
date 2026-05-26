/**
 * Executive Function item bank — baseline fallback seed (Sprint 3).
 *
 * Items target planning, organization, working memory, flexible
 * thinking, impulse control, and task initiation. Skill IDs use the
 * `executive-function` prefix so the coverage scanner attributes every
 * item to executive_function.
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

export const EXECUTIVE_FUNCTION_PRODUCTION_ITEMS: readonly Item[] = [
  // K-2 — sequencing, following directions, basic working memory
  { id: "executive-function.k.seq.1.morning", skillId: "executive-function.K.sequencing.1",
    variants: v("executive-function.k.seq.1.morning",
      { stem: "What do you usually do FIRST in the morning at school?", choices: ["Hang up your coat", "Eat lunch", "Go to recess"], correctAnswer: "Hang up your coat" }) },
  { id: "executive-function.k.wm.1.repeat-2", skillId: "executive-function.K.working-memory.1",
    variants: v("executive-function.k.wm.1.repeat-2",
      { stem: "Listen: 'Get a pencil, then a book.' What is the SECOND thing to do?", choices: ["Get a book", "Get a pencil", "Get a snack"], correctAnswer: "Get a book" }) },
  { id: "executive-function.1.org.1.backpack", skillId: "executive-function.1.organization.1",
    variants: v("executive-function.1.org.1.backpack",
      { stem: "Where does your homework go after the teacher hands it back?", choices: ["In your folder", "Crumpled in your pocket", "On the floor"], correctAnswer: "In your folder" }) },
  { id: "executive-function.1.imp.1.raise-hand", skillId: "executive-function.1.impulse-control.1",
    variants: v("executive-function.1.imp.1.raise-hand",
      { stem: "You know the answer in class. What should you do?", choices: ["Raise your hand", "Shout it out", "Stand up and walk to the teacher"], correctAnswer: "Raise your hand" }) },
  { id: "executive-function.2.plan.1.assignment", skillId: "executive-function.2.planning.1",
    variants: v("executive-function.2.plan.1.assignment",
      { stem: "Before you start a worksheet, the BEST first step is to:", choices: ["Read the directions", "Color in the corners", "Write your name and stop"], correctAnswer: "Read the directions" }) },
  { id: "executive-function.2.flex.1.new-rule", skillId: "executive-function.2.flexibility.1",
    variants: v("executive-function.2.flex.1.new-rule",
      { stem: "The teacher changes the seating chart. What helps most?", choices: ["Try the new seat for a day", "Refuse to move", "Cry until they switch back"], correctAnswer: "Try the new seat for a day" }) },

  // 3-5 — multi-step planning, self-monitoring, task initiation
  { id: "executive-function.3.plan.1.book-report", skillId: "executive-function.3.planning.1",
    variants: v("executive-function.3.plan.1.book-report",
      { stem: "A book report is due in 2 weeks. The BEST first step is to:", choices: ["Pick a book and start reading", "Wait until the day before", "Watch a movie of the book only"], correctAnswer: "Pick a book and start reading" }) },
  { id: "executive-function.3.init.1.start", skillId: "executive-function.3.task-initiation.1",
    variants: v("executive-function.3.init.1.start",
      { stem: "Homework feels overwhelming. The best 'just start' strategy is:", choices: ["Do the easiest problem first", "Stare at the page", "Do all of math at once"], correctAnswer: "Do the easiest problem first" }) },
  { id: "executive-function.4.wm.1.directions", skillId: "executive-function.4.working-memory.1",
    variants: v("executive-function.4.wm.1.directions",
      { stem: "The teacher gives 4-step directions. To remember, you should:", choices: ["Write them down", "Trust your memory and start", "Ask later in the lesson"], correctAnswer: "Write them down" }) },
  { id: "executive-function.4.flex.1.plan-b", skillId: "executive-function.4.flexibility.1",
    variants: v("executive-function.4.flex.1.plan-b",
      { stem: "Recess is moved inside because of rain. A flexible response is to:", choices: ["Pick an indoor game with friends", "Argue with the teacher", "Sit and refuse to play"], correctAnswer: "Pick an indoor game with friends" }) },
  { id: "executive-function.5.org.1.binder", skillId: "executive-function.5.organization.1",
    variants: v("executive-function.5.org.1.binder",
      { stem: "Why use dividers in a binder?", choices: ["Find subjects quickly", "Make it heavier", "Hide your work"], correctAnswer: "Find subjects quickly" }) },
  { id: "executive-function.5.imp.1.test", skillId: "executive-function.5.impulse-control.1",
    variants: v("executive-function.5.imp.1.test",
      { stem: "During a test, you don't know an answer. The best move is:", choices: ["Skip it and come back", "Guess fast on everything", "Give up the whole test"], correctAnswer: "Skip it and come back" }) },
  { id: "executive-function.5.plan.1.project", skillId: "executive-function.5.planning.1",
    variants: v("executive-function.5.plan.1.project",
      { stem: "A 5-step project is due Friday. Which is the best plan?", choices: ["One step each day", "All 5 steps Thursday night", "Skip the last 2 steps"], correctAnswer: "One step each day" }) },

  // 6-8 — long-term planning, metacognition, prioritization
  { id: "executive-function.6.plan.1.calendar", skillId: "executive-function.6.planning.1",
    variants: v("executive-function.6.plan.1.calendar",
      { stem: "Why use a calendar or planner?", choices: ["Track due dates and events", "Decorate your locker", "Make homework heavier"], correctAnswer: "Track due dates and events" }) },
  { id: "executive-function.6.meta.1.check-work", skillId: "executive-function.6.metacognition.1",
    variants: v("executive-function.6.meta.1.check-work",
      { stem: "After finishing a worksheet, the BEST next step is to:", choices: ["Check your work", "Hand it in immediately", "Throw it out if it looks bad"], correctAnswer: "Check your work" }) },
  { id: "executive-function.7.flex.1.feedback", skillId: "executive-function.7.flexibility.1",
    variants: v("executive-function.7.flex.1.feedback",
      { stem: "A teacher says your essay needs revision. The growth response is:", choices: ["Read the feedback and revise", "Crumple it up", "Argue your draft is perfect"], correctAnswer: "Read the feedback and revise" }) },
  { id: "executive-function.7.org.1.priority", skillId: "executive-function.7.organization.1",
    variants: v("executive-function.7.org.1.priority",
      { stem: "You have a quiz tomorrow and a project due Friday. What should you work on tonight?", choices: ["Mostly study for the quiz", "Only the project", "Neither — watch TV"], correctAnswer: "Mostly study for the quiz" }) },
  { id: "executive-function.7.init.1.distract", skillId: "executive-function.7.task-initiation.1",
    variants: v("executive-function.7.init.1.distract",
      { stem: "Your phone keeps interrupting homework. The most effective fix is:", choices: ["Put it in another room", "Turn the volume up", "Reply to every notification"], correctAnswer: "Put it in another room" }) },
  { id: "executive-function.8.plan.1.long-term", skillId: "executive-function.8.planning.1",
    variants: v("executive-function.8.plan.1.long-term",
      { stem: "A research paper is due in 4 weeks. The healthiest plan is:", choices: ["Break it into weekly milestones", "Wait until week 4", "Do it all in one weekend"], correctAnswer: "Break it into weekly milestones" }) },
  { id: "executive-function.8.meta.1.know-when-stuck", skillId: "executive-function.8.metacognition.1",
    variants: v("executive-function.8.meta.1.know-when-stuck",
      { stem: "You've been stuck on one problem for 20 minutes. The smart move is:", choices: ["Move on and ask for help", "Stare for 20 more minutes", "Skip the whole assignment"], correctAnswer: "Move on and ask for help" }) },
  { id: "executive-function.8.imp.1.message", skillId: "executive-function.8.impulse-control.1",
    variants: v("executive-function.8.imp.1.message",
      { stem: "You're upset and want to send a mean text. The best impulse-control move is:", choices: ["Wait 10 minutes before sending", "Send it now and apologize later", "Send it and block them"], correctAnswer: "Wait 10 minutes before sending" }) },
];
