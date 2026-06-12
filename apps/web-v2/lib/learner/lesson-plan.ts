/**
 * Sprint 11: deterministic lesson plan generator. Acts as both the local mock
 * AI provider AND the deterministic fallback when a real AI provider fails.
 * Pure function — given the same inputs, returns the same plan content.
 *
 * Inputs cover the brain profile, accommodation snapshot, mastery snapshot,
 * and subject/skill metadata so a different learner profile produces a
 * meaningfully different plan (different tutor greeting, scaffolding,
 * accessibility supports, story hook).
 */
import type {
  CurriculumFocus,
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  Skill,
  Subject,
} from "@/lib/db/types";
import type { GeneratedLessonPlanInput } from "@/lib/validators/lesson";
import { getSubjectBySlug, TUTORS } from "@aivo/brand";
import { pickMultimediaFixtureForSubject } from "./multimedia-item-bank";
import { domainPractice } from "./domain-practice";
import {
  buildGraphSurface,
  buildReadingAnnotationSurface,
  buildScienceDiagramSurface,
  withSelectedSurface,
} from "./surface-selection";

/**
 * Resolve the canonical brand tutor name for a subject. Sprint 2 (subject/tutor
 * UX) replaced the old hardcoded fictional personas ("Nimbus", "Zara", …) with
 * the real catalog tutors (Sage, Nova, Spark, …) keyed off the subject's
 * `tutorKey`, so the lesson copy matches the rest of the platform.
 */
export function tutorNameForSubject(slug: string): string {
  const tutorKey = getSubjectBySlug(slug)?.tutorKey;
  return tutorKey ? TUTORS[tutorKey].name : TUTORS.nova.name;
}

const TUTOR_GREETING_BY_STYLE: Record<
  LearnerBrainProfileState["tutorPersonaRecommendation"]["style"],
  (name: string) => string
> = {
  warm_coach: (n) => `Hi ${n}! I'm so glad you're here. Let's go at your pace.`,
  playful_friend: (n) => `Hey ${n}! Ready for something fun? I am!`,
  calm_guide: (n) => `Welcome, ${n}. Take a slow breath. We'll start small.`,
  structured_mentor: (n) => `Hello ${n}. Here's our plan: warm-up, try, check, win.`,
};

function modalityScaffold(modalities: LearnerBrainProfileState["preferredModalities"]): string {
  if (modalities.includes("visual")) return "I'll show pictures as we go.";
  if (modalities.includes("auditory")) return "I'll read each step out loud.";
  if (modalities.includes("kinesthetic")) return "We'll use small actions you can do at your desk.";
  return "I'll explain each step clearly before you try.";
}

function accommodationSupportLines(acc: LessonAccommodationSnapshot): string[] {
  const out: string[] = [];
  if (acc.supportDefaults.extendedTime) out.push("Take all the time you need.");
  if (acc.supportDefaults.readAloud) out.push("Each question can be read aloud.");
  if (acc.supportDefaults.speechToText) out.push("You can speak your answer if writing is tricky.");
  if (acc.supportDefaults.visualSchedules) out.push("A small checklist will show what's next.");
  if (acc.supportDefaults.sensoryBreaks) out.push("A quiet break is one tap away.");
  if (acc.accessibility.captionsAlwaysOn) out.push("Captions stay on.");
  if (acc.accessibility.largeText) out.push("Text is shown larger.");
  if (acc.accessibility.reducedMotion) out.push("Movement is kept gentle.");
  if (out.length === 0) out.push("Friendly hints are one tap away.");
  return out;
}

function difficultyTierForLevel(level: LessonMasterySnapshot["level"]): {
  difficulty: "starter" | "core" | "stretch";
  estimatedMinutes: number;
} {
  switch (level) {
    case "not_started":
    case "emerging":
      return { difficulty: "starter", estimatedMinutes: 8 };
    case "approaching":
      return { difficulty: "core", estimatedMinutes: 10 };
    case "on_grade_level":
      return { difficulty: "core", estimatedMinutes: 12 };
    case "stretching":
      return { difficulty: "stretch", estimatedMinutes: 14 };
  }
}

