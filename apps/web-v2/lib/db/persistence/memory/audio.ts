/**
 * In-memory AudioStore — wraps audioAssets / ttsGenerationJobs /
 * pronunciationOverrides / learnerVoicePreferences / readAloudUsageEvents /
 * audioCacheEntries Maps. Test-only; the repo layer owns sorting/filtering +
 * cache-key + hit logic. Voice prefs keyed by learnerId; cache by composite
 * `${tenantId}:${lang}:${hash}` key.
 */
import { getStore } from "@/lib/db/store";
import type {
  AudioAsset,
  AudioCacheEntry,
  LearnerVoicePreference,
  PronunciationOverride,
  ReadAloudUsageEvent,
} from "@/lib/db/types";
import type { AudioStore } from "../types";

export const memoryAudio: AudioStore = {
  async getAudioAsset(id) {
    return getStore().audioAssets.get(id) ?? null;
  },
  async listAudioAssets(): Promise<AudioAsset[]> {
    return Array.from(getStore().audioAssets.values());
  },
  async upsertAudioAsset(asset) {
    getStore().audioAssets.set(asset.id, asset);
    return asset;
  },
  async upsertTtsJob(job) {
    getStore().ttsGenerationJobs.set(job.id, job);
    return job;
  },
  async listPronunciationOverrides(): Promise<PronunciationOverride[]> {
    return Array.from(getStore().pronunciationOverrides.values());
  },
  async getPronunciationOverride(id) {
    return getStore().pronunciationOverrides.get(id) ?? null;
  },
  async upsertPronunciationOverride(o) {
    getStore().pronunciationOverrides.set(o.id, o);
    return o;
  },
  async getVoicePreference(learnerId): Promise<LearnerVoicePreference | null> {
    return getStore().learnerVoicePreferences.get(learnerId) ?? null;
  },
  async upsertVoicePreference(pref) {
    getStore().learnerVoicePreferences.set(pref.learnerId, pref);
    return pref;
  },
  async appendReadAloudUsage(event) {
    getStore().readAloudUsageEvents.set(event.id, event);
    return event;
  },
  async listReadAloudUsage(): Promise<ReadAloudUsageEvent[]> {
    return Array.from(getStore().readAloudUsageEvents.values());
  },
  async getCacheEntry(cacheKey): Promise<AudioCacheEntry | null> {
    return getStore().audioCacheEntries.get(cacheKey) ?? null;
  },
  async upsertCacheEntry(cacheKey, entry) {
    getStore().audioCacheEntries.set(cacheKey, entry);
    return entry;
  },
};
