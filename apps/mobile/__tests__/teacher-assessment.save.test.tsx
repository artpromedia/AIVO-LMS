/**
 * Pinned contract: submitting the teacher classroom assessment MUST POST to
 * assessment-svc `/api/assessments/teacher` with the projected payload (system
 * of record), only resolve when the server confirms a persisted row (no silent
 * success — parity with web-v2), and best-effort mirror a summary to family-svc
 * `/api/family/teacher-insights` for the brain-clone collaborator fold. A
 * failed mirror NEVER fails the submit (it is reported as `mirror: "deferred"`),
 * so the contribution is never silently lost.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

import { submitTeacherAssessment } from "../hooks/useTeacherAssessment";
import { toTeacherSubmitPayload } from "../lib/teacher/assessment-projection";

vi.mock("@/constants/api", () => ({
  API: { ASSESSMENT: "https://assessment.test", FAMILY: "https://family.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ANSWERS = {
  classroom_context: { cc_role: "special_ed", cc_grade: "3-5", cc_subject: ["reading", "math"] },
  academic_strengths: { as_strong_subjects: ["reading", "writing"], as_strengths_notes: "Strong oral reader." },
  support_strategies: {
    ss_working_now: ["visual_schedule"],
    ss_accommodations: ["extended_time", "preferential_seating"],
    ss_focus_areas: ["attention", "writing"],
  },
  final_notes: { fn_concerns: ["attention", "none"], fn_celebrate: "Loves helping peers." },
};

const INPUT = {
  learnerId: "learner-7",
  learnerName: "Maya",
  answers: ANSWERS,
};

describe("submitTeacherAssessment (teacher assessment save)", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("POSTs the projected payload to assessment-svc and mirrors to family-svc", async () => {
    apiFetchMock
      .mockResolvedValueOnce(
        jsonResponse({ assessment: { id: "ta-1", completedAt: "2026-06-16T00:00:00.000Z" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ insight: { id: "ti-1" } }));

    const result = await submitTeacherAssessment(INPUT);

    expect(apiFetchMock).toHaveBeenCalledTimes(2);

    const [aBase, aPath, aInit] = apiFetchMock.mock.calls[0];
    expect(aBase).toBe("https://assessment.test");
    expect(aPath).toBe("/api/assessments/teacher");
    expect(aInit.method).toBe("POST");
    expect(JSON.parse(aInit.body as string)).toEqual(
      toTeacherSubmitPayload(INPUT.learnerId, ANSWERS),
    );

    const [fBase, fPath, fInit] = apiFetchMock.mock.calls[1];
    expect(fBase).toBe("https://family.test");
    expect(fPath).toBe("/api/family/teacher-insights");
    expect(fInit.method).toBe("POST");
    const mirrorBody = JSON.parse(fInit.body as string);
    expect(mirrorBody.learnerId).toBe("learner-7");
    expect(typeof mirrorBody.insightText).toBe("string");
    expect(mirrorBody.insightText).toContain("Maya");

    expect(result.assessment.id).toBe("ta-1");
    expect(result.mirror).toBe("written");
  });

  it("accepts an optional-only contribution (narrative notes, no required answers)", async () => {
    // Mirrors the screen's submit gate: any answered field is submittable, even
    // when only optional free-text is provided (valid on web + backend).
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({ assessment: { id: "ta-opt", completedAt: null } }))
      .mockResolvedValueOnce(jsonResponse({ insight: { id: "ti-opt" } }));

    const optionalOnly = {
      learnerId: "learner-7",
      learnerName: "Maya",
      answers: { final_notes: { fn_celebrate: "Always kind to classmates." } },
    };
    const result = await submitTeacherAssessment(optionalOnly);

    const [, aPath] = apiFetchMock.mock.calls[0];
    expect(aPath).toBe("/api/assessments/teacher");
    expect(result.assessment.id).toBe("ta-opt");
  });

  it("treats a deferred family-svc mirror as success (never fails the submit)", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({ assessment: { id: "ta-2", completedAt: null } }))
      .mockResolvedValueOnce(jsonResponse({ message: "unavailable" }, 503));

    const result = await submitTeacherAssessment(INPUT);

    expect(result.assessment.id).toBe("ta-2");
    expect(result.mirror).toBe("deferred");
  });

  it("does not throw when the family-svc mirror rejects", async () => {
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({ assessment: { id: "ta-3", completedAt: null } }))
      .mockRejectedValueOnce(new Error("offline"));

    const result = await submitTeacherAssessment(INPUT);
    expect(result.mirror).toBe("deferred");
  });

  it("throws the upstream error message on a non-2xx assessment-svc response", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ message: "Forbidden" }, 403));
    await expect(submitTeacherAssessment(INPUT)).rejects.toThrow("Forbidden");
    // Must not attempt the family-svc mirror after a failed system-of-record write.
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("no silent success: a 2xx without a persisted id is a failed save", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ assessment: {} }, 200));
    await expect(submitTeacherAssessment(INPUT)).rejects.toThrow(/did not save/i);
  });

  it("never silently swallows assessment-svc network failures", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(submitTeacherAssessment(INPUT)).rejects.toThrow("offline");
  });
});

describe("toTeacherSubmitPayload (projection)", () => {
  it("maps option values to human-readable labels and filters 'none' concerns", () => {
    const payload = toTeacherSubmitPayload("learner-7", ANSWERS);
    expect(payload.learnerId).toBe("learner-7");
    expect(payload.teacherRole).toBe("Special Ed Teacher");
    expect(payload.gradeLevel).toBe("3-5");
    expect(payload.subjectArea).toBe("Reading / ELA");
    expect(payload.strengths).toEqual(["Reading", "Writing"]);
    // de-duped union of ss_accommodations + ss_working_now, by label
    expect(payload.accommodations).toEqual([
      "Extended time",
      "Preferential seating",
      "Visual schedule",
    ]);
    expect(payload.recommendedFocusAreas).toEqual(["Attention", "Writing"]);
    // "none" filtered out of challenges
    expect(payload.challenges).toEqual(["Attention"]);
    // free-text observations joined
    expect(payload.observations).toContain("Loves helping peers.");
    expect(payload.observations).toContain("Strong oral reader.");
    // full structured answers preserved
    expect(payload.additionalResponses.sections).toEqual(ANSWERS);
  });

  it("returns only learnerId-safe defaults for an empty draft", () => {
    const payload = toTeacherSubmitPayload("learner-9", {});
    expect(payload.learnerId).toBe("learner-9");
    expect(payload.teacherRole).toBeUndefined();
    expect(payload.strengths).toEqual([]);
    expect(payload.challenges).toEqual([]);
    expect(payload.accommodations).toEqual([]);
    expect(payload.recommendedFocusAreas).toEqual([]);
  });
});
