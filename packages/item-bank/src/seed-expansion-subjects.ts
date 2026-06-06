import type { Item, ItemVariant } from "./types.js";

const PUBLISHED = "2026-06-06T00:00:00Z";
const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;

type ExpansionSubject =
  | "creative_arts"
  | "social_studies"
  | "world_languages"
  | "coding"
  | "geography"
  | "music"
  | "pe_health"
  | "stem_engineering";

interface Question {
  stem: string;
  choices: readonly string[];
  correctAnswer: string;
  skill: string;
}

const QUESTION_BUILDERS: Record<ExpansionSubject, (index: number, grade: string) => Question> = {
  creative_arts: (index, grade) => {
    const prompts = [
      ["Which choice creates the strongest contrast?", ["Dark blue beside bright yellow", "Two similar grays", "Two identical shapes"], "Dark blue beside bright yellow", "contrast"],
      ["What should an artist do after receiving useful feedback?", ["Revise the work", "Ignore every comment", "Throw the work away"], "Revise the work", "revision"],
      ["Which part of an image usually appears closest to the viewer?", ["Foreground", "Background", "Border"], "Foreground", "composition"],
      ["Which choice best communicates a calm mood?", ["Soft colors and gentle lines", "Jagged lines and flashing colors", "Crowded overlapping text"], "Soft colors and gentle lines", "expression"],
      ["Why do artists make sketches before a final work?", ["To explore ideas", "To avoid making choices", "To copy without thinking"], "To explore ideas", "planning"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} art studio: ${stem}`, choices, correctAnswer, skill };
  },
  social_studies: (index, grade) => {
    const prompts = [
      ["Which source was created at the time an event happened?", ["A diary from that year", "A modern textbook", "A recent podcast"], "A diary from that year", "sources"],
      ["What is one responsibility of a community member?", ["Follow fair laws", "Ignore public safety", "Take public property"], "Follow fair laws", "civics"],
      ["Which list is in chronological order?", ["First, next, last", "Last, first, next", "Next, last, first"], "First, next, last", "chronology"],
      ["Why do communities create rules?", ["To support safety and fairness", "To make every choice identical", "To stop all discussion"], "To support safety and fairness", "governance"],
      ["What does scarcity mean?", ["There is not enough of something for every want", "Everything is free", "Nobody makes choices"], "There is not enough of something for every want", "economics"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} inquiry: ${stem}`, choices, correctAnswer, skill };
  },
  world_languages: (index, grade) => {
    const prompts = [
      ["Which Spanish word is a greeting?", ["hola", "agua", "libro"], "hola", "greetings"],
      ["Which Spanish word means water?", ["agua", "casa", "gracias"], "agua", "vocabulary"],
      ["What does gracias communicate?", ["Thanks", "Goodbye", "Please stop"], "Thanks", "courtesy"],
      ["Which phrase asks how someone is?", ["¿Cómo estás?", "Buenas noches.", "Me llamo Ana."], "¿Cómo estás?", "conversation"],
      ["Which word means book in Spanish?", ["libro", "mesa", "perro"], "libro", "interpretive"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} language practice: ${stem}`, choices, correctAnswer, skill };
  },
  coding: (index, grade) => {
    const prompts = [
      ["What is an algorithm?", ["A sequence of steps", "A computer screen", "A random guess"], "A sequence of steps", "algorithms"],
      ["What should you do first when a program gives the wrong result?", ["Inspect and test the steps", "Delete every file", "Repeat the same action forever"], "Inspect and test the steps", "debugging"],
      ["When is a loop useful?", ["When steps repeat", "When a task happens once", "When no steps are needed"], "When steps repeat", "loops"],
      ["What does a conditional do?", ["Chooses an action based on a condition", "Draws every screen", "Stores only pictures"], "Chooses an action based on a condition", "conditionals"],
      ["Why test a program with different inputs?", ["To find errors and edge cases", "To make the code longer", "To avoid understanding results"], "To find errors and edge cases", "testing"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} coding lab: ${stem}`, choices, correctAnswer, skill };
  },
  geography: (index, grade) => {
    const prompts = [
      ["What does a map key explain?", ["Symbols on the map", "The age of the map", "Who owns every road"], "Symbols on the map", "map-keys"],
      ["Which direction is opposite east?", ["West", "North", "South"], "West", "directions"],
      ["What does latitude measure?", ["Distance north or south of the equator", "Mountain height", "Population size"], "Distance north or south of the equator", "coordinates"],
      ["Why do regions have different climates?", ["Location and physical features affect weather patterns", "Every region chooses its weather", "Maps create weather"], "Location and physical features affect weather patterns", "climate"],
      ["What is a human feature on a map?", ["A city", "A river", "A mountain"], "A city", "human-geography"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} geography investigation: ${stem}`, choices, correctAnswer, skill };
  },
  music: (index, grade) => {
    const prompts = [
      ["What is a steady beat?", ["A regular pulse", "A random noise", "A song title"], "A regular pulse", "beat"],
      ["What does tempo describe?", ["How fast or slow music moves", "How music is spelled", "Where music is stored"], "How fast or slow music moves", "tempo"],
      ["What do dynamics describe?", ["Loudness and softness", "Song length only", "Instrument color"], "Loudness and softness", "dynamics"],
      ["Why rehearse a performance?", ["To improve accuracy and expression", "To avoid listening", "To remove every creative choice"], "To improve accuracy and expression", "performance"],
      ["What is a musical rest?", ["A planned silence", "A wrong note", "The end of all music"], "A planned silence", "rhythm"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} music studio: ${stem}`, choices, correctAnswer, skill };
  },
  pe_health: (index, grade) => {
    const prompts = [
      ["Why warm up before vigorous activity?", ["To prepare muscles and joints", "To become tired first", "To avoid drinking water"], "To prepare muscles and joints", "warmup"],
      ["What is a good hydration habit?", ["Drink water before, during, and after activity", "Wait until severe thirst", "Replace water with candy"], "Drink water before, during, and after activity", "hydration"],
      ["Which choice supports balance?", ["A stable base and controlled movement", "Closed eyes on an unsafe surface", "Holding your breath"], "A stable base and controlled movement", "balance"],
      ["Why does the body need recovery time?", ["To repair and adapt", "To lose every skill", "To avoid all future movement"], "To repair and adapt", "recovery"],
      ["What should you do if movement causes sharp pain?", ["Stop and tell a trusted adult", "Push through it", "Hide the pain"], "Stop and tell a trusted adult", "safety"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} health and movement: ${stem}`, choices, correctAnswer, skill };
  },
  stem_engineering: (index, grade) => {
    const prompts = [
      ["What is a design criterion?", ["A requirement for success", "A random decoration", "A reason not to test"], "A requirement for success", "criteria"],
      ["What is a constraint?", ["A limit such as time, cost, or materials", "The final celebration", "A guaranteed result"], "A limit such as time, cost, or materials", "constraints"],
      ["What makes a test fair?", ["Change one variable and keep others consistent", "Change everything at once", "Skip measurement"], "Change one variable and keep others consistent", "testing"],
      ["What should engineers do after a test fails?", ["Use evidence to improve the design", "Hide the result", "Repeat without changes"], "Use evidence to improve the design", "iteration"],
      ["Why compare multiple solutions?", ["To choose the best fit for the criteria and constraints", "To make every design identical", "To avoid collecting evidence"], "To choose the best fit for the criteria and constraints", "comparison"],
    ] as const;
    const [stem, choices, correctAnswer, skill] = prompts[index % prompts.length];
    return { stem: `Grade ${grade} engineering challenge: ${stem}`, choices, correctAnswer, skill };
  },
};

function makeItems(subject: ExpansionSubject): Item[] {
  return Array.from({ length: 20 }, (_, index) => {
    const grade = GRADES[index % GRADES.length];
    const question = QUESTION_BUILDERS[subject](index, grade);
    const id = `${subject}.${grade}.${question.skill}.${String(index + 1).padStart(2, "0")}`;
    const variant: ItemVariant = {
      id: `${id}@1.0.0`,
      itemId: id,
      version: "1.0.0",
      status: "active",
      cohortWeight: 1,
      publishedAt: PUBLISHED,
      body: {
        stem: question.stem,
        choices: [...question.choices],
        correctAnswer: question.correctAnswer,
      },
      defectCount: 0,
      surfaceType: "choice_grid",
    };
    return {
      id,
      skillId: `${subject}.${grade}.${question.skill}`,
      authoringMeta: { source: "AIVO K-12 catalog completion", reviewStatus: "engineering-authored" },
      variants: [variant],
    };
  });
}

export const CREATIVE_ARTS_PRODUCTION_ITEMS = makeItems("creative_arts");
export const SOCIAL_STUDIES_PRODUCTION_ITEMS = makeItems("social_studies");
export const WORLD_LANGUAGES_PRODUCTION_ITEMS = makeItems("world_languages");
export const CODING_PRODUCTION_ITEMS = makeItems("coding");
export const GEOGRAPHY_PRODUCTION_ITEMS = makeItems("geography");
export const MUSIC_PRODUCTION_ITEMS = makeItems("music");
export const PE_HEALTH_PRODUCTION_ITEMS = makeItems("pe_health");
export const STEM_ENGINEERING_PRODUCTION_ITEMS = makeItems("stem_engineering");
