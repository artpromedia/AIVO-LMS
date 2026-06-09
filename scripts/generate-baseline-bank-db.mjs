#!/usr/bin/env node
/**
 * Daily baseline-bank generator (DB-writing) — run by the
 * `baseline-bank-generator` CronJob.
 *
 * Each run:
 *   1. Connects to Postgres (DATABASE_URL) and reads the existing
 *      `web_baseline_bank` rows (for dedupe + per-cell coverage counts).
 *   2. Picks a ROTATING window of (grade band × functioning level) cells so a
 *      single run stays inside the CronJob deadline (each LLM call is ~130s).
 *      Over successive days the window walks across every cell and then revisits
 *      them — every revisit adds fresh, deduped questions, so the bank keeps
 *      growing ("keeps getting new questions").
 *   3. For each cell, calls assessment-svc `/api/ai/generate-baseline`, maps the
 *      returned questions to bank items tagged with the cell + difficulty, and
 *      UPSERTs the new (deduped) ones into `web_baseline_bank`
 *      (id = stable hash of the dedupe key, ON CONFLICT DO NOTHING).
 *
 * It writes ONLY new rows; it never deletes. web-v2 `createBaseline` reads this
 * table and serves baselines from it instantly (no on-request LLM call).
 *
 * Runs in the assessment-svc image (has Node + the `postgres` client and the
 * shared `aivo-common-env` secret: ASSESSMENT_SVC_URL, DATABASE_URL,
 * INTERNAL_SERVICE_TOKEN). The script itself is mounted from a ConfigMap.
 *
 * Env:
 *   DATABASE_URL                Postgres connection string (aivo-common-env)
 *   ASSESSMENT_SVC_URL          e.g. http://assessment-svc:3000 (aivo-common-env)
 *   INTERNAL_SERVICE_TOKEN      internal service token (aivo-common-env)
 *   BANK_CELLS_PER_RUN          cells to process this run (default 6)
 *   BANK_TARGET_PER_SUBJECT     stop adding to a cell's subject at this depth (default 24)
 *   BANK_GRADE_BANDS / BANK_LEVELS  override the cell matrix (comma lists)
 *   BANK_TIMEOUT_MS             per-call timeout (default 175000)
 *   APP_NODE_MODULES            base dir to resolve `postgres` from (default /app/)
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const APP_BASE = process.env.APP_NODE_MODULES ?? "/app/";
const require = createRequire(pathToFileURL(APP_BASE).href);
let postgres;
try {
  postgres = require("postgres");
} catch (e) {
  console.error(
    `FATAL: could not load 'postgres' from ${APP_BASE} (${e?.message}). ` +
      "Run this in an image that bundles the postgres client (assessment-svc).",
  );
  process.exit(2);
}

const DATABASE_URL = process.env.DATABASE_URL;
const BASE = process.env.ASSESSMENT_SVC_URL;
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN;
if (!DATABASE_URL || !BASE || !TOKEN) {
  console.error(
    "FATAL: DATABASE_URL, ASSESSMENT_SVC_URL and INTERNAL_SERVICE_TOKEN are required",
  );
  process.exit(2);
}

const GRADE_BANDS = (process.env.BANK_GRADE_BANDS ??
  "preK,K,1-2,3-5,6-8,9-12,post_secondary")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LEVELS = (process.env.BANK_LEVELS ??
  "STANDARD,SUPPORTED,LOW_VERBAL,NON_VERBAL,PRE_SYMBOLIC")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const CELLS_PER_RUN = Number(process.env.BANK_CELLS_PER_RUN ?? "6");
const TARGET_PER_SUBJECT = Number(process.env.BANK_TARGET_PER_SUBJECT ?? "24");
const TIMEOUT_MS = Number(process.env.BANK_TIMEOUT_MS ?? "175000");

const VALID_SUBJECTS = new Set([
  "math",
  "ela",
  "science",
  "speech",
  "sel",
  "life_skills",
  "executive_function",
]);

function mapDifficulty(d) {
  if (typeof d === "number") return d <= 1 ? "foundational" : "grade_level";
  const s = String(d ?? "").toLowerCase();
  if (["foundational", "approaching", "grade_level", "stretch"].includes(s)) return s;
  if (s === "easy") return "foundational";
  if (s === "moderate" || s === "medium") return "grade_level";
  if (s === "hard" || s === "challenge") return "stretch";
  return "grade_level";
}

function syntheticParentAssessment(gradeBand) {
  return {
    communicationMode: "verbal",
    responseMethod: "typing",
    deviceInteraction: "independent",
    gradeBand,
    grade_band: gradeBand,
    developmentalNotes: `Generate grade-band-appropriate content for grade band ${gradeBand}.`,
    strengths: "curious, engaged",
    interests: ["animals", "space", "games"],
  };
}

function dedupeKey(item) {
  return `${item.subject}|${item.gradeBand}|${item.functioningLevel}|${item.prompt.trim().toLowerCase()}`;
}
function itemId(item) {
  return "bbk_" + createHash("sha1").update(dedupeKey(item)).digest("hex").slice(0, 24);
}

function toBankItem(q, gradeBand, level) {
  const choices = Array.isArray(q?.options)
    ? q.options.map((o) => o?.label).filter((l) => typeof l === "string")
    : [];
  if (choices.length < 2) return null;
  const correct = q?.options?.find((o) => o?.value === q?.correctAnswer);
  const expectedAnswer = (correct && correct.label) ?? choices[0] ?? "";
  const choiceEmojis = Array.isArray(q?.options) ? q.options.map((o) => o?.emoji ?? "") : [];
  const hasEmoji = choiceEmojis.some((e) => e && e.length > 0);
  const prompt = q?.questionText ?? q?.prompt ?? "";
  if (!prompt) return null;
  return {
    subject: q?.subject,
    gradeBand,
    functioningLevel: level,
    difficulty: mapDifficulty(q?.difficulty),
    prompt,
    choices,
    expectedAnswer,
    ...(hasEmoji ? { choiceEmojis } : {}),
    ...(q?.sceneEmoji ? { sceneEmoji: q.sceneEmoji } : {}),
    ...(q?.explanation ? { hint: q.explanation } : {}),
  };
}

async function generateCell(gradeBand, level) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/api/ai/generate-baseline`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-internal-service": "baseline-bank-generator",
        "x-service-token": TOKEN,
      },
      body: JSON.stringify({
        parent_assessment: syntheticParentAssessment(gradeBand),
        functioning_level: level,
      }),
    });
    const took = ((Date.now() - started) / 1000).toFixed(0);
    if (!res.ok) {
      console.error(`  [${gradeBand}/${level}] HTTP ${res.status} in ${took}s — skip`);
      return [];
    }
    const data = await res.json();
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    console.error(
      `  [${gradeBand}/${level}] ${questions.length} questions in ${took}s (model=${data?.model ?? "?"})`,
    );
    return questions;
  } catch (e) {
    console.error(`  [${gradeBand}/${level}] ERROR ${e?.name}: ${e?.message}`);
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** Full ordered cell list, then a daily-rotating window so runs stay bounded. */
function cellsForThisRun() {
  const all = [];
  for (const g of GRADE_BANDS) for (const l of LEVELS) all.push({ gradeBand: g, functioningLevel: l });
  if (all.length === 0) return [];
  const epochDay = Math.floor(Date.now() / 86400000);
  const start = (epochDay * CELLS_PER_RUN) % all.length;
  const out = [];
  for (let i = 0; i < Math.min(CELLS_PER_RUN, all.length); i++) {
    out.push(all[(start + i) % all.length]);
  }
  return out;
}

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: false, max: 2 });
  let added = 0;
  try {
    // Ensure the table exists (idempotent) so a first run can't fail on a
    // cold schema; web-v2 owns the canonical definition.
    await sql`CREATE TABLE IF NOT EXISTS web_baseline_bank (id text PRIMARY KEY, data jsonb NOT NULL)`;

    const existing = await sql`SELECT data FROM web_baseline_bank`;
    const seen = new Set(existing.map((r) => dedupeKey(r.data)));
    const cellSubjectCount = new Map();
    for (const r of existing) {
      const d = r.data;
      const k = `${d.gradeBand}|${d.functioningLevel}|${d.subject}`;
      cellSubjectCount.set(k, (cellSubjectCount.get(k) ?? 0) + 1);
    }
    console.error(`Loaded ${existing.length} existing bank items`);

    const cells = cellsForThisRun();
    console.error(
      `Processing ${cells.length} cells this run: ${cells.map((c) => `${c.gradeBand}/${c.functioningLevel}`).join(", ")}`,
    );

    for (const { gradeBand, functioningLevel } of cells) {
      const atTarget = [...VALID_SUBJECTS].every(
        (s) => (cellSubjectCount.get(`${gradeBand}|${functioningLevel}|${s}`) ?? 0) >= TARGET_PER_SUBJECT,
      );
      if (atTarget) {
        console.error(`  [${gradeBand}/${functioningLevel}] at target — skip`);
        continue;
      }
      const questions = await generateCell(gradeBand, functioningLevel);
      const toInsert = [];
      for (const q of questions) {
        const item = toBankItem(q, gradeBand, functioningLevel);
        if (!item || !VALID_SUBJECTS.has(item.subject)) continue;
        const k = dedupeKey(item);
        if (seen.has(k)) continue;
        const cs = `${gradeBand}|${functioningLevel}|${item.subject}`;
        if ((cellSubjectCount.get(cs) ?? 0) >= TARGET_PER_SUBJECT) continue;
        seen.add(k);
        cellSubjectCount.set(cs, (cellSubjectCount.get(cs) ?? 0) + 1);
        toInsert.push({ id: itemId(item), data: { ...item, generatedAt: new Date().toISOString() } });
      }
      for (const row of toInsert) {
        await sql`INSERT INTO web_baseline_bank ${sql(row, "id", "data")} ON CONFLICT (id) DO NOTHING`;
      }
      added += toInsert.length;
      console.error(`  [${gradeBand}/${functioningLevel}] inserted ${toInsert.length} new items`);
    }

    const [{ count }] = await sql`SELECT count(*)::int AS count FROM web_baseline_bank`;
    console.error(`Done. Added ${added} new items this run; bank now has ${count} total.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
