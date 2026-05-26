/**
 * Social-Emotional Learning (SEL) item bank — baseline fallback seed
 * (Sprint 3).
 *
 * Used by services/assessment-svc when ai-svc cannot generate a
 * baseline (LLM error, network timeout, schema validation failure).
 * The fallback path serves these curated items instead of returning
 * 502 to the parent UI.
 *
 * SEL items are anchored to CASEL competency strands; the substring
 * `sel|casel` makes the coverage scanner attribute every item to SEL.
 * Items use `choice_grid` exclusively so the baseline fallback can
 * present them as multiple-choice without further transformation.
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

export const SEL_PRODUCTION_ITEMS: readonly Item[] = [
  // K-2 — self-awareness, basic emotion ID
  { id: "sel.k.sa.1.name-emotion", skillId: "casel.sel.K.self-awareness.1",
    variants: v("sel.k.sa.1.name-emotion",
      { stem: "A child is smiling and clapping. What feeling are they showing?", choices: ["Happy", "Sad", "Angry", "Scared"], correctAnswer: "Happy" }) },
  { id: "sel.k.sa.2.face-sad", skillId: "casel.sel.K.self-awareness.2",
    variants: v("sel.k.sa.2.face-sad",
      { stem: "Tears are running down a child's face. What feeling are they showing?", choices: ["Happy", "Sad", "Excited"], correctAnswer: "Sad" }) },
  { id: "sel.1.sm.1.calm-down", skillId: "casel.sel.1.self-management.1",
    variants: v("sel.1.sm.1.calm-down",
      { stem: "You feel angry. Which is a good way to calm down?", choices: ["Take 3 deep breaths", "Yell loudly", "Hit a pillow hard"], correctAnswer: "Take 3 deep breaths" }) },
  { id: "sel.1.so.1.share-toy", skillId: "casel.sel.1.social-awareness.1",
    variants: v("sel.1.so.1.share-toy",
      { stem: "Your friend looks sad because they have no toy. What can you do?", choices: ["Share one of yours", "Walk away", "Take their snack"], correctAnswer: "Share one of yours" }) },
  { id: "sel.2.rs.1.greet", skillId: "casel.sel.2.relationship-skills.1",
    variants: v("sel.2.rs.1.greet",
      { stem: "What is a kind way to greet a classmate in the morning?", choices: ["Say 'Good morning'", "Ignore them", "Push past them"], correctAnswer: "Say 'Good morning'" }) },
  { id: "sel.2.rd.1.line-up", skillId: "casel.sel.2.responsible-decision.1",
    variants: v("sel.2.rd.1.line-up",
      { stem: "The teacher asks the class to line up. What should you do?", choices: ["Stay seated and read", "Stand and walk to the line", "Run to the door"], correctAnswer: "Stand and walk to the line" }) },

  // 3-5 — perspective taking, regulation strategies, conflict resolution
  { id: "sel.3.sa.1.body-feels", skillId: "casel.sel.3.self-awareness.1",
    variants: v("sel.3.sa.1.body-feels",
      { stem: "Your heart is pounding and your hands feel cold before a test. What feeling are these clues for?", choices: ["Nervous", "Bored", "Sleepy"], correctAnswer: "Nervous" }) },
  { id: "sel.3.sm.1.frustration", skillId: "casel.sel.3.self-management.1",
    variants: v("sel.3.sm.1.frustration",
      { stem: "A math problem is too hard. You feel frustrated. What helps most?", choices: ["Tear the paper up", "Ask for a hint", "Quit and refuse to work"], correctAnswer: "Ask for a hint" }) },
  { id: "sel.3.so.1.perspective", skillId: "casel.sel.3.social-awareness.1",
    variants: v("sel.3.so.1.perspective",
      { stem: "Sam said your idea was 'okay.' How might Sam have meant that?", choices: ["Different people can mean different things", "Sam definitely hates you", "Sam was being mean on purpose"], correctAnswer: "Different people can mean different things" }) },
  { id: "sel.4.rs.1.conflict", skillId: "casel.sel.4.relationship-skills.1",
    variants: v("sel.4.rs.1.conflict",
      { stem: "Two friends both want the last seat by the window. What is a fair solution?", choices: ["Take turns by day", "Whoever runs fastest gets it", "The bigger kid gets it"], correctAnswer: "Take turns by day" }) },
  { id: "sel.4.rd.1.peer-pressure", skillId: "casel.sel.4.responsible-decision.1",
    variants: v("sel.4.rd.1.peer-pressure",
      { stem: "Your friends want you to skip homework to play. What is the responsible choice?", choices: ["Skip — friends matter more", "Finish homework first, then play", "Lie to your parents"], correctAnswer: "Finish homework first, then play" }) },
  { id: "sel.5.sa.1.strengths", skillId: "casel.sel.5.self-awareness.1",
    variants: v("sel.5.sa.1.strengths",
      { stem: "Which is the best example of a strength you can name about yourself?", choices: ["'I work hard at writing'", "'I am the best in everything'", "'I am no good at anything'"], correctAnswer: "'I work hard at writing'" }) },
  { id: "sel.5.sm.1.delay", skillId: "casel.sel.5.self-management.1",
    variants: v("sel.5.sm.1.delay",
      { stem: "You really want a snack but dinner is in 10 minutes. The best choice is to:", choices: ["Wait — dinner is soon", "Eat the snack anyway", "Skip dinner"], correctAnswer: "Wait — dinner is soon" }) },
  { id: "sel.5.so.1.empathy", skillId: "casel.sel.5.social-awareness.1",
    variants: v("sel.5.so.1.empathy",
      { stem: "A new student sits alone at lunch. The most empathetic action is to:", choices: ["Invite them to sit with you", "Stare at them silently", "Whisper about them"], correctAnswer: "Invite them to sit with you" }) },

  // 6-8 — identity, advocacy, complex conflict
  { id: "sel.6.sa.1.values", skillId: "casel.sel.6.self-awareness.1",
    variants: v("sel.6.sa.1.values",
      { stem: "A 'value' is best described as:", choices: ["Something you believe is important", "How much money you have", "Your test score"], correctAnswer: "Something you believe is important" }) },
  { id: "sel.6.sm.1.stress", skillId: "casel.sel.6.self-management.1",
    variants: v("sel.6.sm.1.stress",
      { stem: "Which is a HEALTHY way to manage stress before a big game?", choices: ["Stretch and breathe slowly", "Skip sleep to practice", "Drink lots of coffee"], correctAnswer: "Stretch and breathe slowly" }) },
  { id: "sel.7.so.1.media", skillId: "casel.sel.7.social-awareness.1",
    variants: v("sel.7.so.1.media",
      { stem: "An online video shows kids fighting. The BEST response is to:", choices: ["Don't share it and tell a trusted adult", "Repost it to be funny", "Comment something mean"], correctAnswer: "Don't share it and tell a trusted adult" }) },
  { id: "sel.7.rs.1.boundaries", skillId: "casel.sel.7.relationship-skills.1",
    variants: v("sel.7.rs.1.boundaries",
      { stem: "A friend keeps texting you during family dinner. The kind, clear thing to say is:", choices: ["'I'll reply after dinner — I'm with my family.'", "Ignore them forever", "Block them with no warning"], correctAnswer: "'I'll reply after dinner — I'm with my family.'" }) },
  { id: "sel.8.rd.1.consequences", skillId: "casel.sel.8.responsible-decision.1",
    variants: v("sel.8.rd.1.consequences",
      { stem: "Before making a big decision, which question is MOST useful?", choices: ["'How will this affect others and my future?'", "'Will my friends laugh?'", "'Can I do it without getting caught?'"], correctAnswer: "'How will this affect others and my future?'" }) },
  { id: "sel.8.sa.1.growth", skillId: "casel.sel.8.self-awareness.1",
    variants: v("sel.8.sa.1.growth",
      { stem: "Which sentence shows a GROWTH mindset?", choices: ["'I can't do this yet — I'll keep practicing.'", "'I'm just not a math person.'", "'Only smart kids get this.'"], correctAnswer: "'I can't do this yet — I'll keep practicing.'" }) },
  { id: "sel.8.rs.2.assertive", skillId: "casel.sel.8.relationship-skills.2",
    variants: v("sel.8.rs.2.assertive",
      { stem: "A classmate took your notebook without asking. The ASSERTIVE response is:", choices: ["'Please give it back — that's mine.'", "Shove them", "Cry quietly and say nothing"], correctAnswer: "'Please give it back — that's mine.'" }) },
];
