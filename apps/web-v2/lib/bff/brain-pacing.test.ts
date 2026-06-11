/**
 * Phase 2b — brain-svc pacing → CurriculumFocus mapping.
 *
 * Verifies the instructional-week mapping, that break weeks do NOT sync, and
 * that the safe read degrades to null on error / when not configured.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TOKEN = "test-internal-service-token";

beforeEach(() => {
  vi.stubEnv("INTERNAL_SERVICE_TOKEN", TOKEN);
  vi.stubEnv("BRAIN_SVC_URL", "http://brain-svc.test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function load() {
  vi.resetModules();
  return import("@/lib/bff/brain-pacing");
}

const INSTRUCTION_WEEK = {
  weekIndex: 2,
  weekStart: "2026-09-07",
  weekEnd: "2026-09-13",
  kind: "instruction",
  termNumber: 1,
  unitTitle: "Multiplying fractions",
  topics: ["Multiply fractions", "Simplify"],
  standards: ["CCSS.MATH.5.NF.B.4"],
  objectives: ["Multiply a fraction by a fraction"],
  vocabulary: ["numerator", "denominator"],
  status: "active",
};

describe("weekToFocus", () => {
  it("maps an instructional week into a focus", async () => {
    const mod = await load();
    const focus = mod.weekToFocus(INSTRUCTION_WEEK, "math");
    expect(focus).not.toBeNull();
    expect(focus!.title).toBe("Multiplying fractions");
    expect(focus!.subject).toBe("math");
    expect(focus!.topics).toContain("Multiply fractions");
    expect(focus!.keywords).toContain("numerator");
    expect(focus!.standards).toContain("CCSS.MATH.5.NF.B.4");
    expect(focus!.skills).toContain("Multiply a fraction by a fraction");
    expect(focus!.weekStart).toBe("2026-09-07");
    expect(focus!.confidence).toBe(1);
  });

  it("does NOT sync a break week (holiday prep is a separate track)", async () => {
    const mod = await load();
    const brk = { ...INSTRUCTION_WEEK, kind: "break", unitTitle: "Fall break", topics: [] };
    expect(mod.weekToFocus(brk, "math")).toBeNull();
  });

  it("returns null for an empty/absent week", async () => {
    const mod = await load();
    expect(mod.weekToFocus(null, "math")).toBeNull();
  });
});

const HOLIDAY_PREP = {
  review_topics: ["Round to 100", "Round to 10"],
  review_standards: ["3.NBT.A.1"],
  review_vocabulary: ["round"],
  preview_topics: ["Add within 1000"],
  preview_standards: ["3.NBT.A.2"],
  preview_vocabulary: ["sum"],
  prior_unit_title: "Place value",
  next_unit_title: "Addition",
};
const BREAK_WEEK = {
  ...INSTRUCTION_WEEK,
  kind: "break",
  unitTitle: "Winter break",
  topics: [],
  standards: [],
  objectives: [],
  vocabulary: [],
};

describe("holidayPrepToFocus", () => {
  it("builds a review+preview focus tagged holiday_prep", async () => {
    const mod = await load();
    const focus = mod.holidayPrepToFocus(HOLIDAY_PREP, BREAK_WEEK, "math");
    expect(focus).not.toBeNull();
    expect(focus!.mode).toBe("holiday_prep");
    expect(focus!.title).toContain("Addition");
    // review topics come first, then preview.
    expect(focus!.topics).toEqual(["Round to 100", "Round to 10", "Add within 1000"]);
    expect(focus!.keywords).toEqual(["round", "sum"]);
    expect(focus!.standards).toEqual(["3.NBT.A.1", "3.NBT.A.2"]);
    expect(focus!.summary).toMatch(/break/i);
  });

  it("returns null when there's nothing to prep with", async () => {
    const mod = await load();
    expect(mod.holidayPrepToFocus(null, BREAK_WEEK, "math")).toBeNull();
    expect(
      mod.holidayPrepToFocus({ review_topics: [], preview_topics: [] }, BREAK_WEEK, "math"),
    ).toBeNull();
  });
});

describe("brainPacingFocusSafe", () => {
  it("reads the current instructional week from brain-svc", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ current: INSTRUCTION_WEEK }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const mod = await load();
    const focus = await mod.brainPacingFocusSafe("lrn_1", "math");
    expect(focus?.title).toBe("Multiplying fractions");
    // Sent x-service-token to the pacing/current endpoint.
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1].headers).toMatchObject({ "x-service-token": TOKEN });
    expect(call[0]).toContain("/api/brain/pacing/lrn_1/pacing/current");
    expect(call[0]).toContain("subject=math");
  });

  it("turns a break week into a holiday-prep focus from the holidayPrep payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ current: BREAK_WEEK, holidayPrep: HOLIDAY_PREP }), {
            status: 200,
          }),
      ),
    );
    const mod = await load();
    const focus = await mod.brainPacingFocusSafe("lrn_1", "math");
    expect(focus?.mode).toBe("holiday_prep");
    expect(focus?.topics).toContain("Add within 1000");
  });

  it("degrades to null when brain-svc errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    const mod = await load();
    expect(await mod.brainPacingFocusSafe("lrn_1", "math")).toBeNull();
  });

  it("returns null (no call) when the service token is unset", async () => {
    vi.stubEnv("INTERNAL_SERVICE_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const mod = await load();
    expect(mod.isPacingLive()).toBe(false);
    expect(await mod.brainPacingFocusSafe("lrn_1", "math")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("summerBridgeToFocus (Wave D, G6)", () => {
  const BRIDGE = {
    review_topics: ["Round to 100"],
    review_standards: ["3.NBT.A.1"],
    review_vocabulary: ["round"],
    preview_topics: ["Multi-digit place value", "Comparing large numbers"],
    preview_standards: ["CCSS.Math.Content.4.NBT.A.1"],
    preview_vocabulary: ["digit"],
    next_grade_band: "4",
    next_unit_title: "Grade 4 place value",
  };

  it("builds a next-grade readiness focus tagged summer_bridge", async () => {
    const mod = await load();
    const focus = mod.summerBridgeToFocus(BRIDGE, BREAK_WEEK, "math");
    expect(focus).not.toBeNull();
    expect(focus!.mode).toBe("summer_bridge");
    expect(focus!.title).toBe("Summer bridge: get ready for Grade 4");
    // Review first (closing grade warm-up), then the next-grade preview.
    expect(focus!.topics).toEqual([
      "Round to 100",
      "Multi-digit place value",
      "Comparing large numbers",
    ]);
    expect(focus!.standards).toEqual(["3.NBT.A.1", "CCSS.Math.Content.4.NBT.A.1"]);
    expect(focus!.summary).toMatch(/summer/i);
    expect(focus!.summary).toContain("Grade 4");
  });

  it("returns null without a next-grade preview (caller falls back to holiday prep)", async () => {
    const mod = await load();
    expect(mod.summerBridgeToFocus(null, BREAK_WEEK, "math")).toBeNull();
    expect(
      mod.summerBridgeToFocus(
        { ...BRIDGE, preview_topics: [] },
        BREAK_WEEK,
        "math",
      ),
    ).toBeNull();
  });

  it("wins over holidayPrep for an opted-in summer break in brainPacingFocusSafe", async () => {
    const mod = await load();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            current: BREAK_WEEK,
            holidayPrep: HOLIDAY_PREP,
            summerBridge: BRIDGE,
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch,
    );
    const focus = await mod.brainPacingFocusSafe("lrn-1", "math");
    expect(focus?.mode).toBe("summer_bridge");
  });
});
