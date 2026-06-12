/**
 * Remediation Sprint 04 — per-subject domain practice for the deterministic
 * generator.
 *
 * Every learner subject now teaches on a domain-appropriate interactive
 * surface instead of the one generic choice/text box: coding writes real
 * code in the sandbox, music taps a rhythm grid, speech and world languages
 * speak into the mic, art draws, life skills and engineering work a
 * multi-step process, SEL and PE sort real scenarios, history and writing
 * highlight evidence in a passage, geography labels a map. Items are built
 * WITH their surface (and, for scored surfaces, the expectedAnswer the
 * surface's serialization produces) so an item can never disagree with how
 * it is answered.
 *
 * This module is the deterministic fallback content layer; authored content
 * packs (Sprint 05) take priority over it when they exist for the learner's
 * subject + grade band.
 */
import type { GeneratedLessonPlanInput } from "@/lib/validators/lesson";
import {
  buildArtCanvasSurface,
  buildCodingSandboxSurface,
  buildDragSortSurface,
  buildMultiStepSurface,
  buildMusicSequencerSurface,
  buildReadingAnnotationSurface,
  buildScienceDiagramSurface,
  buildVoiceResponseSurface,
} from "./surface-selection";

type GuidedItems = GeneratedLessonPlanInput["guidedPractice"];
type Tier = "starter" | "core" | "stretch";

function codingPractice(skillName: string, tier: Tier): GuidedItems {
  const starter = tier === "starter";
  const sandbox = buildCodingSandboxSurface({
    language: "javascript",
    starterCode: starter
      ? '// Make the program say hello\nconsole.log("");\n'
      : '// Print the numbers the loop counts\nfor (let i = 1; i <= 3; i += 1) {\n  // your code here\n}\n',
    tests: starter
      ? [{ name: "prints hello", kind: "stdout", expected: "hello" }]
      : [{ name: "prints 1 2 3", kind: "stdout", expected: "1\n2\n3" }],
    hint: starter ? 'Put hello between the quotes.' : "console.log(i) inside the loop.",
  });
  return [
    {
      prompt: starter
        ? "Fix the program so it prints hello, then run the tests."
        : "Make the loop print 1, 2, 3 — run the tests to check.",
      hint: starter ? "Look inside the quotes." : "The loop already counts for you.",
      scaffold: "Run the tests as many times as you like — every try teaches you something.",
      skillId: "",
      surface: sandbox,
    },
    {
      prompt: `Which comes FIRST when we ${skillName.toLowerCase()}?`,
      choices: ["Plan the steps", "Run the program", "Delete everything"],
      expectedAnswer: "Plan the steps",
      hint: "Programmers think before they type.",
      scaffold: "A plan is a list of steps in order.",
      skillId: "",
    },
  ];
}

function musicPractice(_skillName: string, tier: Tier): GuidedItems {
  const steps = tier === "starter" ? 4 : 8;
  const pattern =
    tier === "starter" ? [[0, 1, 2, 3]] : [[0, 2, 4, 6]];
  const sequencer = buildMusicSequencerSurface({
    tracks: ["Clap"],
    steps,
    tempo: 90,
    expectedPattern: pattern,
  });
  return [
    {
      prompt:
        tier === "starter"
          ? "Tap a steady beat: fill EVERY box on the Clap row, then play it."
          : "Tap a steady half-time beat: fill every OTHER box starting with the first.",
      expectedAnswer: sequencer?.expectedAnswer,
      hint: tier === "starter" ? "Every box gets a clap." : "Clap, rest, clap, rest…",
      scaffold: "Press play to hear your pattern before you submit.",
      skillId: "",
      surface: sequencer?.surface,
    },
    {
      prompt: "Which word means how FAST the music goes?",
      choices: ["Tempo", "Color", "Rhyme"],
      expectedAnswer: "Tempo",
      hint: "It is measured in beats per minute.",
      scaffold: "A metronome sets it.",
      skillId: "",
    },
  ];
}

function speechPractice(skillName: string, language: string): GuidedItems {
  const word = language === "es-ES" ? "hola" : "ship";
  return [
    {
      prompt:
        language === "es-ES"
          ? "Which word is a Spanish greeting?"
          : `Which word starts with the same sound as "${word}"?`,
      choices: language === "es-ES" ? ["hola", "libro", "mesa"] : ["shoe", "tree", "cat"],
      expectedAnswer: language === "es-ES" ? "hola" : "shoe",
      hint: language === "es-ES" ? "You say it when you meet someone." : "Listen for the sh sound.",
      scaffold: "Say each word slowly out loud first.",
      skillId: "",
    },
    {
      prompt: `Now say it out loud: "${word}". Record yourself when you're ready.`,
      hint: "Take a breath, then speak clearly.",
      scaffold: `It's okay to record more than once — ${skillName} grows with practice.`,
      skillId: "",
      surface: buildVoiceResponseSurface({ language, targetText: word }),
    },
  ];
}

