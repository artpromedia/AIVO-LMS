import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUEST_CHAPTER_CONTENT,
  getChapter,
  type BossQuestion,
} from "../src/quest-content.js";
import { QUEST_WORLDS } from "../src/quest-worlds.js";

describe("quest-content registry", () => {
  it("ships 5 chapters for every Quest World", () => {
    for (const world of QUEST_WORLDS) {
      const chapters = QUEST_CHAPTER_CONTENT.filter((c) => c.worldKey === world.key);
      assert.equal(chapters.length, 5, `expected 5 chapters for ${world.key}`);
      const numbers = chapters.map((c) => c.chapterNumber).sort();
      assert.deepEqual(numbers, [1, 2, 3, 4, 5]);
    }
  });

  it("every chapter has a non-empty intro, outro, and 3-question boss", () => {
    for (const chapter of QUEST_CHAPTER_CONTENT) {
      assert.ok(chapter.narrativeIntro && chapter.narrativeIntro.length > 0, `${chapter.worldKey}/${chapter.chapterNumber} intro`);
      assert.ok(chapter.narrativeOutro && chapter.narrativeOutro.length > 0, `${chapter.worldKey}/${chapter.chapterNumber} outro`);
      assert.ok(chapter.bossAssessment, `${chapter.worldKey}/${chapter.chapterNumber} bossAssessment`);
      const qs = chapter.bossAssessment.questions;
      assert.equal(qs.length, 3, `${chapter.worldKey}/${chapter.chapterNumber} needs 3 questions`);
      for (const q of qs) {
        assertQuestionShape(chapter.worldKey, chapter.chapterNumber, q);
      }
    }
  });

  it("question IDs are unique within a chapter", () => {
    for (const chapter of QUEST_CHAPTER_CONTENT) {
      const ids = chapter.bossAssessment.questions.map((q) => q.id);
      assert.equal(new Set(ids).size, ids.length, `${chapter.worldKey}/${chapter.chapterNumber} duplicate question id`);
    }
  });

  it("answerIndex points to a valid choice", () => {
    for (const chapter of QUEST_CHAPTER_CONTENT) {
      for (const q of chapter.bossAssessment.questions) {
        assert.ok(
          q.answerIndex >= 0 && q.answerIndex < q.choices.length,
          `${chapter.worldKey}/${chapter.chapterNumber}/${q.id} answerIndex out of range`,
        );
      }
    }
  });

  it("getChapter resolves by (worldKey, chapterNumber)", () => {
    const nova1 = getChapter("nova_number_galaxy", 1);
    assert.ok(nova1);
    assert.equal(nova1?.title, "Counting Stars");
    assert.equal(getChapter("nova_number_galaxy", 99), undefined);
    assert.equal(getChapter("unknown_world", 1), undefined);
  });
});

function assertQuestionShape(world: string, ch: number, q: BossQuestion) {
  const ctx = `${world}/${ch}/${q.id}`;
  assert.ok(q.prompt && q.prompt.length > 0, `${ctx} prompt`);
  assert.ok(Array.isArray(q.choices) && q.choices.length >= 2, `${ctx} choices`);
  assert.ok(q.explanation && q.explanation.length > 0, `${ctx} explanation`);
  assert.ok(["easy", "medium", "hard"].includes(q.difficulty), `${ctx} difficulty`);
  assert.ok(q.skillTag && q.skillTag.length > 0, `${ctx} skillTag`);
}