// Sprint 03: every reading tier carries a real passage item answered ON the
// reading-annotation surface (highlight the evidence sentence). The builder
// returns the surface AND the expectedAnswer (the evidence span id the
// surface submits) together, so the item can never disagree with its
// surface. A second choice/text item keeps variety per tier.
function readingPractice(
  skillName: string,
  tier: "starter" | "core" | "stretch",
): GeneratedLessonPlanInput["guidedPractice"] {
  if (tier === "starter") {
    const annotated = buildReadingAnnotationSurface({
      passage:
        "Bee is busy today. Bee lives in a hive with her family. She flies home before the rain.",
      question: "Highlight the sentence that tells where Bee lives.",
      evidenceSentence: "Bee lives in a hive with her family.",
    });
    return [
      {
        prompt: "Highlight the sentence that tells where Bee lives.",
        expectedAnswer: annotated?.expectedAnswer,
        hint: "Look for the word 'lives'.",
        scaffold: "Read each sentence out loud. Which one talks about a home?",
        skillId: "",
        surface: annotated?.surface,
      },
      {
        prompt: 'Pick the word that rhymes with "cat".',
        choices: ["hat", "dog", "fish"],
        expectedAnswer: "hat",
        hint: "It ends in -at.",
        scaffold: "Say both words out loud. Do they sound alike at the end?",
        skillId: "",
      },
    ];
  }
  if (tier === "core") {
    const annotated = buildReadingAnnotationSurface({
      passage:
        "Pip the fox trotted down the quiet path. The sun was warm on his back. Pip stopped at the stream to take a long drink. Then he padded home before dark.",
      question: "Why did Pip stop? Highlight the sentence that tells you.",
      evidenceSentence: "Pip stopped at the stream to take a long drink.",
    });
    return [
      {
        prompt: "Why did Pip stop? Highlight the sentence that tells you.",
        expectedAnswer: annotated?.expectedAnswer,
        hint: "Foxes need water just like we do.",
        scaffold: "Re-read the line about the stream.",
        skillId: "",
        surface: annotated?.surface,
      },
      {
        prompt: `Pick the best title for our story about ${skillName}.`,
        choices: ["A Brave Walk", "Lunch Time", "Lost Mittens"],
        expectedAnswer: "A Brave Walk",
        hint: "Think about how the fox felt.",
        scaffold: "A good title tells what the story is mostly about.",
        skillId: "",
      },
    ];
  }
  const annotated = buildReadingAnnotationSurface({
    passage:
      "The fox reached the bend in the path. He paused, ears turning toward a sound only he could hear. After a long moment he chose the darker trail.",
    question: "Which sentence shows the fox was uncertain? Highlight it.",
    evidenceSentence: "He paused, ears turning toward a sound only he could hear.",
  });
  return [
    {
      prompt: "Which sentence shows the fox was uncertain? Highlight it.",
      expectedAnswer: annotated?.expectedAnswer,
      hint: "Pausing can mean thinking, not just resting.",
      scaffold: "Look for the sentence where the fox stops moving.",
      skillId: "",
      surface: annotated?.surface,
    },
  ];
}

