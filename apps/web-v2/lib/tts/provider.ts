/**
 * Sprint 28 — TTS provider abstraction.
 *
 * Two implementations:
 *   - `mockTTSProvider` (dev/test): generates a deterministic fake audio blob
 *     (a data: URL placeholder + computed duration). Always succeeds.
 *   - `productionTTSAdapter` (placeholder): throws if invoked without the
 *     real adapter wired in. Kept here so the call site code is identical
 *     across environments.
 *
 * The classifier and the rest of the BFF code import `getTTSProvider()` and
 * never reference a specific implementation, so swapping providers is a
 * single function change.
 */
import { createHash } from "node:crypto";
import type { AudioAsset, TTSVoiceId } from "@/lib/db/types";

export type TTSRequest = {
  text: string;
  voiceId: TTSVoiceId;
  languageCode: string;
  /** Speed multiplier, 0.5..2.0. Clamped by the BFF. */
  speed: number;
  /** Pronunciation overrides resolved by the caller. */
  pronunciationOverrides: { token: string; replacement: string; encoding: string }[];
};

export type TTSResult = {
  storageKey: string;
  durationMs: number;
  captions: AudioAsset["captions"];
  /** Cost charged by the provider for this generation, in micro-USD. */
  costMicroUsd: number;
  provider: string;
};

export interface TTSProvider {
  /** Stable id surfaced in TTSGenerationJob.provider + AudioAsset.provider. */
  readonly name: string;
  /** True when the provider can serve requests; mock is always true. */
  available(): boolean;
  generate(req: TTSRequest): Promise<TTSResult>;
}

/**
 * Stable content hash used by the audio cache + AudioAsset.contentHash. The
 * same inputs always produce the same hash, so cache lookups across requests
 * are deterministic. Pronunciation overrides are included so changing an
 * override invalidates the relevant cache entries.
 */
export function ttsContentHash(req: {
  text: string;
  voiceId: TTSVoiceId;
  languageCode: string;
  /** Speed multiplier (clamped 0.5..2.0). Distinct speeds must produce distinct
   * cache entries — playing the same text back faster/slower is a different
   * audio asset, not a reuse. */
  speed: number;
  pronunciationOverrides: { token: string; replacement: string; encoding: string }[];
}): string {
  const h = createHash("sha256");
  h.update(req.text);
  h.update("\u0000");
  h.update(req.voiceId);
  h.update("\u0000");
  h.update(req.languageCode);
  h.update("\u0000");
  // Quantize speed to 2 decimals so 1.00 and 1.000 hash the same.
  h.update(req.speed.toFixed(2));
  h.update("\u0000");
  // Deterministic ordering for the override set so [a,b] and [b,a] hash equal.
  const overrides = [...req.pronunciationOverrides]
    .map((o) => `${o.token}|${o.encoding}|${o.replacement}`)
    .sort();
  h.update(overrides.join("\n"));
  return h.digest("hex").slice(0, 32);
}

/**
 * Estimated playback duration. Adult-fluent reading averages ~150 wpm; we use
 * 130 wpm so kid-friendly voices feel more spacious. Speed multiplies inverse-
 * proportionally so 2.0x cuts the duration in half. Always returns at least
 * 400 ms so a one-word caption is still rendered.
 */
function estimateDurationMs(text: string, speed: number): number {
  const words = Math.max(1, text.trim().split(/\s+/).length);
  const wpm = 130 * speed;
  const ms = Math.round((words / wpm) * 60_000);
  return Math.max(400, ms);
}

/**
 * Produce naive line-level captions by splitting on sentence boundaries and
 * distributing the total duration proportionally to character count. Good
 * enough for the dev UI; real providers return word-level timestamps.
 */
function fakeCaptions(text: string, totalMs: number): AudioAsset["captions"] {
  const lines = text
    .split(/(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [{ startMs: 0, endMs: totalMs, text }];
  const totalChars = lines.reduce((a, b) => a + b.length, 0);
  let cursor = 0;
  return lines.map((line) => {
    const share = Math.round((line.length / totalChars) * totalMs);
    const startMs = cursor;
    const endMs = cursor + share;
    cursor = endMs;
    return { startMs, endMs, text: line };
  });
}

/**
 * Mock provider — deterministic, free, in-memory. The "audio" is a data: URL
 * that points at a stub MP3 header so the <audio> element doesn't error out
 * on render. Real bytes arrive when production adapter is wired.
 */
const MOCK_STUB_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//uQZAAAAAA";

export const mockTTSProvider: TTSProvider = {
  name: "mock",
  available: () => true,
  async generate(req) {
    const speed = Math.min(2, Math.max(0.5, req.speed));
    const durationMs = estimateDurationMs(req.text, speed);
    return {
      storageKey: MOCK_STUB_MP3,
      durationMs,
      captions: fakeCaptions(req.text, durationMs),
      // ~ $0.000016 per character at OpenAI TTS rates; multiply by 1e6 = 16
      // micro-USD per character. Matches roughly what a real adapter charges
      // and gives the cost dashboard non-zero numbers.
      costMicroUsd: Math.max(1, req.text.length * 16),
      provider: "mock",
    };
  },
};

export const productionTTSAdapter: TTSProvider = {
  name: "production-stub",
  available: () => false,
  async generate() {
    throw new Error("Production TTS adapter not wired. Set TTS_PROVIDER=mock for dev/test.");
  },
};

export function getTTSProvider(): TTSProvider {
  const env = process.env.TTS_PROVIDER ?? "mock";
  if (env === "production" && productionTTSAdapter.available()) {
    return productionTTSAdapter;
  }
  return mockTTSProvider;
}
