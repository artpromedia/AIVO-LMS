/**
 * Mobile TTS provider contracts. Mirrors the web-v2 interface so a shared
 * caller can switch platforms without changing call sites.
 */
export type TTSRequest = {
  text: string;
  /** Internal voice slot; cloud adapter maps to a real vendor voice id. */
  voiceId: string;
  languageCode: string;
  /** Speed multiplier, 0.5..2.0. */
  speed: number;
  pronunciationOverrides: { token: string; replacement: string; encoding: string }[];
};

export type TTSResult = {
  /** Either a `data:audio/mpeg;base64,...` URI or a local file uri. */
  storageKey: string;
  durationMs: number;
  captions: { startMs: number; endMs: number; text: string }[];
  costMicroUsd: number;
  provider: string;
};

export interface TTSProvider {
  readonly name: string;
  available(): boolean;
  generate(req: TTSRequest): Promise<TTSResult>;
  /**
   * Speak directly on the device, bypassing the audio asset round-trip.
   * Optional — offline providers implement this so we don't have to round
   * trip through a file. Cloud providers may decline (returns false).
   */
  speakInline?(req: TTSRequest): Promise<boolean>;
}
