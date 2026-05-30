/**
 * Weekly curriculum sync — live tutor-svc proxy mapping.
 *
 * Verifies the response-shape normalization (uppercase status/role from
 * tutor-svc → web-v2 lowercase enums) and the safe focus read. The token is
 * stubbed so `isLiveCurriculum()` is true and `fetch` is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TOKEN = "test-internal-service-token";

beforeEach(() => {
  vi.stubEnv("INTERNAL_SERVICE_TOKEN", TOKEN);
  vi.stubEnv("TUTOR_SVC_URL", "http://tutor-svc.test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function load() {
  // Re-import after env stubs so serverEnv picks them up.
  vi.resetModules();
  return import("@/lib/bff/tutor-curriculum");
}

describe("tutor-curriculum live proxy", () => {
  it("isLiveCurriculum reflects the token presence", async () => {
    const mod = await load();
    expect(mod.isLiveCurriculum()).toBe(true);
  });

  it("normalizes tutor-svc uppercase status/role on list", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          uploads: [
            {
              id: "cu_1",
              tenantId: "t_1",
              learnerId: "lrn_1",
              uploadedBy: "u_1",
              uploaderRole: "TEACHER",
              subject: "math",
              title: "Fractions",
              sourceType: "text",
              rawText: "",
              parsedFocus: { topics: ["Fractions"], keywords: ["numerator"] },
              weekStart: "2026-06-01T00:00:00.000Z",
              weekEnd: null,
              status: "ACTIVE",
              createdAt: "2026-06-01T00:00:00.000Z",
              updatedAt: "2026-06-01T00:00:00.000Z",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const mod = await load();
    const rows = await mod.tutorListCurriculum("lrn_1", { status: "active" });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("active");
    expect(rows[0].uploaderRole).toBe("teacher");
    expect(rows[0].parsedFocus.topics).toContain("Fractions");
    // Sent x-service-token + uppercased status filter.
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ "x-service-token": TOKEN });
    expect(fetchMock.mock.calls[0][0]).toContain("status=ACTIVE");
  });

  it("active focus returns null when tutor-svc has none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ focus: null }), { status: 200 })),
    );
    const mod = await load();
    expect(await mod.tutorActiveFocus("lrn_1", "math")).toBeNull();
  });

  it("safe focus read swallows tutor-svc errors and returns null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    const mod = await load();
    expect(await mod.tutorActiveFocusSafe("lrn_1", "math")).toBeNull();
  });

  it("assertLiveConfigured does not throw when token present", async () => {
    const mod = await load();
    expect(() => mod.assertLiveConfigured()).not.toThrow();
  });
});
