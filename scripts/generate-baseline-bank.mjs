#!/usr/bin/env node
/**
 * Offline baseline question-bank generator.
 *
 * This is the "model" that produces the pre-generated baseline questions the
 * web app serves instantly. It calls assessment-svc `/api/ai/generate-baseline`
 * (which fans out to ai-svc / Claude) once per (grade band × functioning level)
 * cell, buckets the returned questions by subject, tags each with its cell +
 * difficulty, de-dupes, and MERGES into the committed bank file
 * `apps/web-v2/lib/learner/baseline-bank.generated.json`.
 *
 * Why offline: generating on the request path takes ~130s and blocks the
 * parent. Generating here, ahead of time, lets `createBaseline` SELECT from the
 * bank in sub-millisecond time (see apps/web-v2/lib/learner/baseline-bank.ts).
 *
 * It is RESUMABLE and INCREMENTAL: re-running only tops up cells that are below
 * the per-(cell,subject) target depth, and never drops existing items, so you
 * can grow the bank in batches.
 *
 * Run it where assessment-svc is reachable (e.g. inside the cluster). Env:
 *   ASSESSMENT_SVC_URL            base url (e.g. http://assessment-svc:3000)
 *   ASSESSMENT_SVC_SERVICE_TOKEN  internal service token
 *   BANK_GRADE_BANDS   comma list (default: preK,K,1-2,3-5,6-8,9-12,post_secondary)
 *   BANK_LEVELS        comma list (default: STANDARD,SUPPORTED,LOW_VERBAL,NON_VERBAL,PRE_SYMBOLIC)
 *   BANK_PASSES        generations per cell (default: 1) — more passes = more variety
 *   BANK_TARGET_PER_SUBJECT  stop a cell's subject once it has this many (default: 12)
 *   BANK_TIMEOUT_MS    per-call timeout (default: 175000)
 *   OUTPUT_FILE        where to write the merged bank JSON
 *                      (default: apps/web-v2/lib/learner/baseline-bank.generated.json)
 *   BANK_INPUT_JSON    existing bank JSON to merge into (default: OUTPUT_FILE if it exists)
 *
 * Progress is logged to stderr; the merged JSON is also printed to stdout so it
 * can be captured when the filesystem isn't writable (e.g. `kubectl exec`).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

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

const PASSES = Number(process.env.BANK_PASSES ?? "1");
const TARGET_PER_SUBJECT = Number(process.env.BANK_TARGET_PER_SUBJECT ?? "12");
const TIMEOUT_MS = Number(process.env.BANK_TIMEOUT_MS ?? "175000");
const OUTPUT_FILE =
  process.env.OUTPUT_FILE ??
  "apps/web-v2/lib/learner/baseline-bank.generated.json";
const INPUT_JSON = process.env.BANK_INPUT_JSON ?? OUTPUT_FILE;

const BASE = process.env.ASSESSMENT_SVC_URL;
const TOKEN = process.env.ASSESSMENT_SVC_SERVICE_TOKEN;
if (!BASE || !TOKEN) {
  console.error(
    "ERROR: ASSESSMENT_SVC_URL and ASSESSMENT_SVC_SERVICE_TOKEN are required",
  );
  process.exit(2);
}

const log = (...a) => console.error(...a);

/** Map ai-svc difficulty (1|2 or free-form string) → BaselineDifficulty band. */
function mapDifficulty(d) {
  if (typeof d === "number") return d <= 1 ? "foundational" : "grade_level";
  const s = String(d ?? "").toLowerCase();
  if (["foundational", "approaching", "grade_level", "stretch"].includes(s)) {
    return s;
  }
  if (s === "easy") return "foundational";
  if (s === "moderate" || s === "medium") return "grade_level";
  if (s === "hard" || s === "challenge") return "stretch";
  return "grade_level";
}

/**
 * Synthetic parent assessment used to steer generation toward a grade band.
 * ai-svc personalizes primarily by functioning_level (a first-class param);
 * the grade hints here nudge content age-appropriateness. The bank tags items
 * with the requested band regardless.
 */
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

