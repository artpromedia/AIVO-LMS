/**
 * Wave D (G3) — draft-pack builder rules.
 *
 * Pure (no DB): outline scaffolds are schema-valid drafts that carry the
 * official standard text verbatim; AI responses parse strictly (anything
 * malformed → null so the CLI falls back to the outline); the assembled
 * pack passes the SAME validator the CMS publish action runs.
 */
import { test } from "node:test";
import assert from "node:assert";
import {
  buildDraftPack,
  buildOutlineActivities,
  parseAiActivities,
  skillGraphRefsFor,
  type CatalogueSkill,
} from "../src/lib/draft-pack-builder";
import { validateContentPack } from "../src/lib/pack-store";

const SKILL: CatalogueSkill = {
  id: "ccss.math.3.nf.a.1",
  subject: "math",
  gradeBand: "3",
  label: "Understand a fraction 1/b as the quantity formed by 1 part",
  summary:
    "Understand a fraction 1/b as the quantity formed by 1 part when a whole is "
    + "partitioned into b equal parts.",
  source: "CCSS.Math.Content.3.NF.A.1",
};

test("outline activities are draft-labelled and carry the official standard verbatim", () => {
  const acts = buildOutlineActivities(SKILL);
  assert.equal(acts.length, 3);
  assert.ok(acts.every((a) => a.skillId === SKILL.id));
  assert.ok(acts.every((a) => a.prompt.includes("DRAFT OUTLINE")));
  assert.ok(acts[0]!.prompt.includes("CCSS.Math.Content.3.NF.A.1"));
  assert.ok(acts[0]!.prompt.includes(SKILL.summary));
  const check = acts[1]!;
  assert.equal(check.type, "multiple_choice");
  assert.ok(check.choices!.some((c) => c.correct));
});

test("parseAiActivities accepts a well-formed fenced response", () => {
  const content = [
    "Here are the activities:",
    "```json",
    JSON.stringify([
      {
        title: "Fraction strips",
        type: "narration",
        prompt: "Let's look at how a whole splits into equal parts using fraction strips.",
        difficulty: "intro",
      },
      {
        title: "Pick the unit fraction",
        type: "multiple_choice",
        prompt: "A whole is split into 4 equal parts. Which fraction names ONE part?",
        difficulty: "core",
        choices: [
          { id: "a", label: "1/4", correct: true },
          { id: "b", label: "4/1" },
          { id: "c", label: "1/2" },
        ],
      },
    ]),
    "```",
  ].join("\n");
  const acts = parseAiActivities(content, SKILL);
  assert.ok(acts);
  assert.equal(acts!.length, 2);
  assert.equal(acts![0]!.skillId, SKILL.id);
  assert.equal(acts![1]!.type, "multiple_choice");
});

test("parseAiActivities rejects malformed payloads (CLI falls back to outline)", () => {
  assert.equal(parseAiActivities("no json here", SKILL), null);
  assert.equal(parseAiActivities("[]", SKILL), null);
  // multiple_choice without a correct choice is invalid.
  assert.equal(
    parseAiActivities(
      JSON.stringify([
        {
          type: "multiple_choice",
          prompt: "Which one is right though?",
          choices: [{ id: "a", label: "x" }, { id: "b", label: "y" }],
        },
      ]),
      SKILL,
    ),
    null,
  );
  // Unknown activity types are dropped.
  assert.equal(
    parseAiActivities(
      JSON.stringify([{ type: "hologram", prompt: "Project the fractions in 3D space." }]),
      SKILL,
    ),
    null,
  );
});

test("buildDraftPack assembles a pack the CMS validator accepts, status-agnostic", () => {
  const skills = [
    SKILL,
    { ...SKILL, id: "ccss.math.3.nf.a.2", source: "CCSS.Math.Content.3.NF.A.2" },
  ];
  const pack = buildDraftPack({
    subject: "math",
    gradeBand: "3",
    skills,
    activitiesBySkill: new Map(skills.map((s) => [s.id, buildOutlineActivities(s)])),
    generatedAtIso: "2026-06-11T00:00:00.000Z",
    generator: "outline",
  });
  assert.equal(pack.id, "ccss-draft-math-3");
  assert.ok(pack.title.startsWith("[DRAFT]"));
  assert.equal(pack.activities.length, 6);
  assert.deepEqual(skillGraphRefsFor(skills), ["ccss.math.3.nf"]);
  const issues = validateContentPack(pack);
  assert.deepEqual(issues, [], `validator issues: ${JSON.stringify(issues)}`);
});