// Sprint 03: science practice replaces the generic builder — a real
// diagram-labelling item (single target keeps scoring order-stable) plus a
// coordinate-grid plotting item, mixed by tier.
function sciencePractice(
  skillName: string,
  tier: "starter" | "core" | "stretch",
): GeneratedLessonPlanInput["guidedPractice"] {
  const plantDiagram = buildScienceDiagramSurface({
    shapes: [
      { id: "stem", kind: "rectangle", x: 230, y: 110, width: 20, height: 120 },
      { id: "leaf", kind: "circle", cx: 290, cy: 140, r: 26 },
      { id: "roots", kind: "segment", start: { x: 240, y: 230 }, end: { x: 200, y: 290 } },
      { id: "roots2", kind: "segment", start: { x: 240, y: 230 }, end: { x: 280, y: 290 } },
    ],
    target: { id: "below-soil", x: 240, y: 280, correctLabelId: "roots" },
    labels: [
      { id: "roots", text: "Roots" },
      { id: "leaf", text: "Leaf" },
      { id: "stem", text: "Stem" },
    ],
  });
  const diagramItem = {
    prompt: "Which plant part grows below the soil? Place its label on the diagram.",
    expectedAnswer: plantDiagram?.expectedAnswer,
    hint: "It drinks water from the ground.",
    scaffold: "Roots hold the plant in the soil and pull up water.",
    skillId: "",
    surface: plantDiagram?.surface,
  };
  const plotted = buildGraphSurface({ point: { x: 2, y: 3 }, xMax: 6, yMax: 6 });
  const graphItem = {
    prompt: "We measured 3 cm of growth on day 2. Plot that point: day 2, height 3.",
    expectedAnswer: plotted?.expectedAnswer,
    hint: "Go right to 2, then up to 3.",
    scaffold: "The first number is across (days); the second is up (cm).",
    skillId: "",
    surface: plotted?.surface,
  };
  const observeItem = {
    prompt: `Tell me one thing you observed about ${skillName}.`,
    expectedAnswer: "any thoughtful response",
    hint: "Observing means using your senses.",
    scaffold: "Start with 'I noticed that…' and add one detail.",
    skillId: "",
  };
  if (tier === "starter") return [diagramItem, observeItem];
  if (tier === "core") return [diagramItem, graphItem];
  return [graphItem];
}

function mathPractice(
  skillName: string,
  tier: "starter" | "core" | "stretch",
): GeneratedLessonPlanInput["guidedPractice"] {
  if (tier === "starter") {
    return [
      {
        prompt: "What is 2 + 3?",
        choices: ["4", "5", "6"],
        expectedAnswer: "5",
        hint: "Count up from 2.",
        scaffold: "Hold up two fingers, then three more. How many in all?",
        skillId: "",
      },
      {
        prompt: "Which number comes next: 4, 5, 6, __?",
        choices: ["7", "8", "9"],
        expectedAnswer: "7",
        hint: "Count by ones.",
        scaffold: "Each number is one more than the one before.",
        skillId: "",
      },
    ];
  }
  if (tier === "core") {
    return [
      {
        prompt: "What is 14 + 7?",
        expectedAnswer: "21",
        hint: "Make a ten first.",
        scaffold: "Break 7 into 6 + 1. Then 14 + 6 = 20, plus 1 more.",
        skillId: "",
      },
      {
        prompt: "If you have 12 apples and give away 5, how many are left?",
        expectedAnswer: "7",
        hint: "Subtract 5 from 12.",
        scaffold: "Count back from 12: 11, 10, 9, 8, 7.",
        skillId: "",
      },
    ];
  }
  return [
    {
      prompt: `A box has 8 rows of 6 ${skillName}. How many in all?`,
      expectedAnswer: "48",
      hint: "Use a known fact: 8 × 6.",
      scaffold: "Think of 8 × 6 as (8 × 5) + 8 = 40 + 8.",
      skillId: "",
    },
  ];
}

function genericPractice(
  subjectName: string,
  skillName: string,
): GeneratedLessonPlanInput["guidedPractice"] {
  return [
    {
      prompt: `Tell me one thing you already know about ${skillName}.`,
      expectedAnswer: "any thoughtful response",
      hint: `Think about what we've seen in ${subjectName} so far.`,
      scaffold: "Start with 'I know that…' and add one detail.",
      skillId: "",
    },
    {
      prompt: `Show one example of ${skillName} in your own words.`,
      expectedAnswer: "any thoughtful response",
      hint: "An example can be small.",
      scaffold: `I'll go first, then you try.`,
      skillId: "",
    },
  ];
}

