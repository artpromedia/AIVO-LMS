import { describe, it, expect } from "vitest";
import {
  transformObservationsToSignals,
  type TransformInput,
} from "../services/observation-signal-transformer.js";
import { generateRecommendations } from "../services/recommendation-generator.js";
import { describeProvenance } from "../services/recommendation-evidence-builder.js";

describe("transformObservationsToSignals", () => {
  it("maps a teacher attention observation to a focus_drop signal with provenance", () => {
    const signals = transformObservationsToSignals({
      caregiverObservations: [
        { contributorRole: "teacher", category: "attention", notes: "Off task all morning." },
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0].metric).toBe("teacher_reports_focus_drop");
    expect(signals[0].source).toBe("teacher_observation");
    expect(signals[0].contributorRole).toBe("teacher");
    expect(signals[0].weight).toBe(0.8);
  });

  it("classifies concern from free-text notes when category is generic", () => {
    const signals = transformObservationsToSignals({
      caregiverObservations: [
        { contributorRole: "caregiver", category: "General", notes: "He got overwhelmed and loud." },
      ],
    });
    expect(signals[0].metric).toBe("caregiver_reports_sensory_overload");
    expect(signals[0].weight).toBe(0.6);
  });

  it("weights therapist higher than caregiver", () => {
    const signals = transformObservationsToSignals({
      caregiverObservations: [
        { contributorRole: "therapist", category: "sensory", notes: "Sensory overload." },
        { contributorRole: "caregiver", category: "sensory", notes: "Overwhelmed." },
      ],
    });
    const therapist = signals.find((s) => s.contributorRole === "therapist")!;
    const caregiver = signals.find((s) => s.contributorRole === "caregiver")!;
    expect(therapist.weight!).toBeGreaterThan(caregiver.weight!);
  });

  it("ingests brain insights by insightType", () => {
    const signals = transformObservationsToSignals({
      brainInsights: [{ contributorRole: "teacher", insightType: "sensory_overload" }],
    });
    expect(signals[0].metric).toBe("teacher_reports_sensory_overload");
  });

  it("skips observations whose concern cannot be classified", () => {
    const signals = transformObservationsToSignals({
      caregiverObservations: [
        { contributorRole: "teacher", category: "General", notes: "Had a nice lunch." },
      ],
    });
    expect(signals).toHaveLength(0);
  });
});

describe("observation signals -> parent-approval recommendations", () => {
  it("generates a PENDING recommendation citing the contributing sources", () => {
    const input: TransformInput = {
      caregiverObservations: [
        { contributorRole: "teacher", category: "sensory", notes: "Sensory overload in class." },
        { contributorRole: "caregiver", category: "sensory", notes: "Overwhelmed at home too." },
      ],
    };
    const signals = transformObservationsToSignals(input);
    const recs = generateRecommendations({
      learnerId: "learner-1",
      signals,
      currentProfile: {},
    });
    const sensory = recs.find((r) => r.type === "sensory_setting_change");
    expect(sensory).toBeDefined();
    // Parent approval is always required — teachers/caregivers only propose.
    expect(sensory!.safety.requiresParentApproval).toBe(true);
    expect(sensory!.status).toBe("PENDING");
    // Evidence attributes the contributing roles.
    const roles = sensory!.evidence.map((e) => e.contributorRole);
    expect(roles).toContain("teacher");
    expect(roles).toContain("caregiver");
    expect(describeProvenance(sensory!.evidence)).toBe("1 teacher observation + 1 caregiver note");
  });

  it("does not fire on a single observation (needs corroboration)", () => {
    const signals = transformObservationsToSignals({
      caregiverObservations: [
        { contributorRole: "teacher", category: "sensory", notes: "Sensory overload." },
      ],
    });
    const recs = generateRecommendations({ learnerId: "l", signals, currentProfile: {} });
    expect(recs.find((r) => r.type === "sensory_setting_change")).toBeUndefined();
  });
});
