/**
 * Wave D (G3) — draft content-pack builders for the imported catalogue.
 *
 * Pure functions consumed by `scripts/generate-draft-packs.ts`: they turn
 * catalogue skills (the OFFICIAL standards imported by import_ccss.py)
 * into schema-valid DRAFT ContentPacks for the content-CMS review queue.
 * Nothing built here is publishable without the existing human publish
 * action — every prompt carries the official standard text verbatim and
 * the pack title is explicitly marked as a draft.
 *
 * Two activity sources:
 *   - `outline`  — deterministic authoring scaffolds derived from the
 *     standard's official text (teach → check → reflect shells an author
 *     replaces with real items). No LLM, runs anywhere.
 *   - `ai`       — the CLI requests activities from ai-svc per skill
 *     (quality gate ON) and parses them with `parseAiActivities`; any
 *     parse/validation failure falls back to the outline scaffold so a
 *     batch never half-fails silently.
 */
import type { ContentPack } from "@aivo/content-pack";

export interface CatalogueSkill {
  id: string;
  subject: string;
  gradeBand: string;
  label: string;
  summary: string;
  source: string;
}

type Activity = ContentPack["activities"][number];

/** Deterministic teach → check → reflect scaffold for one skill. */
export function buildOutlineActivities(skill: CatalogueSkill): Activity[] {
  const standard = skill.source || skill.id;
  return [
    {
      id: `${skill.id}--teach`,
      title: `Teach: ${skill.label}`,
      skillId: skill.id,
      type: "narration",
      prompt:
        `[DRAFT OUTLINE — author the real explanation before publishing] ` +
        `Standard ${standard}: ${skill.summary}`,
      difficulty: "intro",
    },
    {
      id: `${skill.id}--check`,
      title: `Check: ${skill.label}`,
      skillId: skill.id,
      type: "multiple_choice",
      prompt:
        `[DRAFT OUTLINE — replace with a real assessment item] ` +
        `Which statement matches what you practiced? (${standard})`,
      difficulty: "core",
      choices: [
        { id: "correct", label: skill.label, correct: true },
        { id: "d1", label: "Something we have not learned yet" },
        { id: "d2", label: "A different skill" },
      ],
    },
    {
      id: `${skill.id}--reflect`,
      title: `Reflect: ${skill.label}`,
      skillId: skill.id,
      type: "narration",
      prompt:
        `[DRAFT OUTLINE — author the wrap-up before publishing] ` +
        `Today's goal was: ${skill.label}.`,
      difficulty: "intro",
    },
  ];
}

const ALLOWED_TYPES = new Set([
  "narration",
  "multiple_choice",
  "drag_drop",
  "voice",
  "draw",
  "tap",
  "match",
  "video",
  "audio",
]);
const ALLOWED_DIFFICULTY = new Set(["intro", "core", "stretch"]);

/**
 * Parse an ai-svc completion into activities for one skill. Tolerant of a
 * fenced ```json block or surrounding prose; strict about the result —
 * anything that does not produce ≥1 well-formed activity returns null and
 * the caller uses the outline scaffold instead.
 */
export function parseAiActivities(content: string, skill: CatalogueSkill): Activity[] | null {
  const text = (content ?? "").trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const out: Activity[] = [];
  for (let i = 0; i < raw.length && out.length < 5; i++) {
    const a = raw[i] as Record<string, unknown>;
    if (!a || typeof a !== "object") continue;
    const type = String(a.type ?? "");
    const prompt = String(a.prompt ?? "").trim();
    if (!ALLOWED_TYPES.has(type) || prompt.length < 10) continue;
    const difficulty = ALLOWED_DIFFICULTY.has(String(a.difficulty))
      ? (String(a.difficulty) as Activity["difficulty"])
      : "core";
    const choicesRaw = Array.isArray(a.choices) ? a.choices : undefined;
    const choices = choicesRaw
      ?.filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
      .map((c, j) => ({
        id: String(c.id ?? `c${j}`),
        label: String(c.label ?? "").trim(),
        ...(c.correct === true ? { correct: true } : {}),
      }))
      .filter((c) => c.label.length > 0);
    if (type === "multiple_choice" || type === "tap" || type === "match") {
      if (!choices || choices.length < 2 || !choices.some((c) => c.correct)) continue;
    }
    out.push({
      id: `${skill.id}--ai-${out.length + 1}`,
      title: String(a.title ?? skill.label).slice(0, 120),
      skillId: skill.id,
      type: type as Activity["type"],
      prompt,
      difficulty,
      ...(choices && choices.length > 0 ? { choices } : {}),
    });
  }
  return out.length > 0 ? out : null;
}

/** Domain refs for `skillGraphRefs`: ccss.math.3.nf.a.1 → ccss.math.3.nf. */
export function skillGraphRefsFor(skills: CatalogueSkill[]): string[] {
  const refs = new Set<string>();
  for (const s of skills) {
    const parts = s.id.split(".");
    refs.add(parts.slice(0, Math.min(4, parts.length - 1)).join("."));
  }
  return [...refs].sort();
}

export function buildDraftPack(input: {
  subject: string;
  gradeBand: string;
  skills: CatalogueSkill[];
  activitiesBySkill: Map<string, Activity[]>;
  generatedAtIso: string;
  generator: "outline" | "ai";
}): ContentPack {
  const band = input.gradeBand.toLowerCase();
  const activities = input.skills.flatMap(
    (s) => input.activitiesBySkill.get(s.id) ?? buildOutlineActivities(s),
  );
  return {
    id: `ccss-draft-${input.subject}-${band}`,
    title: `[DRAFT] CCSS ${input.subject.toUpperCase()} Grade ${input.gradeBand} — generated ${input.generator} scaffolds`,
    version: "0.1.0",
    schemaVersion: 1,
    subject: input.subject,
    gradeBand: input.gradeBand,
    skillGraphRefs: skillGraphRefsFor(input.skills),
    publisher: { name: "AIVO Draft Generator (Wave D)" },
    license: "CC BY 3.0 US (standards text); activities pending review",
    publishedAt: input.generatedAtIso,
    assets: [],
    activities,
  };
}
