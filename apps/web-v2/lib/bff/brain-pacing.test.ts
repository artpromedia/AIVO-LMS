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

  it("degrades to null when brain-svc errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
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
