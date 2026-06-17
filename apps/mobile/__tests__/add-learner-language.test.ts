/**
 * Contract test for `buildLearnerCreateBody` — the pure payload builder behind
 * the parent "Add a learner" mobile flow.
 *
 * The mobile enrollment form must carry the chosen `preferredLanguage` to
 * identity-svc, which persists it into language_profiles — the record the AI
 * tutors read to deliver in the learner's language. It must also compose the
 * single `name` field identity-svc requires (it has no firstName/lastName).
 */
import { describe, expect, it, vi } from "vitest";

// Mock the api modules so importing the hook module does not pull in
// react-native (which vitest cannot transform). buildLearnerCreateBody is pure.
vi.mock("@/constants/api", () => ({ API: { IDENTITY: "https://identity.test" } }));
vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));

import { buildLearnerCreateBody } from "../hooks/useLearners";

const BASE = {
  firstName: "Ada",
  lastName: "Lovelace",
  gradeLevel: "3rd",
  pin: "1234",
  dateOfBirth: "2017-09-01",
};

describe("buildLearnerCreateBody", () => {
  it("composes the required `name` from first + last and keeps core fields", () => {
    const body = buildLearnerCreateBody(BASE);
    expect(body.name).toBe("Ada Lovelace");
    expect(body.gradeLevel).toBe("3rd");
    expect(body.pin).toBe("1234");
    expect(body.dateOfBirth).toBe("2017-09-01");
  });

  it("forwards a chosen preferredLanguage to identity-svc", () => {
    const body = buildLearnerCreateBody({ ...BASE, preferredLanguage: "Spanish" });
    expect(body.preferredLanguage).toBe("Spanish");
  });

  it("trims the language and accepts a raw locale code", () => {
    const body = buildLearnerCreateBody({ ...BASE, preferredLanguage: "  es  " });
    expect(body.preferredLanguage).toBe("es");
  });

  it("omits preferredLanguage when absent — never sends an empty profile", () => {
    expect("preferredLanguage" in buildLearnerCreateBody(BASE)).toBe(false);
  });

  it("omits preferredLanguage when blank/whitespace", () => {
    expect(
      "preferredLanguage" in buildLearnerCreateBody({ ...BASE, preferredLanguage: "   " }),
    ).toBe(false);
  });

  it("omits dateOfBirth when not provided", () => {
    const { dateOfBirth, ...noDob } = BASE;
    void dateOfBirth;
    expect("dateOfBirth" in buildLearnerCreateBody(noDob)).toBe(false);
  });

  it("trims surrounding whitespace when composing the name", () => {
    const body = buildLearnerCreateBody({ ...BASE, firstName: "  Ada ", lastName: " Lovelace " });
    expect(body.name).toBe("Ada Lovelace");
  });
});