function artPractice(skillName: string): GuidedItems {
  return [
    {
      prompt: "Draw a big circle, then a small square inside it. Use any colors you like.",
      hint: "Slow lines are steadier than fast ones.",
      scaffold: "Start with the circle — one smooth motion.",
      skillId: "",
      surface: buildArtCanvasSurface({ showGuides: true }),
    },
    {
      prompt: `Which of these is a SHAPE you could use in ${skillName.toLowerCase()}?`,
      choices: ["Triangle", "Tuesday", "Twelve"],
      expectedAnswer: "Triangle",
      hint: "You can draw it with three lines.",
      scaffold: "Shapes are things you can trace.",
      skillId: "",
    },
  ];
}

function lifeSkillsPractice(skillName: string): GuidedItems {
  return [
    {
      prompt: "Work through your morning routine, one step at a time.",
      hint: "Picture your morning from the moment you wake up.",
      scaffold: "There are no wrong answers — write what YOU do.",
      skillId: "",
      surface: buildMultiStepSurface({
        steps: [
          { id: "wake", prompt: "What do you do first after waking up?" },
          { id: "ready", prompt: "What do you do to get ready?" },
          { id: "out", prompt: "What is the last thing before you head out?" },
        ],
      }),
    },
    {
      prompt: `When is a good time to practice ${skillName.toLowerCase()}?`,
      choices: ["At the same time every day", "Only when reminded", "Never"],
      expectedAnswer: "At the same time every day",
      hint: "Routines work best when they repeat.",
      scaffold: "Same time + same order = a habit.",
      skillId: "",
    },
  ];
}

function engineeringPractice(skillName: string): GuidedItems {
  return [
    {
      prompt: "Design something that solves a problem — work the engineering cycle.",
      hint: "Engineers always test before they finish.",
      scaffold: "Plan → build → test → improve.",
      skillId: "",
      surface: buildMultiStepSurface({
        steps: [
          { id: "problem", prompt: "What problem are you solving?" },
          { id: "plan", prompt: "What will you build, and from what?" },
          { id: "test", prompt: "How will you TEST that it works?" },
          { id: "improve", prompt: "What would you improve next time?" },
        ],
      }),
    },
    {
      prompt: `What should an engineer do when a ${skillName.toLowerCase()} test fails?`,
      choices: ["Use the result to improve the design", "Hide the result", "Give up"],
      expectedAnswer: "Use the result to improve the design",
      hint: "Failure is information.",
      scaffold: "Every test teaches you something about the design.",
      skillId: "",
    },
  ];
}

function selPractice(_skillName: string): GuidedItems {
  const sort = buildDragSortSurface({
    item: { id: "act", label: "Invite them to join your game" },
    targets: [
      { id: "kind", label: "Kind choice" },
      { id: "unkind", label: "Unkind choice" },
    ],
    correctTargetId: "kind",
  });
  return [
    {
      prompt: "A classmate is sitting alone at recess. Sort the action into the right box.",
      expectedAnswer: sort?.expectedAnswer,
      hint: "How would it make THEM feel?",
      scaffold: "Kind choices help someone feel included.",
      skillId: "",
      surface: sort?.surface,
    },
    {
      prompt: "Your friend looks sad. What is a kind FIRST step?",
      choices: ["Ask if they are okay", "Ignore them", "Laugh"],
      expectedAnswer: "Ask if they are okay",
      hint: "Checking in shows you care.",
      scaffold: "You can simply say: 'Are you okay?'",
      skillId: "",
    },
  ];
}

function peHealthPractice(_skillName: string): GuidedItems {
  const sort = buildDragSortSurface({
    item: { id: "act", label: "Warm up before running" },
    targets: [
      { id: "safe", label: "Safe habit" },
      { id: "unsafe", label: "Unsafe habit" },
    ],
    correctTargetId: "safe",
  });
  return [
    {
      prompt: "Sort the habit into the right box.",
      expectedAnswer: sort?.expectedAnswer,
      hint: "Muscles work better when they are ready.",
      scaffold: "Warming up prepares your muscles and joints.",
      skillId: "",
      surface: sort?.surface,
    },
    {
      prompt: "What should you do if a movement causes sharp pain?",
      choices: ["Stop and tell a trusted adult", "Push through it", "Hide it"],
      expectedAnswer: "Stop and tell a trusted adult",
      hint: "Pain is a signal.",
      scaffold: "Stopping keeps a small problem from becoming a big one.",
      skillId: "",
    },
  ];
}