export type LessonPlanInputs = {
  learnerName: string;
  brainState: LearnerBrainProfileState;
  subject: Subject;
  skill: Skill;
  mastery: LessonMasterySnapshot;
  accommodations: LessonAccommodationSnapshot;
  /** Phase 1: active school-week curriculum to teach in sync with class. */
  curriculumFocus?: CurriculumFocus | null;
  source: string;
};

/**
 * Phase 1 helper: a short, learner-friendly phrase describing this week's
 * school topic, derived from an uploaded curriculum focus. Returns null when
 * there's nothing meaningful to anchor to.
 */
function schoolTopicPhrase(focus: CurriculumFocus | null | undefined): string | null {
  if (!focus) return null;
  const topic = (focus.topics ?? []).find((t) => t && t.trim().length > 0)?.trim();
  if (topic) return topic;
  if (focus.title && focus.title.trim().length > 0) return focus.title.trim();
  if (focus.summary && focus.summary.trim().length > 0) {
    return focus.summary.trim().split(/[.!?]/)[0];
  }
  return null;
}

export function generateDeterministicLessonPlan(input: LessonPlanInputs): GeneratedLessonPlanInput {
  const { learnerName, brainState, subject, skill, mastery, accommodations, curriculumFocus } =
    input;
  const schoolTopic = schoolTopicPhrase(curriculumFocus);
  const weekVocab = (curriculumFocus?.keywords ?? []).filter((k) => k && k.trim()).slice(0, 5);
  // Phase 4: a break-week focus is framed as "get ready for resumption" rather
  // than "what you're doing in class this week" (school is closed).
  // Wave D (G6): a summer-bridge focus is framed as NEXT-GRADE readiness —
  // the preview topics come from the next grade band's official catalogue
  // units, so the copy says "get ready for next grade", never "this week".
  const isSummerBridge = curriculumFocus?.mode === "summer_bridge";
  const isHolidayPrep = curriculumFocus?.mode === "holiday_prep";
  const bridgeLabel = isSummerBridge
    ? (curriculumFocus?.title ?? "").replace(/^Summer bridge:\s*/i, "") || "next grade"
    : null;
  const tutorPersona = tutorNameForSubject(subject.slug);
  const greeting =
    TUTOR_GREETING_BY_STYLE[brainState.tutorPersonaRecommendation.style](learnerName);
  const tier = difficultyTierForLevel(mastery.level);

  const supports = accommodationSupportLines(accommodations);
  const scaffoldLine = modalityScaffold(brainState.preferredModalities);

  let guidedRaw: GeneratedLessonPlanInput["guidedPractice"];
  if (subject.slug === "reading") {
    guidedRaw = readingPractice(skill.name, tier.difficulty);
  } else if (subject.slug === "math") {
    guidedRaw = mathPractice(skill.name, tier.difficulty);
  } else if (subject.slug === "science") {
    guidedRaw = sciencePractice(skill.name, tier.difficulty);
  } else {
    // Sprint 04: every remaining subject teaches on its domain surface
    // (coding sandbox, rhythm grid, voice, canvas, multi-step, drag sort,
    // annotation, map labelling) — generic exploration only when no domain
    // builder exists.
    guidedRaw =
      domainPractice(subject.slug, skill.name, tier.difficulty) ??
      genericPractice(subject.name, skill.name);
  }
  const guidedPractice = guidedRaw.map((g) => ({ ...g, skillId: skill.id }));
  const multimedia = pickMultimediaFixtureForSubject(subject.slug, `${skill.id}:${learnerName}`);
  if (multimedia && guidedPractice.length > 0) {
    // Sprint 03: overlay the first item WITHOUT an authored domain surface —
    // replacing an annotation/diagram item with a video question would lose
    // the domain interaction. When every item carries a surface, the
    // multimedia item is appended instead (schema allows up to 8).
    const overlayIndex = guidedPractice.findIndex((g) => !g.surface);
    const base = overlayIndex >= 0 ? guidedPractice[overlayIndex] : guidedPractice[0];
    const overlayItem = {
      ...base,
      prompt: multimedia.prompt,
      expectedAnswer: multimedia.expectedAnswer ?? base.expectedAnswer,
      choices: multimedia.choices?.length ? multimedia.choices : base.choices,
      hint: multimedia.hint ?? base.hint,
      scaffold: multimedia.scaffold ?? base.scaffold,
      // The overlay replaces the item's content, so any inherited surface
      // no longer matches — drop it and let withSelectedSurface re-derive
      // from the final answer space below.
      surface: undefined,
      media: {
        surfaceType: multimedia.surfaceType,
        assets: multimedia.assets.map((asset) =>
          asset.kind === "captions" ? { ...asset, src: multimedia.captionText } : asset,
        ),
      },
    };
    if (overlayIndex >= 0) {
      guidedPractice.splice(overlayIndex, 1, overlayItem);
    } else if (guidedPractice.length < 8) {
      guidedPractice.push(overlayItem);
    }
  }

  // Remediation Sprint 02: attach the domain surface AFTER the multimedia
  // overlay so derivation sees each item's FINAL answer space (the overlay
  // replaces the first item's prompt/answer/choices). The selector returns
  // undefined for items that cannot honestly carry a domain surface, which
  // keeps them on the generic choice/text surface.
  const guidedWithSurfaces = guidedPractice.map((g) => withSelectedSurface(g, subject.slug));

  const checksForUnderstanding: GeneratedLessonPlanInput["checksForUnderstanding"] = [
    {
      prompt: `In your own words, what did we learn about ${skill.name}?`,
      expectedAnswer: "any thoughtful summary",
      supportIfWrong:
        "No worries — try a single word that comes to mind first; we'll build from there.",
    },
    {
      prompt: `On a scale of 1–3, how sure do you feel about ${skill.name}?`,
      choices: ["1 — still tricky", "2 — getting it", "3 — I've got this"],
      expectedAnswer: "2 — getting it",
      supportIfWrong: "All answers are okay. We use it to pick what's next.",
    },
  ].map((c) => withSelectedSurface(c, subject.slug));

  const objective =
    tier.difficulty === "starter"
      ? `Get comfortable with ${skill.name} in small steps.`
      : tier.difficulty === "core"
        ? `Practice ${skill.name} with friendly questions.`
        : `Stretch a little on ${skill.name} — you're ready.`;

  const storyHook =
    subject.slug === "reading"
      ? `A small fox named Pip set off down a quiet path. Today, ${learnerName}, we'll travel with Pip and listen for words.`
      : subject.slug === "math"
        ? `Imagine you're filling a treasure chest. Each gem is a number. We'll count, add, and check together.`
        : `Today is a small adventure in ${subject.name}. We'll explore one idea at a time.`;

  const microLesson =
    `${scaffoldLine} The big idea today: ${skill.name}. ` +
    (isSummerBridge && schoolTopic
      ? `It's summer! We'll keep your skills warm and ${bridgeLabel ?? "get ready for next grade"} — starting with ${schoolTopic}. `
      : isHolidayPrep && schoolTopic
        ? `School is on a break, so we'll review what you learned and get a head start on what's coming up (${schoolTopic}). `
        : schoolTopic
          ? `This is the same thing you're working on in class this week (${schoolTopic}), so we'll practice it together. `
          : "") +
    (weekVocab.length > 0 ? `Words to listen for: ${weekVocab.join(", ")}. ` : "") +
    (tier.difficulty === "starter"
      ? `We'll go slow, with pictures and small steps.`
      : tier.difficulty === "core"
        ? `We'll try a few examples and check what feels solid.`
        : `We'll try a slightly harder version to stretch your thinking.`);

  // When we know the school topic, lead with an intro that connects AIVO's
  // lesson to what the learner is seeing in class, and theme the worked
  // example to that topic.
  const exampleExplanationBase =
    subject.slug === "math"
      ? `Watch how I solve it step by step — I'll narrate each move.`
      : `Watch how I read it and notice one important detail.`;

  return {
    title:
      isSummerBridge && schoolTopic
        ? `Summer bridge: ${bridgeLabel ?? "getting ready for next grade"}`
        : isHolidayPrep && schoolTopic
          ? `Holiday prep: getting ready for ${schoolTopic}`
          : schoolTopic
            ? `This week at school: ${schoolTopic}`
            : `${skill.name} with ${tutorPersona.split(" ")[0]}`,
    objective:
      isSummerBridge && schoolTopic
        ? `Keep skills strong over the summer and ${bridgeLabel ?? "get ready for next grade"} (${skill.name}).`
        : isHolidayPrep && schoolTopic
          ? `Stay sharp over the break and get ready for ${schoolTopic} (${skill.name}).`
          : schoolTopic
            ? `Stay in sync with class by practicing ${schoolTopic} (${skill.name}).`
            : objective,
    estimatedMinutes: tier.estimatedMinutes,
    tutorPersona,
    tutorGreeting: greeting,
    storyHook:
      isSummerBridge && schoolTopic
        ? `It's summer, ${learnerName}! Let's keep your skills warm and take a sneak peek at next grade: ${schoolTopic}.`
        : isHolidayPrep && schoolTopic
          ? `School's on a break, ${learnerName}. Let's keep your skills warm and peek at what's coming up: ${schoolTopic}.`
          : schoolTopic
            ? `Your class is exploring ${schoolTopic} this week. Let's look at it together, ${learnerName}, one small step at a time.`
            : storyHook,
    microLesson,
    example: {
      prompt:
        isSummerBridge && schoolTopic
          ? `Here's a sneak-peek example from next grade: ${schoolTopic}.`
          : isHolidayPrep && schoolTopic
            ? `Here's a warm-up example for ${schoolTopic}.`
            : schoolTopic
              ? `Here's a worked example of ${schoolTopic}, just like in class.`
              : `Here's a small example of ${skill.name}.`,
      explanation: exampleExplanationBase,
    },
    guidedPractice: guidedWithSurfaces,
    checksForUnderstanding,
    accessibilitySupports: supports,
    encouragement:
      mastery.score < 0.4
        ? `Showing up is the biggest step. I'm proud of you, ${learnerName}.`
        : mastery.score < 0.7
          ? `Nice momentum, ${learnerName}. You're building real skill.`
          : `Strong work, ${learnerName}. You're stretching beautifully.`,
    parentSummary:
      `${learnerName} practiced ${skill.name} in ${subject.name} at a ${tier.difficulty} level. ` +
      (isSummerBridge && schoolTopic
        ? `Summer-bridge lesson: reviewing this year's work and previewing next grade's ${schoolTopic}. `
        : isHolidayPrep && schoolTopic
          ? `Holiday-prep lesson: reviewing recent work and previewing ${schoolTopic} for school resumption. `
          : schoolTopic
            ? `This lesson was synced to this week's class topic (${schoolTopic}). `
            : "") +
      `Plan emphasizes ${brainState.preferredModalities[0] ?? "visual"} cues` +
      `${accommodations.tags.length > 0 ? `, with supports for ${accommodations.tags.slice(0, 3).join(", ")}.` : "."}`,
    nextRecommendedStep:
      mastery.score < 0.4
        ? `Practice ${skill.name} again tomorrow to build comfort.`
        : mastery.score < 0.7
          ? `Continue with the next skill in ${subject.name}.`
          : `Try a small challenge in ${subject.name}.`,
    // Phase 4: tag break-week lessons so the learner UI can badge them as
    // optional holiday-prep enrichment; class-aligned lessons as school_sync.
    lessonMode: isSummerBridge
      ? "summer_bridge"
      : isHolidayPrep
        ? "holiday_prep"
        : schoolTopic
          ? "school_sync"
          : undefined,
  };
}
