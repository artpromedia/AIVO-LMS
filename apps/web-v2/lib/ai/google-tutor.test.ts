import { describe, it, expect } from "vitest";
import { createGoogleTutorProvider } from "./google-tutor";
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
const subject = { id: "s1", slug: "reading", name: "Reading" } as Subject;
const skill = { id: "sk1", subjectId: "s1", name: "Phonics" } as Skill;
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
  title: "Phonics week",
  subject: "reading",
  weekStart: "2026-06-01",
  weekEnd: "2026-06-05",
  topics: ["Phonics"],
  keywords: ["sounds"],
  standards: [],
  skills: [],
  summary: "Letter sounds.",
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

/** Fake fetch returning a Gemini generateContent envelope. */
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

describe("GoogleTutorProvider", () => {
  it("posts systemInstruction + JSON mime and parses candidate text", async () => {
    const validPlan = (await MockTutorProvider.generate(INPUT)) as { title: string };
    let sentUrl = "";
    let sentInit: RequestInit | undefined;
    const provider = createGoogleTutorProvider({
      apiKey: "g-test",
      model: "gemini-2.0-flash",
      fetchImpl: fakeFetch(
        { candidates: [{ content: { parts: [{ text: JSON.stringify(validPlan) }] } }] },
        { capture: (u, i) => ((sentUrl = u), (sentInit = i)) },
      ),
    });

    const raw = (await provider.generate(INPUT, validPlan)) as { title: string };
    expect(raw.title).toEqual(validPlan.title);
    expect(provider.name).toBe("google");
    expect(provider.model).toBe("gemini-2.0-flash");

    expect(sentUrl).toContain("gemini-2.0-flash:generateContent");
    expect(sentUrl).toContain("key=g-test");
    const payload = JSON.parse(String(sentInit?.body));
    expect(payload.generationConfig.responseMimeType).toBe("application/json");
    expect(payload.systemInstruction.parts[0].text.length).toBeGreaterThan(0);
  });

  it("joins multi-part candidate text before parsing", async () => {
    const validPlan = (await MockTutorProvider.generate(INPUT)) as { title: string };
    const json = JSON.stringify(validPlan);
    const half = Math.floor(json.length / 2);
    const provider = createGoogleTutorProvider({
      apiKey: "g-test",
      fetchImpl: fakeFetch({
        candidates: [
          { content: { parts: [{ text: json.slice(0, half) }, { text: json.slice(half) }] } },
        ],
      }),
    });
    const raw = (await provider.generate(INPUT, validPlan)) as { title: string };
    expect(raw.title).toEqual(validPlan.title);
  });

  it("throws on a non-2xx response", async () => {
    const provider = createGoogleTutorProvider({
      apiKey: "g-test",
      fetchImpl: fakeFetch({ error: "bad key" }, { status: 400 }),
    });
    await expect(provider.generate(INPUT, {})).rejects.toThrow(/google-tutor: 400/);
  });

  it("throws when there is no candidate text", async () => {
    const provider = createGoogleTutorProvider({
      apiKey: "g-test",
      fetchImpl: fakeFetch({ candidates: [] }),
    });
    await expect(provider.generate(INPUT, {})).rejects.toThrow(/no candidate text/);
  });
});
