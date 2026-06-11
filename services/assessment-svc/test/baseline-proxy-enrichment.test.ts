/**
 * Wave F (G9 — baseline completeness) — the generate-baseline proxy must
 * fuse EVERY intake source. The regression this guards: the flat-LLM
 * proxy tier enriched caregiver/teacher/IEP/interests but silently
 * dropped therapist assessments, active therapy goals, and caregiver
 * observation notes — so a child whose only professional input came from
 * a therapist got a baseline that ignored it.
 *
 * Exercises the exported `enrichBaselineForwardBody` against a
 * table-aware thenable drizzle fake.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  learners,
  parentAssessments,
  teacherAssessments,
  therapistAssessments,
  therapyGoals,
  caregiverObservations,
  iepProfiles,
  iepGoals,
  learnerInterestSignals,
} from "@aivo/db";
import { enrichBaselineForwardBody } from "../src/routes/learner-baseline.js";

const NOW = new Date("2026-06-01T00:00:00.000Z");

const LEARNER_ROW = {
  id: "lrn-db-1",
  userId: "usr-1",
  functioningLevel: "SUPPORTED",
  gradeLevel: "2",
  districtId: "0634320",
  districtName: "Demo Unified",
  region: "CA",
  country: "US",
  curriculumFramework: "CCSS",
  curriculumAlignment: {},
  zipCode: "94110",
};

function rowsFor(table: unknown): unknown[] {
  if (table === learners) return [LEARNER_ROW];
  if (table === parentAssessments) {
    return [
      {
        submittedBy: "parent-1",
        completedAt: NOW,
        communicationMode: "verbal",
        deviceInteraction: "independent",
        responseMethod: "touch",
        attentionSpan: "10-15min",
        diagnoses: ["autism"],
        responses: { q1: "a" },
      },
    ];
  }
  if (table === teacherAssessments) {
    return [
      {
        completedAt: NOW,
        teacherRole: "gen-ed",
        gradeLevel: "2",
        subjectArea: "math",
        strengths: ["pattern recognition"],
        challenges: ["multi-step directions"],
        accommodations: ["chunked instructions"],
        observations: "Focuses well in the morning.",
        recommendedFocusAreas: ["place value"],
        responses: {},
      },
    ];
  }
  if (table === therapistAssessments) {
    return [
      {
        id: "tha-1",
        submittedBy: "therapist-1",
        completedAt: NOW,
        therapyDiscipline: "speech",
        areasOfFocus: ["articulation"],
        strengths: ["receptive language"],
        challenges: ["initial consonant blends"],
        sensoryNotes: "Sensitive to sudden noise.",
        communicationNotes: "Uses short phrases.",
        regulationStrategies: ["deep breaths"],
        recommendedAccommodations: ["extra response time"],
        observations: "Improving steadily.",
        responses: {},
      },
    ];
  }
  if (table === therapyGoals) {
    return [
      {
        goalText: "Produce /s/ blends in 8 of 10 trials",
        domain: "articulation",
        baseline: "3 of 10",
        targetCriteria: "8 of 10",
        currentProgress: "5 of 10",
        status: "active",
      },
    ];
  }
  if (table === caregiverObservations) {
    return [
      {
        category: "Communication",
        mood: "calm",
        notes: "x".repeat(400), // must be truncated to 280
        date: NOW,
      },
    ];
  }
  if (table === iepProfiles) {
    return [
      {
        disabilityCategories: ["speech or language impairment"],
        accommodations: ["visual schedule"],
        goals: [],
        gradeLevel: "2",
        communicationSystem: "verbal + AAC backup",
        assistiveTechnology: [],
        recommendedFunctioningLevel: "SUPPORTED",
      },
    ];
  }
  if (table === iepGoals) {
    return [
      {
        domain: "communication",
        goalText: "Request help independently",
        baseline: "with prompts",
        targetCriteria: "independently 4/5 days",
      },
    ];
  }
  if (table === learnerInterestSignals) {
    return [
      {
        slug: "trains",
        source: "parent_intake",
        polarity: 1,
        confidence: 0.9,
        observedAt: NOW,
      },
      {
        slug: "trains",
        source: "session_theme",
        polarity: 1,
        confidence: 0.8,
        observedAt: NOW,
      },
    ];
  }
  return [];
}

/** Thenable chain: awaitable at any depth, resolves rows by table. */
function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  c.where = () => c;
  c.orderBy = () => c;
  c.limit = () => c;
  c.then = (res: (v: unknown[]) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(res, rej);
  return c;
}

