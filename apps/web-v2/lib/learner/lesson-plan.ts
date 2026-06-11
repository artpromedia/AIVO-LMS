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

function readingPractice(
  skillName: string,
  tier: "starter" | "core" | "stretch",
): GeneratedLessonPlanInput["guidedPractice"] {
  if (tier === "starter") {
    return [
      {
        prompt: "Which word means a small home for a bee?",
        choices: ["hive", "river", "tree"],
        expectedAnswer: "hive",
        hint: "Bees live there together.",
        scaffold: "Listen to each word. Picture the bee.",
        skillId: "",
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
    return [
      {
        prompt: `In the story, why did the fox stop at the stream?`,
        expectedAnswer: "to take a drink",
        hint: "Foxes need water just like we do.",
        scaffold: `Re-read the line about the fox and the stream.`,
        skillId: "",
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
  return [
    {
      prompt: "What does the author imply when the fox 'paused at the bend'?",
      expectedAnswer: "the fox was uncertain",
      hint: "Pausing can mean thinking, not just resting.",
      scaffold: "Look for clues in the sentences right before and after.",
      skillId: "",
    },
  ];
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
  } else {
    guidedRaw = genericPractice(subject.name, skill.name);
  }
  const guidedPractice = guidedRaw.map((g) => ({ ...g, skillId: skill.id }));
  const multimedia = pickMultimediaFixtureForSubject(subject.slug, `${skill.id}:${learnerName}`);
  if (multimedia && guidedPractice.length > 0) {
    const [first, ...rest] = guidedPractice;
    guidedPractice.splice(
      0,
      guidedPractice.length,
      {
        ...first,
        prompt: multimedia.prompt,
        expectedAnswer: multimedia.expectedAnswer ?? first.expectedAnswer,
        choices: multimedia.choices?.length ? multimedia.choices : first.choices,
        hint: multimedia.hint ?? first.hint,
        scaffold: multimedia.scaffold ?? first.scaffold,
        media: {
          surfaceType: multimedia.surfaceType,
          assets: multimedia.assets.map((asset) =>
            asset.kind === "captions" ? { ...asset, src: multimedia.captionText } : asset,
          ),
        },
      },
      ...rest,
    );
  }

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
  ];

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
    guidedPractice,
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
