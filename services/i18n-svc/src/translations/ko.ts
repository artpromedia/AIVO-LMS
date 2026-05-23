// Seeded from en.ts on 2026-05-23 — every value is the English
// source string awaiting translation review. Tracked as untranslated by
// the i18n audit (`pnpm i18n:audit`). The /api/i18n/translations/ko
// endpoint serves these strings directly while the human-review backlog
// drains; the existing fallback to en in routes/translations.ts is no
// longer reached for ko because the file is now present.
import { en } from "./en.js";

export const ko: Record<string, string> = { ...en };
