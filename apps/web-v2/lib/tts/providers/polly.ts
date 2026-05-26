/**
 * AWS Polly TTS adapter.
 *
 * Uses raw fetch with AWS Signature V4 so we don't pull in the full AWS SDK
 * (same pattern PR #57 used for speech-eval providers). Reads
 * AWS_POLLY_ACCESS_KEY + AWS_POLLY_SECRET_KEY + AWS_POLLY_REGION at construct
 * time so misconfiguration surfaces during `available()`.
 *
 * Voice selection is locale + age-band aware. Children's content gets the
 * Ivy/Justin family; adult narration falls to Joanna/Matthew/Lupe.
 */
import { createHash, createHmac } from "node:crypto";
import type { TTSProvider, TTSRequest, TTSResult } from "../provider";
import { estimateDurationMs, fakeCaptions } from "../provider";
import type { TTSVoiceId } from "@/lib/db/types";

type PollyVoiceMap = Partial<Record<TTSVoiceId, string>>;

/** Polly voice ids keyed by language → our internal voice slot. */
const POLLY_VOICE_BY_LOCALE: Record<string, PollyVoiceMap> = {
  "en-US": {
    warm_female: "Joanna",
    warm_male: "Matthew",
    calm_neutral: "Joanna",
    kid_friendly: "Ivy",
    narrator_low: "Matthew",
    narrator_high: "Kendra",
  },
  "es-ES": {
    warm_female: "Lucia",
    warm_male: "Enrique",
    calm_neutral: "Lucia",
    kid_friendly: "Lucia",
    narrator_low: "Enrique",
    narrator_high: "Lucia",
  },
};

const DEFAULT_POLLY_VOICE = "Joanna";

function pickPollyVoice(voiceId: TTSVoiceId, locale: string): string {
  const map = POLLY_VOICE_BY_LOCALE[locale] ?? POLLY_VOICE_BY_LOCALE["en-US"];
  return map[voiceId] ?? DEFAULT_POLLY_VOICE;
}

function ssmlEscape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rateToSsml(speed: number): string {
  const clamped = Math.min(2, Math.max(0.5, speed));
  return `${Math.round(clamped * 100)}%`;
}

export function buildPollySsml(req: TTSRequest): string {
  let text = ssmlEscape(req.text);
  for (const ov of req.pronunciationOverrides) {
    const token = ssmlEscape(ov.token);
    const replacement = ssmlEscape(ov.replacement);
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "g");
    if (ov.encoding === "ipa") {
      text = text.replace(re, `<phoneme alphabet="ipa" ph="${replacement}">${token}</phoneme>`);
    } else {
      text = text.replace(re, `<sub alias="${replacement}">${token}</sub>`);
    }
  }
  return `<speak><prosody rate="${rateToSsml(req.speed)}">${text}</prosody></speak>`;
}

// ─── AWS Signature V4 helpers ────────────────────────────────────────────────

function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function getSigningKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac("AWS4" + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * Sign an AWS request with Signature V4 and return the headers to attach.
 * Service is hardcoded to "polly" so we don't accidentally sign for another
 * service. Returns the Authorization header + X-Amz-Date + content hash.
 */
export function signAwsRequest(opts: {
  accessKey: string;
  secretKey: string;
  region: string;
  method: string;
  host: string;
  path: string;
  body: string;
  contentType: string;
  now?: Date;
}): Record<string, string> {
  const service = "polly";
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(opts.body);

  const canonicalHeaders =
    `content-type:${opts.contentType}\n` +
    `host:${opts.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `${opts.method}\n${opts.path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStamp}/${opts.region}/${service}/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;

  const signingKey = getSigningKey(opts.secretKey, dateStamp, opts.region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    "X-Amz-Date": amzDate,
    "X-Amz-Content-Sha256": payloadHash,
    "Content-Type": opts.contentType,
  };
}

export class PollyTTSProvider implements TTSProvider {
  readonly name = "polly";
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly region: string;

  constructor(opts?: { accessKey?: string; secretKey?: string; region?: string }) {
    this.accessKey = opts?.accessKey ?? process.env.AWS_POLLY_ACCESS_KEY ?? "";
    this.secretKey = opts?.secretKey ?? process.env.AWS_POLLY_SECRET_KEY ?? "";
    this.region = opts?.region ?? process.env.AWS_POLLY_REGION ?? "";
  }

  available(): boolean {
    return Boolean(this.accessKey && this.secretKey && this.region);
  }

  async generate(req: TTSRequest): Promise<TTSResult> {
    if (!this.available()) {
      throw new Error("PollyTTSProvider not configured.");
    }

    const voice = pickPollyVoice(req.voiceId, req.languageCode);
    const ssml = buildPollySsml(req);
    const body = JSON.stringify({
      Engine: "neural",
      LanguageCode: req.languageCode,
      OutputFormat: "mp3",
      VoiceId: voice,
      TextType: "ssml",
      Text: ssml,
    });

    const host = `polly.${this.region}.amazonaws.com`;
    const path = "/v1/speech";
    const headers = signAwsRequest({
      accessKey: this.accessKey,
      secretKey: this.secretKey,
      region: this.region,
      method: "POST",
      host,
      path,
      body,
      contentType: "application/json",
    });

    const res = await fetch(`https://${host}${path}`, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "<no body>");
      throw new Error(`Polly TTS failed: ${res.status} ${res.statusText} — ${detail.slice(0, 200)}`);
    }

    const audio = Buffer.from(await res.arrayBuffer());
    const storageKey = `data:audio/mpeg;base64,${audio.toString("base64")}`;
    const durationMs = estimateDurationMs(req.text, req.speed);
    const captions = fakeCaptions(req.text, durationMs);

    // Polly Neural is $16/1M characters: 16 micro-USD per character.
    const costMicroUsd = Math.max(1, req.text.length * 16);

    return {
      storageKey,
      durationMs,
      captions,
      costMicroUsd,
      provider: "polly",
    };
  }
}
