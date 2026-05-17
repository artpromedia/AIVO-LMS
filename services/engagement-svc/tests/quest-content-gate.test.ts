import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { QUEST_WORLDS } from "../src/quest-worlds.js";
import { QUEST_CHAPTER_CONTENT } from "../src/quest-content.js";

/**
 * Content gate — fails the build if any seeded quest content contains
 * stub / placeholder / TODO copy. Pairs with the web route crawler at
 * apps/web/tests/e2e/learner-study-routes.spec.ts which guards the
 * rendered surface; this guards the data going into the DB.
 */

const BANNED_SUBSTRINGS = [
  "coming soon",
  "placeholder",
  "lorem ipsum",
  "todo:",
  "fixme",
  "tbd",
  "demo content",
  "mock content",
  "stub",
];

function scan(label: string, value: string | null | undefined) {
  if (!value) {
    assert.fail(`${label} is empty`);
  }
  const lower = value.toLowerCase();
  for (const banned of BANNED_SUBSTRINGS) {
    if (lower.includes(banned)) {
      assert.fail(`${label} contains banned phrase "${banned}": ${value}`);
    }
  }
}

describe("quest content seed gate", () => {
  it("every world key in QUEST_WORLDS has 5 chapters in QUEST_CHAPTER_CONTENT", () => {
    for (const world of QUEST_WORLDS) {
      const chapters = QUEST_CHAPTER_CONTENT.filter((c) => c.worldKey === world.key);
      assert.equal(
        chapters.length,
        5,
        `world ${world.key} expects 5 chapters, found ${chapters.length}`,
      );
    }
  });

  it("every chapter key in QUEST_CHAPTER_CONTENT maps to a real world", () => {
    const validKeys = new Set(QUEST_WORLDS.map((w) => w.key));
    for (const c of QUEST_CHAPTER_CONTENT) {
      assert.ok(
        validKeys.has(c.worldKey),
        `chapter references unknown world key: ${c.worldKey}`,
      );
    }
  });

  it("no chapter narrative or question text contains banned stub phrases", () => {
    for (const c of QUEST_CHAPTER_CONTENT) {
      const ctx = `${c.worldKey}/${c.chapterNumber}`;
      scan(`${ctx} title`, c.title);
      scan(`${ctx} description`, c.description);
      scan(`${ctx} intro`, c.narrativeIntro);
      scan(`${ctx} outro`, c.narrativeOutro);
      for (const q of c.bossAssessment.questions) {
        scan(`${ctx}/${q.id} prompt`, q.prompt);
        scan(`${ctx}/${q.id} explanation`, q.explanation);
        for (const [i, choice] of q.choices.entries()) {
          scan(`${ctx}/${q.id}/choice[${i}]`, choice);
        }
      }
    }
  });

  it("XP and coin rewards are positive integers in expected ranges", () => {
    for (const c of QUEST_CHAPTER_CONTENT) {
      const ctx = `${c.worldKey}/${c.chapterNumber}`;
      assert.ok(Number.isInteger(c.xpReward) && c.xpReward > 0 && c.xpReward <= 1000, `${ctx} xpReward`);
      assert.ok(Number.isInteger(c.coinReward) && c.coinReward >= 0 && c.coinReward <= 500, `${ctx} coinReward`);
    }
  });

  it("boss assessments declare a sensible passing score", () => {
    for (const c of QUEST_CHAPTER_CONTENT) {
      const score = c.bossAssessment.passingScore;
      assert.ok(
        score >= 50 && score <= 100,
        `${c.worldKey}/${c.chapterNumber} passingScore should be 50-100, got ${score}`,
      );
    }
  });
});