const fakeDb = {
  select: () => ({ from: (table: unknown) => chain(rowsFor(table)) }),
};

test("enrichment fuses all nine intake sources for the flat-LLM tier", async () => {
  const out = await enrichBaselineForwardBody(fakeDb, "lrn-db-1", {
    parent_assessment: { responses: { q1: "a" } },
  });

  // The original payload is preserved…
  assert.deepEqual(out.parent_assessment, { responses: { q1: "a" } });

  // …and every optional source is fused in.
  const perspectives = out.caregiver_perspectives as Array<{ submittedBy: string }>;
  assert.equal(perspectives.length, 1);
  assert.equal(perspectives[0].submittedBy, "parent-1");

  const teacher = out.teacher_assessment as { subjectArea: string };
  assert.equal(teacher.subjectArea, "math");

  // G9: the three previously-dropped sources.
  const therapists = out.therapist_assessments as Array<{ therapyDiscipline: string }>;
  assert.equal(therapists.length, 1);
  assert.equal(therapists[0].therapyDiscipline, "speech");

  const goals = out.therapy_goals as Array<{ goal: string; target: string }>;
  assert.equal(goals.length, 1);
  assert.equal(goals[0].goal, "Produce /s/ blends in 8 of 10 trials");
  assert.equal(goals[0].target, "8 of 10");

  const observations = out.caregiver_observations as Array<{ notes: string; category: string }>;
  assert.equal(observations.length, 1);
  assert.equal(observations[0].category, "Communication");
  assert.equal(observations[0].notes.length, 280, "observation notes truncated");

  const iep = out.iep as { disabilityCategories: string[]; goals: unknown[] };
  assert.deepEqual(iep.disabilityCategories, ["speech or language impairment"]);
  assert.equal(iep.goals.length, 1, "iep goals fall back to iep_goals rows");

  const interests = out.interest_profile as { interestSlugs: string[] };
  assert.ok(interests.interestSlugs.includes("trains"));

  const district = out.district as { districtName: string };
  assert.equal(district.districtName, "Demo Unified");
  assert.equal(out.zip_code, "94110");
  assert.equal(out.functioning_level, "SUPPORTED");
});

test("caller-supplied values are never overwritten", async () => {
  const out = await enrichBaselineForwardBody(fakeDb, "lrn-db-1", {
    parent_assessment: {},
    teacher_assessment: { subjectArea: "explicit-from-caller" },
    therapist_assessments: [],
    functioning_level: "STANDARD",
  });
  assert.deepEqual(out.teacher_assessment, { subjectArea: "explicit-from-caller" });
  assert.deepEqual(out.therapist_assessments, [], "explicit empty array respected");
  assert.equal(out.functioning_level, "STANDARD");
});

test("no learner hint → payload passes through untouched", async () => {
  const incoming = { parent_assessment: { responses: {} } };
  const out = await enrichBaselineForwardBody(fakeDb, undefined, incoming);
  assert.deepEqual(out, incoming);
});

test("a db failure degrades to passthrough with a warning, never a throw", async () => {
  const warnings: object[] = [];
  const out = await enrichBaselineForwardBody(
    {
      select: () => {
        throw new Error("db down");
      },
    },
    "lrn-db-1",
    { parent_assessment: {} },
    { warn: (obj) => warnings.push(obj) },
  );
  assert.deepEqual(out, { parent_assessment: {} });
  assert.equal(warnings.length, 1);
});
