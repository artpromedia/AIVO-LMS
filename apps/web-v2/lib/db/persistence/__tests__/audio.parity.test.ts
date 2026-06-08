/**
 * audio / TTS / read-aloud — memory == postgres parity (Sprint 7).
 *
 * The read-aloud audio cache (composite key + hit counters), pronunciation
 * overrides (platform/tenant scope), per-learner voice preferences, and TTS
 * generation (cache miss → asset + entry; cache hit → bumped hits + cached_hit
 * job) must persist to Postgres.
 */
import { it, expect } from "vitest";
import {
  createPronunciationOverride,
  updatePronunciationOverride,
  listPronunciationOverrides,
  getLearnerVoicePreference,
  upsertLearnerVoicePreference,
  generateTTS,
  getAudioAsset,
} from "@/lib/db/repos";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_audio_parity";

runInBothModes("audio", () => {
  it("pronunciation overrides: create, scope filter, update", async () => {
    const plat = await createPronunciationOverride({
      tenantId: T,
      token: "AIVO",
      replacement: "EY-voh",
      encoding: "plain",
      scope: "platform",
      notes: null,
      createdByUserId: "u",
    });
    await createPronunciationOverride({
      tenantId: "t_other_audio",
      token: "ZZZ",
      replacement: "zee",
      encoding: "plain",
      scope: "tenant",
      notes: null,
      createdByUserId: "u",
    });
    // platform overrides + own-tenant overrides only; sorted by token.
    const mine = await listPronunciationOverrides(T);
    expect(mine.some((o) => o.token === "AIVO")).toBe(true);
    expect(mine.some((o) => o.token === "ZZZ")).toBe(false);
    const updated = await updatePronunciationOverride(plat.id, { replacement: "AY-voh" });
    expect(updated?.replacement).toBe("AY-voh");
  });

  it("voice preference upsert merges + clamps speed", async () => {
    expect(await getLearnerVoicePreference("lrn-audio-x")).toBeNull();
    const p1 = await upsertLearnerVoicePreference({
      learnerId: "lrn-audio-x",
      tenantId: T,
      speed: 9,
    });
    expect(p1.speed).toBe(2); // clamped to max 2
    const p2 = await upsertLearnerVoicePreference({
      learnerId: "lrn-audio-x",
      tenantId: T,
      enabled: false,
    });
    expect(p2.speed).toBe(2); // preserved from prior
    expect(p2.enabled).toBe(false);
  });

  it("TTS cache: miss creates asset+entry, hit bumps hits + cached_hit job", async () => {
    const audio = getPersistence().audio;
    const args = { tenantId: T, learnerId: null, text: "Hello there", languageCode: "en-US" };
    const first = await generateTTS(args);
    expect(first.job.status).toBe("completed");
    expect((await getAudioAsset(first.asset.id))?.id).toBe(first.asset.id);

    const second = await generateTTS(args);
    expect(second.job.status).toBe("cached_hit");
    // same asset reused
    expect(second.asset.id).toBe(first.asset.id);
    // the cache entry's hit counter advanced and persisted
    const key = `${T}:en-US:${first.asset.contentHash}`;
    expect((await audio.getCacheEntry(key))?.hits).toBe(1);
  });
});
