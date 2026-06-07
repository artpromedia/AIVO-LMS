import { test, expect } from "@playwright/test";

/**
 * Sprint 8 E2E — jurisdiction-correct curriculum (G3, promise #3).
 *
 * US/NG/AE/GB learners each resolve to their OWN framework; a recognised
 * but unseeded country (AU) returns an explicit gap — never US/CCSS.
 *
 * Hits curriculum-svc directly with the internal service token. Skips when
 * the service URL/token are not provided (e.g. unit-only CI).
 */
const CURRICULUM_SVC_URL = process.env.CURRICULUM_SVC_URL;
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token";

test.describe("intl curriculum resolution", () => {
  test.skip(!CURRICULUM_SVC_URL, "Requires CURRICULUM_SVC_URL");

  const headers = { "X-Service-Token": TOKEN };

  test("US / NG / AE / GB each resolve to their own framework", async ({ request }) => {
    const cases = [
      { params: "country=US&postalCode=55104", district: "mn-stpaul-public-schools", fw: "US-CCSS" },
      { params: "country=NG&region=Lagos", district: "ng-lagos-state", fw: "NG-NERDC" },
      { params: "country=AE&region=Dubai", district: "ae-dubai", fw: "UAE-MOE" },
      { params: "country=GB", district: "gb-england", fw: "UK-NC" },
    ];
    for (const c of cases) {
      const res = await request.get(
        `${CURRICULUM_SVC_URL}/api/curriculum/jurisdictions/resolve?${c.params}`,
        { headers },
      );
      expect(res.status(), c.params).toBe(200);
      const body = await res.json();
      expect(body.districtId).toBe(c.district);
      expect(body.frameworkCode).toBe(c.fw);
    }
  });

  test("an unseeded country shows a gap, never US content", async ({ request }) => {
    const res = await request.get(
      `${CURRICULUM_SVC_URL}/api/curriculum/jurisdictions/resolve?country=AU`,
      { headers },
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("CCSS");
    expect(JSON.stringify(body)).not.toContain("mn-stpaul");
  });

  test("NG lookup returns real NERDC skills", async ({ request }) => {
    const res = await request.get(
      `${CURRICULUM_SVC_URL}/api/curriculum/lookup?country=NG&region=Lagos&subject=math&gradeBand=Primary-3`,
      { headers },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.skills.map((s: { id: string }) => s.id)).toContain(
      "ng-nerdc.math.p3.number.whole-numbers",
    );
  });
});
