/**
 * Tutor provider chain + task-aware routing.
 *
 * The product runs on a multi-provider model: Anthropic (Claude) is the
 * primary, with OpenAI and Google as automatic fallbacks so a single provider
 * outage never blocks a learner. On top of resilience, routing lets the system
 * pick the best-suited provider order PER TASK (e.g. reasoning/math lead with
 * Claude; speech leads with OpenAI) — adjust `TASK_PROVIDER_PREFERENCE` to
 * re-rank a task without touching any call site.
 *
 * `getTutorProviderChain(task)` returns the ordered, key-filtered list of
 * provider instances; `generateLessonPlanWithFallback` (lib/ai/tutor.ts) walks
 * it primary-first and only fails once every configured provider is exhausted.
 */
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import type { Subject } from "@/lib/db/types";
import type { TutorProvider } from "./tutor";
import { createAnthropicTutorProvider } from "./anthropic-tutor";
import { createOpenAITutorProvider } from "./openai-tutor";
import { createGoogleTutorProvider } from "./google-tutor";

export type TutorProviderName = "anthropic" | "openai" | "google";

/** Routing task buckets — the granularity at which provider order can differ. */
export type TutorTask = "lesson" | "math" | "reading" | "writing" | "science" | "speech";

/**
 * Per-task provider preference (primary first). Anthropic (Claude Opus) leads
 * the reasoning-heavy tasks; OpenAI/Google fall in behind as resilience. This
 * is the single knob for "which platform is best for what" — re-rank a row to
 * change a task's routing fleet-wide.
 */
export const TASK_PROVIDER_PREFERENCE: Record<TutorTask, TutorProviderName[]> = {
  lesson: ["anthropic", "openai", "google"],
  math: ["anthropic", "openai", "google"],
  reading: ["anthropic", "openai", "google"],
  writing: ["anthropic", "openai", "google"],
  science: ["anthropic", "google", "openai"],
  // Speech leans on OpenAI first (its audio stack); kept here so a future
  // speech generation path shares the same routing surface.
  speech: ["openai", "google", "anthropic"],
};

/** Map a subject to its routing task; defaults to the generic lesson chain. */
export function taskForSubject(subject: Pick<Subject, "slug"> | null | undefined): TutorTask {
  const slug = subject?.slug ?? "";
  if (/math|number|numeracy|algebra|geometry|count/i.test(slug)) return "math";
  if (/read|literacy|ela|english|phonics/i.test(slug)) return "reading";
  if (/writ|composition/i.test(slug)) return "writing";
  if (/science|stem|biology|chemistry|physics/i.test(slug)) return "science";
  return "lesson";
}

// Memoize provider instances so SDK clients aren't reconstructed per request.
const providerCache = new Map<TutorProviderName, TutorProvider | null>();

function resolveProvider(name: TutorProviderName): TutorProvider | null {
  if (providerCache.has(name)) return providerCache.get(name) ?? null;
  let provider: TutorProvider | null = null;
  if (name === "anthropic" && serverEnv.ANTHROPIC_API_KEY) {
    provider = createAnthropicTutorProvider(new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY }));
  } else if (name === "openai" && serverEnv.OPENAI_API_KEY) {
    provider = createOpenAITutorProvider({ apiKey: serverEnv.OPENAI_API_KEY });
  } else if (name === "google" && serverEnv.GOOGLE_API_KEY) {
    provider = createGoogleTutorProvider({ apiKey: serverEnv.GOOGLE_API_KEY });
  }
  providerCache.set(name, provider);
  return provider;
}

/**
 * Build the ordered, key-filtered tutor provider chain for a task.
 *
 * Order = the task's preference list, with `AI_PROVIDER` (the deploy's declared
 * primary) promoted to the front when it names a real provider. Providers whose
 * key is absent are dropped, so a deploy with only some keys still gets a valid
 * (shorter) chain. In development/test with no keys the chain is empty and the
 * orchestrator serves the deterministic plan.
 */
export function getTutorProviderChain(task: TutorTask = "lesson"): TutorProvider[] {
  const preference = [...(TASK_PROVIDER_PREFERENCE[task] ?? TASK_PROVIDER_PREFERENCE.lesson)];

  // Promote the configured primary to the front of every chain.
  const primary = serverEnv.AI_PROVIDER;
  if (primary === "anthropic" || primary === "openai" || primary === "google") {
    const idx = preference.indexOf(primary);
    if (idx > 0) preference.splice(idx, 1);
    if (idx !== 0) preference.unshift(primary);
  }

  const seen = new Set<TutorProviderName>();
  const chain: TutorProvider[] = [];
  for (const name of preference) {
    if (seen.has(name)) continue;
    seen.add(name);
    const provider = resolveProvider(name);
    if (provider) chain.push(provider);
  }
  return chain;
}

/** Test-only: clear memoized provider instances so env changes take effect. */
export function resetTutorProviderChainForTest(): void {
  providerCache.clear();
}