async function generateCell(gradeBand, level) {
  const body = {
    parent_assessment: syntheticParentAssessment(gradeBand),
    functioning_level: level,
  };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/api/ai/generate-baseline`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-internal-service": "bank-generator",
        "x-service-token": TOKEN,
      },
      body: JSON.stringify(body),
    });
    const took = ((Date.now() - started) / 1000).toFixed(0);
    if (!res.ok) {
      log(`    [${gradeBand}/${level}] HTTP ${res.status} in ${took}s — skip`);
      return [];
    }
    const data = await res.json();
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    log(
      `    [${gradeBand}/${level}] ${questions.length} questions in ${took}s (model=${data?.model ?? "?"})`,
    );
    return { questions, model: data?.model };
  } catch (e) {
    log(`    [${gradeBand}/${level}] ERROR ${e?.name}: ${e?.message}`);
    return { questions: [], model: undefined };
  } finally {
    clearTimeout(t);
  }
}

/** Normalize an ai-svc question into a bank item for a cell. */
function toBankItem(q, gradeBand, level) {
  const choices = Array.isArray(q?.options)
    ? q.options.map((o) => o?.label).filter((l) => typeof l === "string")
    : [];
  if (choices.length < 2) return null;
  const correct = q?.options?.find((o) => o?.value === q?.correctAnswer);
  const expectedAnswer =
    (correct && correct.label) ?? choices[0] ?? "";
  const choiceEmojis = Array.isArray(q?.options)
    ? q.options.map((o) => o?.emoji ?? "")
    : [];
  const hasEmoji = choiceEmojis.some((e) => e && e.length > 0);
  return {
    subject: q?.subject,
    gradeBand,
    functioningLevel: level,
    difficulty: mapDifficulty(q?.difficulty),
    prompt: q?.questionText ?? q?.prompt ?? "",
    choices,
    expectedAnswer,
    ...(hasEmoji ? { choiceEmojis } : {}),
    ...(q?.sceneEmoji ? { sceneEmoji: q.sceneEmoji } : {}),
    ...(q?.explanation ? { hint: q.explanation } : {}),
  };
}

const VALID_SUBJECTS = new Set([
  "math",
  "ela",
  "science",
  "speech",
  "sel",
  "life_skills",
  "executive_function",
]);

function dedupeKey(item) {
  return `${item.subject}|${item.gradeBand}|${item.functioningLevel}|${item.prompt.trim().toLowerCase()}`;
}

function countByCellSubject(items) {
  const counts = new Map();
  for (const it of items) {
    const k = `${it.gradeBand}|${it.functioningLevel}|${it.subject}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

async function main() {
  let bank = { version: 1, model: "curated-seed-v1", generatedAt: new Date().toISOString(), items: [] };
  if (existsSync(INPUT_JSON)) {
    try {
      bank = JSON.parse(readFileSync(INPUT_JSON, "utf8"));
      bank.items = Array.isArray(bank.items) ? bank.items : [];
      log(`Loaded ${bank.items.length} existing bank items from ${INPUT_JSON}`);
    } catch (e) {
      log(`Could not parse ${INPUT_JSON} (${e?.message}); starting fresh`);
    }
  }

  const seen = new Set(bank.items.map(dedupeKey));
  let lastModel = null;
  let added = 0;

  for (const gradeBand of GRADE_BANDS) {
    for (const level of LEVELS) {
      for (let pass = 1; pass <= PASSES; pass++) {
        const counts = countByCellSubject(bank.items);
        // Skip the cell entirely if every subject already meets the target.
        const subjectsAtTarget = [...VALID_SUBJECTS].every(
          (s) => (counts.get(`${gradeBand}|${level}|${s}`) ?? 0) >= TARGET_PER_SUBJECT,
        );
        if (subjectsAtTarget) {
          log(`  [${gradeBand}/${level}] at target — skip`);
          break;
        }
        log(`  Generating [${gradeBand}/${level}] pass ${pass}/${PASSES}`);
        const { questions, model } = await generateCell(gradeBand, level);
        if (model) lastModel = model;
        for (const q of questions) {
          const item = toBankItem(q, gradeBand, level);
          if (!item || !VALID_SUBJECTS.has(item.subject) || !item.prompt) continue;
          const k = dedupeKey(item);
          if (seen.has(k)) continue;
          // Respect the per-subject target so a cell doesn't get lopsided.
          const cs = `${gradeBand}|${level}|${item.subject}`;
          const have = bank.items.filter(
            (b) => b.gradeBand === gradeBand && b.functioningLevel === level && b.subject === item.subject,
          ).length;
          if (have >= TARGET_PER_SUBJECT) continue;
          seen.add(k);
          bank.items.push(item);
          added++;
        }
      }
    }
  }

  if (lastModel) bank.model = lastModel;
  bank.generatedAt = new Date().toISOString();
  bank.items.sort(
    (a, b) =>
      a.gradeBand.localeCompare(b.gradeBand) ||
      a.functioningLevel.localeCompare(b.functioningLevel) ||
      a.subject.localeCompare(b.subject),
  );

  const out = JSON.stringify(bank, null, 2);
  try {
    writeFileSync(OUTPUT_FILE, out + "\n");
    log(`\nWrote ${bank.items.length} items (+${added} new) to ${OUTPUT_FILE}`);
  } catch (e) {
    log(`\nCould not write ${OUTPUT_FILE} (${e?.message}); JSON on stdout instead`);
  }
  // Always emit to stdout so callers can capture it when the FS is read-only.
  process.stdout.write(out + "\n");
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