function historyPractice(skillName: string): GuidedItems {
  const annotated = buildReadingAnnotationSurface({
    passage:
      "Long ago, most people in the town worked on farms. Then a railroad was built through the valley. The railroad brought new jobs, and the town grew quickly.",
    question: "What changed the town? Highlight the sentence that tells you.",
    evidenceSentence: "Then a railroad was built through the valley.",
  });
  return [
    {
      prompt: "What changed the town? Highlight the sentence that tells you.",
      expectedAnswer: annotated?.expectedAnswer,
      hint: "Look for something NEW being built.",
      scaffold: "Historians find evidence in the source itself.",
      skillId: "",
      surface: annotated?.surface,
    },
    {
      prompt: `Which of these is a PRIMARY source for ${skillName.toLowerCase()}?`,
      choices: ["A letter written at the time", "A movie made last year", "A guess"],
      expectedAnswer: "A letter written at the time",
      hint: "Primary means from the time itself.",
      scaffold: "Ask: was it created by someone who was there?",
      skillId: "",
    },
  ];
}

function geographyPractice(_skillName: string): GuidedItems {
  const map = buildScienceDiagramSurface({
    shapes: [
      { id: "sea", kind: "rectangle", x: 40, y: 40, width: 400, height: 240 },
      { id: "island", kind: "circle", cx: 240, cy: 160, r: 70 },
    ],
    target: { id: "blue-area", x: 100, y: 80, correctLabelId: "water" },
    labels: [
      { id: "water", text: "Water" },
      { id: "land", text: "Land" },
    ],
    width: 480,
    height: 320,
  });
  return [
    {
      prompt: "The circle is an island. Label the area AROUND it on the map.",
      expectedAnswer: map?.expectedAnswer,
      hint: "An island is land with water all around.",
      scaffold: "The area around an island is the sea.",
      skillId: "",
      surface: map?.surface,
    },
    {
      prompt: "Which tool shows where places are?",
      choices: ["A map", "A spoon", "A pillow"],
      expectedAnswer: "A map",
      hint: "You can fold it or open it on a screen.",
      scaffold: "Maps draw places from above.",
      skillId: "",
    },
  ];
}

function writingPractice(_skillName: string): GuidedItems {
  const annotated = buildReadingAnnotationSurface({
    passage:
      "Dogs make wonderful pets. They greet you at the door every single day. Taking care of one also teaches responsibility.",
    question: "Which sentence states the writer's OPINION? Highlight it.",
    evidenceSentence: "Dogs make wonderful pets.",
  });
  return [
    {
      prompt: "Which sentence states the writer's OPINION? Highlight it.",
      expectedAnswer: annotated?.expectedAnswer,
      hint: "An opinion says what someone thinks or feels.",
      scaffold: "The other sentences give reasons FOR the opinion.",
      skillId: "",
      surface: annotated?.surface,
    },
    {
      prompt: "Which word would make an opinion STRONGER?",
      choices: ["wonderful", "the", "seven"],
      expectedAnswer: "wonderful",
      hint: "Strong opinions use describing words.",
      scaffold: "Describing words tell how good or bad something is.",
      skillId: "",
    },
  ];
}

/**
 * Domain practice for one subject, or null when the subject has no domain
 * builder yet (the caller falls back to the generic exploration items).
 */
export function domainPractice(
  subjectSlug: string,
  skillName: string,
  tier: Tier,
): GuidedItems | null {
  switch (subjectSlug) {
    case "coding":
      return codingPractice(skillName, tier);
    case "music":
      return musicPractice(skillName, tier);
    case "speech":
      return speechPractice(skillName, "en-US");
    case "world-languages":
      return speechPractice(skillName, "es-ES");
    case "art":
      return artPractice(skillName);
    case "life":
    case "executive-function":
      return lifeSkillsPractice(skillName);
    case "engineering":
      return engineeringPractice(skillName);
    case "social":
      return selPractice(skillName);
    case "physical-education":
      return peHealthPractice(skillName);
    case "social-studies":
      return historyPractice(skillName);
    case "geography":
      return geographyPractice(skillName);
    case "writing":
      return writingPractice(skillName);
    default:
      return null;
  }
}
