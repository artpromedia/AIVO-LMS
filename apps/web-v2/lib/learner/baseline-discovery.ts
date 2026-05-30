/**
 * Phase B — server-side fetcher that POSTs to the assessment-svc
 * `/api/assessments/learner/discovery/:learnerId/chapter` route to
 * generate a single Discovery Adventure chapter's worth of activities
 * for a learner. Returns either a validated chapter payload (with rich
 * emoji-rich activities) or a tagged failure the caller can use to
 * fall back to the deterministic BANK.
 *
 * Parity reference:
 *   - services/assessment-svc/src/routes/learner-baseline.ts
 *     POST /api/assessments/learner/discovery/:learnerId/chapter
 *   - services/ai-svc/src/ai_svc/routes/generate.py
 *     /api/ai/generate-discovery-chapter
 *   - Legacy: apps/web/src/components/discovery/useDiscoveryEngine.ts
 *     (which the legacy aivo-ai-learning repo wired the same way).
 *
 * Phase B intentionally only exposes the fetch + validation + mapping
 * surface. Wiring into createBaseline is done in repos.ts.
 */
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { newId } from "@/lib/db/store";
import type {
  BaselineDifficulty,
  BaselineQuestion,
  Skill,
  Subject,
} from "@/lib/db/types";

export const DEFAULT_DISCOVERY_CHAPTER_TIMEOUT_MS = 180_000;

/**
 * Discovery Adventure chapter catalog. Mirrors the legacy
 * `ADVENTURE_CHAPTERS` constant in
 * apps/web/src/components/discovery/useDiscoveryEngine.ts. The order
 * is the proctor-facing sequence (ELA → Math → Science → SEL →
 * Speech → Executive Function).
 *
 * `webV2SubjectSlug` maps the chapter onto the web-v2 store's
 * Subject.slug so we can persist generated questions under the right
 * subject row. Chapters whose subject isn't seeded in the local store
 * are skipped gracefully.
 */
export type DiscoveryChapterSpec = {
  id: string;
  title: string;
  subtitle: string;
  domain: string;
  tutorKey: string;
  sceneDescription: string;
  /** Web-v2 store Subject.slug this chapter maps onto. */
  webV2SubjectSlug: string;
};

export const ADVENTURE_CHAPTERS: ReadonlyArray<DiscoveryChapterSpec> = [
  {
    id: "sage_story_garden",
    title: "Sage's Story Garden",
    subtitle: "Words bloom where stories grow",
    domain: "ela",
    tutorKey: "sage",
    sceneDescription:
      "A sunlit garden where letters grow on vines and friendly story creatures whisper rhymes.",
    webV2SubjectSlug: "reading",
  },
  {
    id: "nova_number_galaxy",
    title: "Nova's Number Galaxy",
    subtitle: "Count the stars, solve the sky",
    domain: "math",
    tutorKey: "nova",
    sceneDescription:
      "A starry galaxy where numbers float as constellations and asteroids hold counting puzzles.",
    webV2SubjectSlug: "math",
  },
  {
    id: "spark_discovery_lab",
    title: "Spark's Discovery Lab",
    subtitle: "Tinker, observe, wonder",
    domain: "science",
    tutorKey: "spark",
    sceneDescription:
      "A cozy science lab with bubbling beakers, weather charts, and friendly lab tools.",
    webV2SubjectSlug: "science",
  },
  {
    id: "harmony_feelings_treehouse",
    title: "Harmony's Feelings Treehouse",
    subtitle: "All feelings are welcome here",
    domain: "sel",
    tutorKey: "harmony",
    sceneDescription:
      "A warm treehouse with cushions, feeling cards on the wall, and a window into a kind community.",
    webV2SubjectSlug: "social",
  },
  {
    id: "echo_sound_studio",
    title: "Echo's Sound Studio",
    subtitle: "Listen, repeat, speak it loud",
    domain: "speech",
    tutorKey: "echo",
    sceneDescription:
      "A bright recording studio with soft headphones, sound waves on the wall, and a friendly mic.",
    webV2SubjectSlug: "speech",
  },
  {
    id: "pixel_puzzle_palace",
    title: "Pixel's Puzzle Palace",
    subtitle: "Patterns, plans, and clever moves",
    domain: "executive_function",
    tutorKey: "pixel",
    sceneDescription:
      "A cheerful palace of patterns, puzzle boxes, and step-by-step planning quests.",
    webV2SubjectSlug: "executive-function",
  },
];

