/**
 * Drizzle-backed AudioStore — the web_* audio / TTS / read-aloud tables.
 * Voice prefs keyed by learnerId; the read-aloud cache keyed by the composite
 * `${tenantId}:${lang}:${hash}` string. Sorting/filtering + cache-key + hit
 * logic live in the repo layer, so this is a plain row store.
 */
import { eq } from "drizzle-orm";
import {
  webAudioAssets,
  webTtsGenerationJobs,
  webPronunciationOverrides,
  webLearnerVoicePreferences,
  webReadAloudUsageEvents,
  webAudioCacheEntries,
} from "@aivo/db";
import type {
  AudioAsset,
  AudioCacheEntry,
  LearnerVoicePreference,
  PronunciationOverride,
  ReadAloudUsageEvent,
} from "@/lib/db/types";
import type { AudioStore } from "../types";
import { getDb } from "./client";

export const drizzleAudio: AudioStore = {
  async getAudioAsset(id) {
    const [row] = await getDb().select().from(webAudioAssets).where(eq(webAudioAssets.id, id)).limit(1);
    return row ? (row.data as AudioAsset) : null;
  },
  async listAudioAssets(): Promise<AudioAsset[]> {
    const rows = await getDb().select().from(webAudioAssets);
    return rows.map((r) => r.data as AudioAsset);
  },
  async upsertAudioAsset(asset) {
    await getDb()
      .insert(webAudioAssets)
      .values({ id: asset.id, tenantId: asset.tenantId, data: asset })
      .onConflictDoUpdate({ target: webAudioAssets.id, set: { tenantId: asset.tenantId, data: asset } });
    return asset;
  },
  async upsertTtsJob(job) {
    await getDb()
      .insert(webTtsGenerationJobs)
      .values({ id: job.id, tenantId: job.tenantId, data: job })
      .onConflictDoUpdate({ target: webTtsGenerationJobs.id, set: { tenantId: job.tenantId, data: job } });
    return job;
  },
  async listPronunciationOverrides(): Promise<PronunciationOverride[]> {
    const rows = await getDb().select().from(webPronunciationOverrides);
    return rows.map((r) => r.data as PronunciationOverride);
  },
  async getPronunciationOverride(id) {
    const [row] = await getDb()
      .select()
      .from(webPronunciationOverrides)
      .where(eq(webPronunciationOverrides.id, id))
      .limit(1);
    return row ? (row.data as PronunciationOverride) : null;
  },
  async upsertPronunciationOverride(o) {
    await getDb()
      .insert(webPronunciationOverrides)
      .values({ id: o.id, tenantId: o.tenantId, data: o })
      .onConflictDoUpdate({ target: webPronunciationOverrides.id, set: { tenantId: o.tenantId, data: o } });
    return o;
  },
  async getVoicePreference(learnerId): Promise<LearnerVoicePreference | null> {
    const [row] = await getDb()
      .select()
      .from(webLearnerVoicePreferences)
      .where(eq(webLearnerVoicePreferences.learnerId, learnerId))
      .limit(1);
    return row ? (row.data as LearnerVoicePreference) : null;
  },
  async upsertVoicePreference(pref) {
    await getDb()
      .insert(webLearnerVoicePreferences)
      .values({ learnerId: pref.learnerId, tenantId: pref.tenantId, data: pref })
      .onConflictDoUpdate({
        target: webLearnerVoicePreferences.learnerId,
        set: { tenantId: pref.tenantId, data: pref },
      });
    return pref;
  },
  async appendReadAloudUsage(event) {
    await getDb()
      .insert(webReadAloudUsageEvents)
      .values({ id: event.id, tenantId: event.tenantId, data: event })
      .onConflictDoNothing({ target: webReadAloudUsageEvents.id });
    return event;
  },
  async listReadAloudUsage(): Promise<ReadAloudUsageEvent[]> {
    const rows = await getDb().select().from(webReadAloudUsageEvents);
    return rows.map((r) => r.data as ReadAloudUsageEvent);
  },
  async getCacheEntry(cacheKey): Promise<AudioCacheEntry | null> {
    const [row] = await getDb()
      .select()
      .from(webAudioCacheEntries)
      .where(eq(webAudioCacheEntries.cacheKey, cacheKey))
      .limit(1);
    return row ? (row.data as AudioCacheEntry) : null;
  },
  async upsertCacheEntry(cacheKey, entry) {
    await getDb()
      .insert(webAudioCacheEntries)
      .values({ cacheKey, tenantId: entry.tenantId, data: entry })
      .onConflictDoUpdate({
        target: webAudioCacheEntries.cacheKey,
        set: { tenantId: entry.tenantId, data: entry },
      });
    return entry;
  },
};
