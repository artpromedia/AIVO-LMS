#!/usr/bin/env tsx
/**
 * Wave D (G3) — batch DRAFT content-pack generation for the imported
 * catalogue.
 *
 * For every (subject × grade band) cell in the curriculum snapshot whose
 * skills lack a CMS pack, builds a DRAFT ContentPack and upserts it into
 * the content-CMS PackStore (`content_packs`, status stays `draft`).
 * Publishing remains the existing human CMS action — nothing this script
 * writes can reach a learner without review.
 *
 * Modes:
 *   --mode ai       (default) request activities per skill from ai-svc
 *                   `/api/ai/generate` (the existing quality gate runs
 *                   server-side; a failed gate or unparseable response
 *                   falls back to the outline scaffold for THAT skill —
 *                   recorded in the report, never silent).
 *   --mode outline  deterministic standards-derived authoring scaffolds —
 *                   no LLM dependency (CI / air-gapped environments).
 *
 * Usage:
 *   DATABASE_URL=postgres://… pnpm exec tsx services/admin-svc/scripts/generate-draft-packs.ts \
 *     [--mode ai|outline] [--subject math] [--grade-band 3] [--dry-run out.json]
 *
 * ai mode also needs: AI_SVC_URL (default http://localhost:3004) and
 * INTERNAL_AI_TOKEN when ai-svc enforces its internal-auth header.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "@aivo/db";
import { createPackStore, validateContentPack } from "../src/lib/pack-store.js";
import {
  buildDraftPack,
  buildOutlineActivities,
  parseAiActivities,
  type CatalogueSkill,
} from "../src/lib/draft-pack-builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const args = process.argv.slice(2);
function argValue(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const MODE = (argValue("mode") ?? "ai") as "ai" | "outline";
const ONLY_SUBJECT = argValue("subject");
const ONLY_BAND = argValue("grade-band");
const DRY_RUN = argValue("dry-run");
const SNAPSHOT = argValue("snapshot")
  ?? join(repoRoot, "services/curriculum-svc/src/curriculum_svc/data/skill_graphs.json");

const AI_SVC_URL = (process.env.AI_SVC_URL ?? "http://localhost:3004").replace(/\/$/, "");
const INTERNAL_AI_TOKEN = process.env.INTERNAL_AI_TOKEN;

async function aiActivitiesFor(skill: CatalogueSkill) {
  const res = await fetch(`${AI_SVC_URL}/api/ai/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(INTERNAL_AI_TOKEN ? { "X-Internal-Auth": INTERNAL_AI_TOKEN } : {}),
    },
    body: JSON.stringify({
      subject: skill.subject,
      topic: skill.label,
      grade_target: skill.gradeBand,
      delivery_level: skill.gradeBand,
      content_type: "LESSON",
      brain_context: {
        draft_pack_generator: true,
        instruction:
          "Return ONLY a JSON array of 3 activities for this exact standard. " +
          `Standard ${skill.source}: ${skill.summary} ` +
          'Each: {"title","type","prompt","difficulty","choices?"} with type in ' +
          '["narration","multiple_choice","tap"], difficulty in ["intro","core","stretch"]; ' +
          "multiple_choice/tap need >=3 choices with exactly one {\"correct\":true}.",
      },
      max_tokens: 1200,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return { activities: null, reason: `ai_http_${res.status}` };
  const data = (await res.json()) as { content?: string; quality_gate_passed?: boolean };
  if (data.quality_gate_passed === false) return { activities: null, reason: "quality_gate" };
  const parsed = parseAiActivities(data.content ?? "", skill);
  return parsed
    ? { activities: parsed, reason: null }
    : { activities: null, reason: "unparseable" };
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as {
  skills: CatalogueSkill[];
};
const cells = new Map<string, CatalogueSkill[]>();
for (const s of snapshot.skills) {
  if (ONLY_SUBJECT && s.subject !== ONLY_SUBJECT) continue;
  if (ONLY_BAND && s.gradeBand !== ONLY_BAND) continue;
  // Draft generation targets the CCSS import (official provenance only).
  if (!s.source?.startsWith("CCSS.")) continue;
  const key = `${s.subject}|${s.gradeBand}`;
  const list = cells.get(key) ?? [];
  list.push(s);
  cells.set(key, list);
}
if (cells.size === 0) {
  console.error("no matching catalogue cells — check --subject/--grade-band filters");
  process.exit(1);
}

const report: Record<string, unknown>[] = [];
const dryRunPacks: unknown[] = [];

const store = DRY_RUN
  ? null
  : createPackStore(
      (() => {
        if (!process.env.DATABASE_URL) {
          console.error("DATABASE_URL is required (or use --dry-run <out.json>)");
          process.exit(1);
        }
        return createDb(process.env.DATABASE_URL);
      })(),
    );

for (const [key, skills] of [...cells.entries()].sort()) {
  const [subject, gradeBand] = key.split("|");
  skills.sort((a, b) => a.id.localeCompare(b.id));
  const activitiesBySkill = new Map<string, ReturnType<typeof buildOutlineActivities>>();
  let aiOk = 0;
  let aiFallback = 0;
  for (const skill of skills) {
    if (MODE === "ai") {
      const { activities, reason } = await aiActivitiesFor(skill);
      if (activities) {
        activitiesBySkill.set(skill.id, activities);
        aiOk += 1;
      } else {
        activitiesBySkill.set(skill.id, buildOutlineActivities(skill));
        aiFallback += 1;
        process.stderr.write(`  ${skill.id}: ai fallback (${reason})\n`);
      }
    } else {
      activitiesBySkill.set(skill.id, buildOutlineActivities(skill));
    }
  }
  const pack = buildDraftPack({
    subject: subject!,
    gradeBand: gradeBand!,
    skills,
    activitiesBySkill,
    generatedAtIso: new Date().toISOString(),
    generator: MODE,
  });
  const issues = validateContentPack(pack);
  if (issues.length > 0) {
    console.error(`✗ ${pack.id}: ${issues.length} validation issue(s) — first: ${issues[0]}`);
    process.exit(1);
  }
  if (store) {
    const rec = await store.upsert(pack);
    if (rec.status !== "draft") {
      // Refreshing an already-published pack must never silently change
      // live content — surface it and stop.
      console.error(`✗ ${pack.id} is already PUBLISHED — refusing to overwrite a live pack.`);
      process.exit(1);
    }
    await store.setValidation(pack.id, {
      ok: true,
      issueCount: 0,
      ranAt: new Date().toISOString(),
    });
  } else {
    dryRunPacks.push(pack);
  }
  report.push({
    pack: pack.id,
    skills: skills.length,
    activities: pack.activities.length,
    mode: MODE,
    aiOk,
    aiFallback,
  });
  console.log(
    `✓ ${pack.id}: ${skills.length} skills → ${pack.activities.length} draft activities` +
      (MODE === "ai" ? ` (ai ${aiOk}, outline-fallback ${aiFallback})` : ""),
  );
}

if (DRY_RUN) {
  writeFileSync(DRY_RUN, JSON.stringify({ report, packs: dryRunPacks }, null, 1) + "\n");
  console.log(`dry run: wrote ${dryRunPacks.length} draft pack(s) to ${DRY_RUN}`);
} else {
  console.log(`done: ${report.length} draft pack(s) upserted (status=draft; publish via the CMS).`);
}
