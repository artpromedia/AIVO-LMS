/**
 * Azure Cognitive Services Speech REST adapter.
 *
 * Uses raw fetch (no SDK install) — same pattern PR #57 used for speech-eval
 * providers. Reads AZURE_TTS_KEY + AZURE_TTS_REGION at construct time so
 * misconfiguration surfaces during the factory `available()` check.
 *
 * Voice mapping uses Azure neural voices keyed by locale. The voice id we
 * receive (kid_friendly, warm_female, etc.) maps to a concrete Azure voice
 * (e.g. en-US-AnaNeural for kid_friendly/en-US). See `pickAzureVoice` for
 * the table. Unsupported (voice, locale) pairs fall back to a sane default.
 */
import type { TTSProvider, TTSRequest, TTSResult } from "../provider";
import { estimateDurationMs, fakeCaptions } from "../provider";
import type { TTSVoiceId } from "@/lib/db/types";

type AzureVoiceMap = Partial<Record<TTSVoiceId, string>>;

/**
 * Default Azure Neural voice IDs per locale + our internal voice slot.
 * Tables are kept small intentionally; add locales as we expand language
 * support. Unknown locales fall through to en-US.
 */
const AZURE_VOICE_BY_LOCALE: Record<string, AzureVoiceMap> = {
  "en-US": {
    warm_female: "en-US-JennyNeural",
    warm_male: "en-US-GuyNeural",
    calm_neutral: "en-US-AriaNeural",
    kid_friendly: "en-US-AnaNeural",
    narrator_low: "en-US-DavisNeural",
    narrator_high: "en-US-AmberNeural",
  },
  "es-ES": {
    warm_female: "es-ES-ElviraNeural",
    warm_male: "es-ES-AlvaroNeural",
    calm_neutral: "es-ES-AbrilNeural",
    kid_friendly: "es-ES-IreneNeural",
    narrator_low: "es-ES-AlvaroNeural",
    narrator_high: "es-ES-ElviraNeural",
  },
};

const DEFAULT_AZURE_VOICE = "en-US-JennyNeural";

function pickAzureVoice(voiceId: TTSVoiceId, locale: string): string {
  const map =
    AZURE_VOICE_BY_LOCALE[locale] ??
    AZURE_VOICE_BY_LOCALE[locale.split("-")[0] + "-" + locale.split("-")[1]?.toUpperCase()] ??
    AZURE_VOICE_BY_LOCALE["en-US"];
  return map[voiceId] ?? DEFAULT_AZURE_VOICE;
}

/**
 * Escape characters that have special meaning inside SSML so the
 * payload stays valid when the learner's text contains "<", "&", etc.
 */
function ssmlEscape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert a 0.5..2.0 multiplier to the SSML `prosody rate` percentage.
 * Azure accepts -100%..+100% relative to the voice's default rate, so
 * `1.0` → "+0%", `2.0` → "+100%", `0.5` → "-50%".
 */
function rateToSsml(speed: number): string {
  const clamped = Math.min(2, Math.max(0.5, speed));
  const pct = Math.round((clamped - 1) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/**
 * Build the SSML body Azure expects. Pronunciation overrides become
 * `<phoneme>` elements (IPA only for now); plain string overrides become
 * `<sub>` substitutions.
 */
export function buildAzureSsml(req: TTSRequest, voice: string): string {
  let text = ssmlEscape(req.text);

  for (const ov of req.pronunciationOverrides) {
    const token = ssmlEscape(ov.token);
    if (ov.encoding === "ipa") {
      const replacement = ssmlEscape(ov.replacement);
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "g");
      text = text.replace(re, `<phoneme alphabet="ipa" ph="${replacement}">${token}</phoneme>`);
    } else {
      const replacement = ssmlEscape(ov.replacement);
      const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "g");
      text = text.replace(re, `<sub alias="${replacement}">${token}</sub>`);
    }
  }

  return (
    `<speak version="1.0" xml:lang="${req.languageCode}" ` +
    `xmlns="http://www.w3.org/2001/10/synthesis">` +
    `<voice name="${voice}">` +
    `<prosody rate="${rateToSsml(req.speed)}">${text}</prosody>` +
    `</voice></speak>`
  );
}

/** Endpoint template for the Azure Speech REST API. */
function azureEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export class AzureTTSProvider implements TTSProvider {
  readonly name = "azure";
  private readonly key: string;
  private readonly region: string;

  constructor(opts?: { key?: string; region?: string }) {
    this.key = opts?.key ?? process.env.AZURE_TTS_KEY ?? "";
    this.region = opts?.region ?? process.env.AZURE_TTS_REGION ?? "";
  }

  available(): boolean {
    return Boolean(this.key && this.region);
  }

  async generate(req: TTSRequest): Promise<TTSResult> {
    if (!this.available()) {
      throw new Error("AzureTTSProvider not configured: missing key or region.");
    }

    const voice = pickAzureVoice(req.voiceId, req.languageCode);
    const ssml = buildAzureSsml(req, voice);

    const res = await fetch(azureEndpoint(this.region), {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.key,
        "Content-Type": "application/ssml+xml",
        // mp3 24kHz 48kbps gives a small payload suitable for child voices.
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "aivo-tts/1.0",
      },
      body: ssml,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "<no body>");
      throw new Error(`Azure TTS failed: ${res.status} ${res.statusText} — ${detail.slice(0, 200)}`);
    }

    const audio = Buffer.from(await res.arrayBuffer());
    const storageKey = `data:audio/mpeg;base64,${audio.toString("base64")}`;
    const durationMs = estimateDurationMs(req.text, req.speed);
    const captions = fakeCaptions(req.text, durationMs);

    // Azure Neural pricing is $16/1M characters at the standard tier:
    //   16e-6 USD per char → 16 micro-USD per char.
    const costMicroUsd = Math.max(1, req.text.length * 16);

    return {
      storageKey,
      durationMs,
      captions,
      costMicroUsd,
      provider: "azure",
    };
  }
}
