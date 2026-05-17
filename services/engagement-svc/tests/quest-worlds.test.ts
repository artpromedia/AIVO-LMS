import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QUEST_WORLDS,
  QUEST_WORLD_ALIASES,
  resolveQuestWorld,
  isQuestWorldKey,
} from "../src/quest-worlds.js";

describe("quest-worlds registry", () => {
  it("ships exactly the five core Quest Worlds", () => {
    assert.equal(QUEST_WORLDS.length, 5);
    const keys = QUEST_WORLDS.map((w) => w.key).sort();
    assert.deepEqual(keys, [
      "chrono_time_tower",
      "nova_number_galaxy",
      "pixel_code_forge",
      "sage_story_kingdom",
      "spark_science_lab",
    ]);
  });

  it("resolves canonical world keys", () => {
    const nova = resolveQuestWorld("nova_number_galaxy");
    assert.ok(nova);
    assert.equal(nova?.key, "nova_number_galaxy");
    assert.equal(nova?.tutorKey, "nova");
  });

  it("resolves tutor-key aliases to the same world", () => {
    for (const world of QUEST_WORLDS) {
      const viaTutorKey = resolveQuestWorld(world.tutorKey);
      assert.ok(viaTutorKey, `tutor alias ${world.tutorKey} should resolve`);
      assert.equal(viaTutorKey?.key, world.key);
    }
  });

  it("returns undefined for unknown slugs", () => {
    assert.equal(resolveQuestWorld("invalid_slug"), undefined);
    assert.equal(resolveQuestWorld(""), undefined);
    assert.equal(resolveQuestWorld(null), undefined);
    assert.equal(resolveQuestWorld(undefined), undefined);
  });

  it("isQuestWorldKey recognises both canonical and alias slugs", () => {
    assert.equal(isQuestWorldKey("nova_number_galaxy"), true);
    assert.equal(isQuestWorldKey("nova"), true);
    assert.equal(isQuestWorldKey("pixel"), true);
    assert.equal(isQuestWorldKey("invalid_slug"), false);
    assert.equal(isQuestWorldKey(42), false);
    assert.equal(isQuestWorldKey(null), false);
  });

  it("exposes alias map keyed by both world key and tutor key", () => {
    for (const world of QUEST_WORLDS) {
      assert.equal(QUEST_WORLD_ALIASES[world.key], world.key);
      assert.equal(QUEST_WORLD_ALIASES[world.tutorKey], world.key);
    }
  });
});
