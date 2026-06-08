/**
 * Web-owned TTS / audio / read-aloud persistence tables (Sprint 7).
 *
 * Audio assets, TTS generation jobs, the read-aloud audio cache (composite
 * key `${tenantId}:${lang}:${hash}` → audioAssetId, with hit counters),
 * pronunciation overrides, per-learner voice preferences, and read-aloud usage
 * events.
 *
 * RLS: NOT applied. These carry tenant_id but are read by admin review/usage
 * consoles ACROSS tenants (listAudioAssets()/listReadAloudUsage() accept an
 * OPTIONAL tenant filter), the same admin-cross-tenant rationale as the other
 * web_* tables; tenant scoping is enforced in app code.
 *
 * Conventions match web-domain.ts: TEXT ids, full object in `data` JSONB.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const webAudioAssets = pgTable(
  "web_audio_assets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_audio_assets_tenant_idx").on(t.tenantId) }),
);

export const webTtsGenerationJobs = pgTable(
  "web_tts_generation_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_tts_generation_jobs_tenant_idx").on(t.tenantId) }),
);

export const webPronunciationOverrides = pgTable(
  "web_pronunciation_overrides",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_pronunciation_overrides_tenant_idx").on(t.tenantId) }),
);

export const webLearnerVoicePreferences = pgTable("web_learner_voice_preferences", {
  learnerId: text("learner_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  data: jsonb("data").notNull(),
});

export const webReadAloudUsageEvents = pgTable(
  "web_read_aloud_usage_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_read_aloud_usage_events_tenant_idx").on(t.tenantId) }),
);

export const webAudioCacheEntries = pgTable("web_audio_cache_entries", {
  cacheKey: text("cache_key").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  data: jsonb("data").notNull(),
});
