/**
 * Baseline image resolution.
 *
 * Turns abstract "find the cat" prompts into actual pictures of a cat so
 * early-learner baselines feel like the legacy Discovery Adventure UI
 * even when no upstream image-generation service is wired up.
 *
 * Strategy (cheapest-first):
 *   1. If the question already carries `imageUrl`, use it.
 *   2. If the question carries `sceneEmoji`, map that emoji to a high-res
 *      Twemoji SVG hosted on jsDelivr. Twemoji is Twitter's open-source
 *      emoji set (CC-BY 4.0) which renders the actual concept (a real
 *      cartoon cat for 🐱, a yellow sun for ☀️). This is free, has no
 *      API key, is COPPA-safe (no GenAI media served to minors), and is
 *      deterministic so the same baseline always shows the same picture.
 *   3. As a final fallback we keyword-match against the question prompt
 *      for the ~50 most common K-2 nouns and reuse the Twemoji mapping
 *      so even LLM-authored questions that forgot to attach a
 *      `sceneEmoji` still render a picture.
 *
 * The shape is provider-pluggable: a future
 * `AIVO_FEATURE_BASELINE_IMAGE_GEN=openai` path can override step 2 with
 * a real call to OpenAI's images endpoint (or any other generator) and
 * cache the result by `(emoji|keyword)` so each unique concept is
 * generated at most once across the fleet.
 */

const TWEMOJI_CDN_BASE =
  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

/**
 * Read the ai-svc baseline-image endpoint base URL from the environment.
 *
 * When this is set (e.g. ``https://ai.aivo.io/api/ai/baseline-image``
 * in prod, ``http://ai-svc:3004/api/ai/baseline-image`` in-cluster),
 * the resolver returns ai-svc URLs instead of direct Twemoji CDN URLs.
 * The ai-svc endpoint either serves a generated cartoon picture or
 * 302-redirects to the same Twemoji asset, so the caller's ``<img src>``
 * works identically either way.
 *
 * Reading at module-load is safe because this module is only imported
 * by server components / server actions in web-v2. On the client the
 * env var would be undefined and we'd silently fall back to Twemoji.
 */
/**
 * Returns ``true`` when the given URL is safe to serve to a browser:
 * https-scheme and a publicly-resolvable hostname. Internal cluster
 * URLs (``*.svc.cluster.local``, bare service names like ``ai-svc``,
 * loopback addresses) are rejected so they never leak into an
 * ``<img src>`` rendered on a public page.
 */
function isPublicHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost") return false;
  if (host.endsWith(".svc.cluster.local")) return false;
  if (host.endsWith(".local")) return false;
  // Bare single-label hostnames (e.g. ``ai-svc``) only resolve inside
  // the cluster — refuse to emit them to the browser.
  if (!host.includes(".")) return false;
  // Loopback / link-local literals.
  if (host === "127.0.0.1" || host === "::1" || host.startsWith("169.254.")) {
    return false;
  }
  return true;
}

function getAiSvcImageBase(): string | undefined {
  // Prefer the explicit override, then derive from AI_SVC_URL.
  const explicit = process.env.AIVO_BASELINE_IMAGE_BASE_URL?.trim();
  if (explicit) {
    const trimmed = explicit.replace(/\/+$/, "");
    return isPublicHttpsUrl(trimmed) ? trimmed : undefined;
  }
  const aiSvc = process.env.AI_SVC_URL?.trim();
  if (aiSvc) {
    const candidate = `${aiSvc.replace(/\/+$/, "")}/api/ai/baseline-image`;
    return isPublicHttpsUrl(candidate) ? candidate : undefined;
  }
  return undefined;
}

/**
 * Compose the ai-svc image URL for a given concept (emoji or keyword).
 * Returns ``undefined`` when no base URL is configured.
 *
 * ``tenantId`` / ``learnerId`` are appended as query params (rather than
 * sent as headers) because ``<img src>`` cannot set custom HTTP
 * headers from the browser. The ai-svc route accepts both forms; the
 * tenant id is needed for the per-tenant budget ledger pre-flight on
 * cache misses. Pass ``undefined`` to skip ledger attribution (e.g.
 * for unauthenticated marketing/preview surfaces).
 */
export function aiSvcImageUrl(
  concept: string,
  opts: { tenantId?: string; learnerId?: string } = {},
): string | undefined {
  const base = getAiSvcImageBase();
  if (!base || !concept) return undefined;
  const params = new URLSearchParams({ concept });
  if (opts.tenantId) params.set("tenant_id", opts.tenantId);
  if (opts.learnerId) params.set("learner_id", opts.learnerId);
  return `${base}?${params.toString()}`;
}

/**
 * Convert a single emoji (possibly multi-codepoint, e.g. 👨‍👩‍👧) into a
 * Twemoji filename slug. Twemoji's naming convention is the hex
 * codepoints separated by `-`, with the FE0F variation selector
 * stripped UNLESS the emoji is a regional indicator pair.
 */
export function emojiToTwemojiSlug(emoji: string): string | undefined {
  if (!emoji) return undefined;
  const codepoints: string[] = [];
  // Iterate by code point (so 4-byte emoji are read as one unit).
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // Skip FE0F (variation selector-16) — Twemoji omits it from
    // filenames except for keycap sequences.
    if (cp === 0xfe0f) continue;
    codepoints.push(cp.toString(16));
  }
  if (codepoints.length === 0) return undefined;
  return codepoints.join("-");
}

