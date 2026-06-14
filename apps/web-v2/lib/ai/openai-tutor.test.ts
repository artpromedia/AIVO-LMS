import { describe, it, expect } from "vitest";
import { createOpenAITutorProvider } from "./openai-tutor";
import { MockTutorProvider, type TutorGenerationInputs } from "./tutor";
import type {
  CurriculumFocus,
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  Skill,
  Subject,
} from "@/lib/db/types";

const brain = {
  preferredModalities: ["visual"],
  tutorPersonaRecommendation: { style: "warm_coach" },
} as unknown as LearnerBrainProfileState;
const subject = { id: "s1", slug: "math", name: "Math" } as Subject;
const skill = { id: "sk1", subjectId: "s1", name: "Counting" } as Skill;
const mastery = {
  skillId: "sk1",
  subjectId: "s1",
  score: 0.5,
  level: "approaching",
  confidence: 0.5,
  subjectContext: [],
} as LessonMasterySnapshot;
const accommodations = {
  tags: [],
  supportDefaults: {
    extendedTime: false,
    readAloud: false,
    speechToText: false,
    visualSchedules: false,
    sensoryBreaks: false,
  },
  accessibility: {} as LessonAccommodationSnapshot["accessibility"],
} as LessonAccommodationSnapshot;
const focus: CurriculumFocus = {
  title: "Counting week",
  subject: "math",
  weekStart: "2026-06-01",
  weekEnd: "2026-06-05",
  topics: ["Counting"],
  keywords: ["numbers"],
  standards: [],
  skills: [],
  summary: "Counting to ten.",
  confidence: 1,
};
const INPUT: TutorGenerationInputs = {
  learnerName: "Sam",
  brainState: brain,
  subject,
  skill,
  mastery,
  accommodations,
  curriculumFocus: focus,
  source: "today_mission",
};

/** Fake fetch returning an OpenAI chat-completions envelope. */
function fakeFetch(
  body: unknown,
  opts?: { status?: number; capture?: (url: string, init: RequestInit) => void },
): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    opts?.capture?.(url, init);
    return {
      ok: (opts?.status ?? 200) < 400,
      status: opts?.status ?? 200,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as typeof fetch;
}

describe("OpenAITutorProvider", () => {
  it("posts JSON mode + bearer auth and parses message content", async () => {
    const validPlan = (await MockTutorProvider.generate(INPUT)) as { title: string };
    let sentUrl = "";
    let sentInit: RequestInit | undefined;
    const provider = createOpenAITutorProvider({
      apiKey: "sk-test",
      model: "gpt-5.5",
      fetchImpl: fakeFetch(
        { choices: [{ message: { content: JSON.stringify(validPlan) } }] },
        { capture: (u, i) => ((sentUrl = u), (sentInit = i)) },
      ),
    });

    const raw = (await provider.generate(INPUT, validPlan)) as { title: string };
    expect(raw.title).toEqual(validPlan.title);
    expect(provider.name).toBe("openai");
    expect(provider.model).toBe("gpt-5.5");

    expect(sentUrl).toContain("api.openai.com");
    const payload = JSON.parse(String(sentInit?.body));
    expect(payload.model).toBe("gpt-5.5");
    expect(payload.response_format).toEqual({ type: "json_object" });
    const headers = sentInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-test");
  });

  it("tolerates a fenced JSON response", async () => {
    const validPlan = (await MockTutorProvider.generate(INPUT)) as { title: string };
    const fenced = "```json\n" + JSON.stringify(validPlan) + "\n```";
    const provider = createOpenAITutorProvider({
      apiKey: "sk-test",
      fetchImpl: fakeFetch({ choices: [{ message: { content: fenced } }] }),
    });
    const raw = (await provider.generate(INPUT, validPlan)) as { title: string };
    expect(raw.title).toEqual(validPlan.title);
  });

  it("throws on a non-2xx response", async () => {
    const provider = createOpenAITutorProvider({
      apiKey: "sk-test",
      fetchImpl: fakeFetch({ error: "rate limited" }, { status: 429 }),
    });
    await expect(provider.generate(INPUT, {})).rejects.toThrow(/openai-tutor: 429/);
  });

  it("throws when the response has no content", async () => {
    const provider = createOpenAITutorProvider({
      apiKey: "sk-test",
      fetchImpl: fakeFetch({ choices: [{ message: {} }] }),
    });
    await expect(provider.generate(INPUT, {})).rejects.toThrow(/no message content/);
  });
});
