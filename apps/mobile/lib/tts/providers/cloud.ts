/**
 * Cloud TTS provider for mobile.
 *
 * Calls the same vendor REST endpoints as the web-v2 adapters. We delegate
 * to the BFF when possible (so secrets stay server-side) but support direct
 * calls when EXPO_PUBLIC_TTS_DIRECT=1 — that path is only used by the
 * playground/QA app where the keys are stamped into the build.
 */
import type { TTSProvider, TTSRequest, TTSResult } from "../provider";

type Vendor = "azure" | "polly" | "elevenlabs";

export class CloudTTSProvider implements TTSProvider {
  readonly name: Vendor;
  private readonly bffBaseUrl: string;

  constructor(vendor: Vendor) {
    this.name = vendor;
    this.bffBaseUrl =
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      process.env.EXPO_PUBLIC_WEB_BASE_URL ??
      "http://localhost:5000";
  }

  available(): boolean {
    // Mobile always goes through the BFF, so it's available whenever we have
    // an API base URL. The BFF will reject if its own provider isn't configured.
    return Boolean(this.bffBaseUrl);
  }

  async generate(req: TTSRequest): Promise<TTSResult> {
    const res = await fetch(`${this.bffBaseUrl}/api/bff/tts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: req.text,
        voiceId: req.voiceId,
        languageCode: req.languageCode,
        speed: req.speed,
        pronunciationOverrides: req.pronunciationOverrides,
        preferredProvider: this.name,
      }),
    });
    if (!res.ok) {
      throw new Error(`Cloud TTS failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as TTSResult;
    return json;
  }
}
