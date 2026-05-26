/**
 * On-device TTS via expo-speech.
 *
 * Pros: zero network, zero cost, instant playback, works on the playground.
 * Cons: voices are the platform defaults (no premium voices).
 *
 * `expo-speech` is dynamically imported so this module can still be required
 * in unit tests on Node where the native module is absent.
 */
import type { TTSProvider, TTSRequest, TTSResult } from "../provider";

function estimateDurationMs(text: string, speed: number): number {
  const words = Math.max(1, text.trim().split(/\s+/).length);
  const wpm = 130 * speed;
  const ms = Math.round((words / wpm) * 60_000);
  return Math.max(400, ms);
}

function fakeCaptions(text: string, totalMs: number) {
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

export class OfflineSpeechProvider implements TTSProvider {
  readonly name = "offline";
  available(): boolean {
    return true;
  }

  async generate(req: TTSRequest): Promise<TTSResult> {
    // We don't produce an audio file when running offline — the consumer
    // should call `speakInline` for synchronous playback. We still return a
    // placeholder storageKey so the audio-asset cache code path works.
    const durationMs = estimateDurationMs(req.text, req.speed);
    return {
      storageKey: "expo-speech:inline",
      durationMs,
      captions: fakeCaptions(req.text, durationMs),
      costMicroUsd: 0,
      provider: "offline",
    };
  }

  async speakInline(req: TTSRequest): Promise<boolean> {
    try {
      // Dynamic import keeps this file importable in plain Node test runs.
      const Speech = await import("expo-speech");
      const rate = Math.min(2, Math.max(0.5, req.speed));
      await new Promise<void>((resolve) => {
        Speech.speak(req.text, {
          language: req.languageCode,
          rate,
          onDone: () => resolve(),
          onError: () => resolve(),
          onStopped: () => resolve(),
        });
      });
      return true;
    } catch {
      return false;
    }
  }
}
