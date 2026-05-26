/**
 * ElevenLabs TTS adapter.
 *
 * Uses raw fetch (no SDK install). Reads ELEVENLABS_API_KEY +
 * ELEVENLABS_DEFAULT_VOICE_ID at construct time. Per-request voice IDs may
 * override the default by passing through the TTSRequest's voiceId →
 * VOICE_MAP lookup; if no mapping exists we use the default voice.
 */
import type { TTSProvider, TTSRequest, TTSResult } from "../provider";
import { estimateDurationMs, fakeCaptions } from "../provider";
import type { TTSVoiceId } from "@/lib/db/types";

/**
 * Map our internal voice slots to ElevenLabs voice IDs. These are public,
 * shared voice IDs from the ElevenLabs library — replace via env override
 * if your tenant has custom voices.
 */
const ELEVEN_VOICE_MAP: Partial<Record<TTSVoiceId, string>> = {
  warm_female: "EXAVITQu4vr4xnSDxMaL", // "Bella"
  warm_male: "TxGEqnHWrfWFTfGW9XjX", // "Josh"
  calm_neutral: "21m00Tcm4TlvDq8ikWAM", // "Rachel"
  kid_friendly: "AZnzlk1XvdvUeBnXmlld", // "Domi"
  narrator_low: "VR6AewLTigWG4xSOukaG", // "Arnold"
  narrator_high: "MF3mGyEYCl7XYWbV9V6O", // "Elli"
};

const ELEVEN_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly name = "elevenlabs";
  private readonly apiKey: string;
  private readonly defaultVoiceId: string;

  constructor(opts?: { apiKey?: string; defaultVoiceId?: string }) {
    this.apiKey = opts?.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "";
    this.defaultVoiceId =
      opts?.defaultVoiceId ?? process.env.ELEVENLABS_DEFAULT_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
  }

  available(): boolean {
    return Boolean(this.apiKey);
  }

  /** Apply pronunciation overrides by substituting tokens in the raw text. */
  private applyOverrides(req: TTSRequest): string {
    let text = req.text;
    for (const ov of req.pronunciationOverrides) {
      const re = new RegExp(
        `\\b${ov.token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`,
        "g",
      );
      text = text.replace(re, ov.replacement);
    }
    return text;
  }

  async generate(req: TTSRequest): Promise<TTSResult> {
    if (!this.available()) {
      throw new Error("ElevenLabsTTSProvider not configured: missing ELEVENLABS_API_KEY.");
    }

    const voiceId = ELEVEN_VOICE_MAP[req.voiceId] ?? this.defaultVoiceId;
    const text = this.applyOverrides(req);

    // ElevenLabs uses voice_settings.speaker_boost + stability/similarity for
    // tone; speed control lives on the optimize_streaming_latency stream
    // endpoint. For non-streaming, we approximate by post-processing duration.
    const body = JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    });

    const res = await fetch(`${ELEVEN_ENDPOINT}/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "<no body>");
      throw new Error(
        `ElevenLabs TTS failed: ${res.status} ${res.statusText} — ${detail.slice(0, 200)}`,
      );
    }

    const audio = Buffer.from(await res.arrayBuffer());
    const storageKey = `data:audio/mpeg;base64,${audio.toString("base64")}`;
    const durationMs = estimateDurationMs(req.text, req.speed);
    const captions = fakeCaptions(req.text, durationMs);

    // ElevenLabs Multilingual v2 is ~$0.000180 per character on the Creator
    // tier → 180 micro-USD per char. (Adjust if tenant uses pro tier.)
    const costMicroUsd = Math.max(1, req.text.length * 180);

    return {
      storageKey,
      durationMs,
      captions,
      costMicroUsd,
      provider: "elevenlabs",
    };
  }
}