export type DiscoveryChapterFailureReason =
  | "network_error"
  | "timeout"
  | "non_2xx"
  | "invalid_json"
  | "schema_validation_failed"
  | "no_activities";

export type DiscoveryChapterResult =
  | { ok: true; response: DiscoveryChapterResponse }
  | {
      ok: false;
      reason: DiscoveryChapterFailureReason;
      status?: number;
      message: string;
    };

// ---- Schema -----------------------------------------------------------------

/**
 * The /chapter endpoint returns surface-normalized activities. Each
 * activity may be an MCQ, a tap_image, drag_sort, scratchpad, etc.;
 * Phase B only consumes the MCQ-ish fields (id, question/narration,
 * choices, sceneEmoji) and stashes the surface spec for future
 * SurfaceHost rendering.
 *
 * We accept choices in both `interaction.choices` (legacy /
 * normalized) and a top-level `choices` array as a defensive measure.
 */
const choiceSchema = z.object({
  id: z.string().min(1).max(200),
  label: z.string().min(1).max(500),
  emoji: z.string().max(32).optional(),
  isCorrect: z.boolean().optional(),
});

const activitySchema = z
  .object({
    id: z.string().min(1).max(200),
    title: z.string().max(500).optional(),
    narration: z.string().max(4000).optional(),
    tutorLine: z.string().max(2000).optional(),
    questionText: z.string().max(2000).optional(),
    sceneEmoji: z.string().max(32).optional(),
    sceneDescription: z.string().max(2000).optional(),
    imageUrl: z.string().url().max(2000).optional(),
    imageAlt: z.string().max(500).optional(),
    difficulty: z.string().max(100).optional(),
    interaction: z
      .object({
        type: z.string().optional(),
        choices: z.array(choiceSchema).optional(),
      })
      .passthrough()
      .optional(),
    choices: z.array(choiceSchema).optional(),
    surface: z.record(z.unknown()).optional(),
  })
  .passthrough();

const discoveryChapterResponseSchema = z.object({
  generated: z.boolean().optional(),
  learnerId: z.string().optional(),
  functioningLevel: z.string().optional(),
  chapterId: z.string().optional(),
  personalizationLevel: z.enum(["full", "partial"]).optional(),
  source: z.string().optional(),
  activities: z.array(activitySchema),
  model: z.string().optional(),
});

export type DiscoveryChapterResponse = z.infer<typeof discoveryChapterResponseSchema>;
export type DiscoveryActivity = z.infer<typeof activitySchema>;
export type DiscoveryChoice = z.infer<typeof choiceSchema>;

// ---- Fetcher ----------------------------------------------------------------

export type GenerateDiscoveryChapterInput = {
  /** Learner whose adventure we're generating. */
  learnerId: string;
  /** Chapter spec posted to the assessment-svc. */
  chapter: DiscoveryChapterSpec;
  /** Override the default request timeout. */
  timeoutMs?: number;
  /** Override the default fetch (test seam). */
  fetchImpl?: typeof fetch;
  /** Override the assessment-svc base URL (test seam). */
  baseUrl?: string;
};

export function discoveryChapterEndpoint(learnerId: string, baseUrl?: string): string {
  const resolved = baseUrl ?? serverEnv.ASSESSMENT_SVC_URL ?? "http://localhost:3071";
  const base = resolved.replace(/\/+$/, "");
  return `${base}/api/assessments/learner/discovery/${encodeURIComponent(learnerId)}/chapter`;
}