/** Full CDN URL for an emoji, or undefined if the input is empty. */
export function emojiToImageUrl(emoji: string | undefined): string | undefined {
  if (!emoji) return undefined;
  const slug = emojiToTwemojiSlug(emoji);
  if (!slug) return undefined;
  return `${TWEMOJI_CDN_BASE}/${slug}.svg`;
}

/**
 * Curated keyword → emoji map for the ~50 most common K-2 baseline
 * nouns. Used only as a last-resort fallback when neither `imageUrl`
 * nor `sceneEmoji` is present on the question. Keys are lowercase.
 *
 * Keep this list short and high-signal — adding rare nouns risks false
 * positives (e.g. "kid" matching "skid").
 */
const KEYWORD_TO_EMOJI: Readonly<Record<string, string>> = Object.freeze({
  cat: "🐱",
  kitten: "🐱",
  dog: "🐶",
  puppy: "🐶",
  bird: "🐦",
  fish: "🐟",
  cow: "🐮",
  pig: "🐷",
  horse: "🐴",
  rabbit: "🐰",
  bunny: "🐰",
  mouse: "🐭",
  bear: "🐻",
  lion: "🦁",
  tiger: "🐯",
  elephant: "🐘",
  monkey: "🐵",
  frog: "🐸",
  duck: "🦆",
  butterfly: "🦋",
  bee: "🐝",
  // weather / nature
  sun: "☀️",
  sunny: "☀️",
  moon: "🌙",
  star: "⭐",
  cloud: "☁️",
  rain: "🌧️",
  rainy: "🌧️",
  snow: "❄️",
  snowflake: "❄️",
  tree: "🌳",
  flower: "🌸",
  // food
  apple: "🍎",
  banana: "🍌",
  bread: "🍞",
  cake: "🎂",
  pizza: "🍕",
  milk: "🥛",
  water: "💧",
  ice: "🧊",
  // vehicles & objects
  car: "🚗",
  bus: "🚌",
  truck: "🚚",
  bike: "🚲",
  bicycle: "🚲",
  boat: "⛵",
  plane: "✈️",
  airplane: "✈️",
  ball: "⚽",
  book: "📖",
  // people / faces
  smile: "😊",
  happy: "😊",
  sad: "😢",
  cry: "😢",
  crying: "😢",
  angry: "😠",
  mad: "😠",
  surprised: "😮",
  sleeping: "😴",
  baby: "👶",
  // shapes / colors (single-shape best-guess)
  circle: "⭕",
  square: "🟥",
  triangle: "🔺",
  heart: "❤️",
  red: "🟥",
  blue: "🟦",
  green: "🟩",
  yellow: "🟨",
  orange: "🟧",
  purple: "🟪",
  // hand / body cues
  hand: "✋",
  eye: "👁️",
  ear: "👂",
  nose: "👃",
  mouth: "👄",
});

/**
 * Scan a freeform prompt for the first keyword that has a known emoji
 * mapping. Word-boundary regex so "scared" doesn't match "car".
 */
export function keywordMatchEmoji(prompt: string | undefined): string | undefined {
  if (!prompt) return undefined;
  const lower = prompt.toLowerCase();
  for (const [keyword, emoji] of Object.entries(KEYWORD_TO_EMOJI)) {
    const re = new RegExp(`\\b${keyword}\\b`, "i");
    if (re.test(lower)) return emoji;
  }
  return undefined;
}

export interface ResolvedBaselineImage {
  imageUrl?: string;
  imageAlt?: string;
  /** The emoji that was matched/used (always set when imageUrl is set). */
  resolvedEmoji?: string;
  /** Where the image came from, for telemetry. */
  source: "explicit_url" | "scene_emoji" | "keyword_match" | "none";
}

export interface ResolveBaselineImageInput {
  imageUrl?: string;
  imageAlt?: string;
  sceneEmoji?: string;
  prompt?: string;
}

/**
 * Resolve the best available picture for a baseline question. Pure
 * function — safe to call on the server during baseline creation OR on
 * the client while rendering.
 */
export function resolveBaselineImage(
  input: ResolveBaselineImageInput,
): ResolvedBaselineImage {
  if (input.imageUrl) {
    return {
      imageUrl: input.imageUrl,
      imageAlt: input.imageAlt,
      source: "explicit_url",
    };
  }
  if (input.sceneEmoji) {
    // Prefer the ai-svc endpoint when configured — it either generates a
    // real cartoon picture for the concept or 302s back to Twemoji.
    const url =
      aiSvcImageUrl(input.sceneEmoji) ?? emojiToImageUrl(input.sceneEmoji);
    if (url) {
      return {
        imageUrl: url,
        imageAlt: input.imageAlt ?? `Picture of ${input.sceneEmoji}`,
        resolvedEmoji: input.sceneEmoji,
        source: "scene_emoji",
      };
    }
  }
  const matched = keywordMatchEmoji(input.prompt);
  if (matched) {
    const url = aiSvcImageUrl(matched) ?? emojiToImageUrl(matched);
    if (url) {
      return {
        imageUrl: url,
        imageAlt: input.imageAlt ?? `Picture of ${matched}`,
        resolvedEmoji: matched,
        source: "keyword_match",
      };
    }
  }
  return { source: "none" };
}