export async function generateDiscoveryChapter(
  input: GenerateDiscoveryChapterInput,
): Promise<DiscoveryChapterResult> {
  const {
    learnerId,
    chapter,
    timeoutMs = DEFAULT_DISCOVERY_CHAPTER_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    baseUrl,
  } = input;
  const endpoint = discoveryChapterEndpoint(learnerId, baseUrl);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN
          ? {
              "x-internal-service": "web-v2",
              "x-service-token": serverEnv.ASSESSMENT_SVC_SERVICE_TOKEN,
            }
          : {}),
      },
      body: JSON.stringify({
        chapter: {
          id: chapter.id,
          title: chapter.title,
          subtitle: chapter.subtitle,
          domain: chapter.domain,
          tutorKey: chapter.tutorKey,
          sceneDescription: chapter.sceneDescription,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const aborted =
      err instanceof Error && err.name === "AbortError";
    const reason: DiscoveryChapterFailureReason = aborted ? "timeout" : "network_error";
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      { endpoint, reason, message },
      "baseline-discovery: fetch failed",
    );
    return { ok: false, reason, message };
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn(
      { endpoint, status: res.status, body: text.slice(0, 500) },
      "baseline-discovery: non-2xx from assessment-svc",
    );
    return {
      ok: false,
      reason: "non_2xx",
      status: res.status,
      message: `assessment-svc returned ${res.status}`,
    };
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch (err) {
    return {
      ok: false,
      reason: "invalid_json",
      message: err instanceof Error ? err.message : "invalid JSON",
    };
  }

  const parsed = discoveryChapterResponseSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn(
      { endpoint, issues: parsed.error.flatten() },
      "baseline-discovery: response failed schema validation",
    );
    return {
      ok: false,
      reason: "schema_validation_failed",
      message: parsed.error.message,
    };
  }

  if (parsed.data.activities.length === 0) {
    return {
      ok: false,
      reason: "no_activities",
      message: "chapter response carried zero activities",
    };
  }

  return { ok: true, response: parsed.data };
}

// ---- Mapper -----------------------------------------------------------------

export type MapDiscoveryActivitiesInput = {
  baselineId: string;
  chapter: DiscoveryChapterSpec;
  activities: DiscoveryActivity[];
  subjects: Subject[];
  skills: Skill[];
  accommodationTags: string[];
  /** Initial order index — chapters are flattened sequentially. */
  startOrder: number;
};

/**
 * Convert a chapter's `activities` into web-v2 `BaselineQuestion`
 * rows. Activities without a usable MCQ-style choice list are skipped
 * (these are slated for SurfaceHost rendering later). Choices may
 * arrive on either `activity.interaction.choices` (surface-normalized)
 * or `activity.choices` (legacy fallback).
 *
 * Returns the produced questions plus the next `order` index so a
 * subsequent chapter can continue numbering without collisions.
 */
export function mapDiscoveryActivitiesToBaselineQuestions(
  input: MapDiscoveryActivitiesInput,
): { questions: BaselineQuestion[]; nextOrder: number } {
  const { baselineId, chapter, activities, subjects, skills, accommodationTags } = input;

  const subject = subjects.find((s) => s.slug === chapter.webV2SubjectSlug);
  if (!subject) {
    return { questions: [], nextOrder: input.startOrder };
  }
  const skill = skills.find((sk) => sk.subjectId === subject.id);
  if (!skill) {
    return { questions: [], nextOrder: input.startOrder };
  }

  const out: BaselineQuestion[] = [];
  let order = input.startOrder;

  for (const activity of activities) {
    const choices = activity.interaction?.choices ?? activity.choices ?? [];
    if (choices.length < 2) continue;

    const correct = choices.find((c) => c.isCorrect);
    const prompt =
      activity.questionText ??
      activity.narration ??
      activity.tutorLine ??
      activity.title ??
      "Choose one";

    order += 1;
    const choiceEmojis = choices.map((c) => c.emoji ?? "");
    const hasAnyEmoji = choiceEmojis.some((e) => e.length > 0);

    out.push({
      id: newId("bq"),
      baselineId,
      subjectId: subject.id,
      skillId: skill.id,
      order,
      prompt,
      choices: choices.map((c) => c.label),
      choiceEmojis: hasAnyEmoji ? choiceEmojis : undefined,
      sceneEmoji: activity.sceneEmoji,
      imageUrl: activity.imageUrl,
      imageAlt: activity.imageAlt ?? activity.sceneDescription,
      expectedAnswer: correct?.label,
      hint: activity.tutorLine,
      readAloudText: prompt,
      difficulty: mapDiscoveryDifficulty(activity.difficulty),
      accommodationTags,
    });
  }
  return { questions: out, nextOrder: order };
}

function mapDiscoveryDifficulty(raw: string | undefined): BaselineDifficulty {
  if (!raw) return "grade_level";
  const v = raw.toLowerCase();
  if (v.includes("found") || v === "easy" || v.includes("intro")) {
    return "foundational";
  }
  if (v.includes("approach") || v.includes("emerging")) return "approaching";
  if (v.includes("stretch") || v === "hard" || v.includes("advanced")) {
    return "stretch";
  }
  return "grade_level";
}
