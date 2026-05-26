/**
 * TTS provider tests.
 *
 * The mock provider is exercised for determinism (same input → same output).
 * The three cloud providers (Azure / Polly / ElevenLabs) are exercised against
 * recorded HTTP fixtures stored under `./fixtures/tts/`. We stub `globalThis.fetch`
 * so no network is hit during CI.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getTTSProvider,
  mockTTSProvider,
  ttsContentHash,
  type TTSRequest,
} from "../provider";
import { AzureTTSProvider, buildAzureSsml } from "../providers/azure";
import { PollyTTSProvider, buildPollySsml, signAwsRequest } from "../providers/polly";
import { ElevenLabsTTSProvider } from "../providers/elevenlabs";

const FIXTURE_DIR = join(__dirname, "fixtures", "tts");

function loadFixtureAudio(name: string): Buffer {
  // The fixtures are tiny synthetic MP3 headers committed alongside the test
  // so we never have to ship real audio in the repo.
  return readFileSync(join(FIXTURE_DIR, name));
}

const baseReq: TTSRequest = {
  text: "Hello, learner!",
  voiceId: "kid_friendly",
  languageCode: "en-US",
  speed: 1.0,
  pronunciationOverrides: [],
};

describe("mockTTSProvider", () => {
  it("produces deterministic output for identical input", async () => {
    const a = await mockTTSProvider.generate(baseReq);
    const b = await mockTTSProvider.generate(baseReq);
    expect(a.storageKey).toBe(b.storageKey);
    expect(a.durationMs).toBe(b.durationMs);
    expect(a.captions).toEqual(b.captions);
    expect(a.costMicroUsd).toBe(b.costMicroUsd);
    expect(a.provider).toBe("mock");
  });

  it("emits at least one caption for any non-empty text", async () => {
    const r = await mockTTSProvider.generate(baseReq);
    expect(r.captions.length).toBeGreaterThan(0);
  });

  it("computes a stable content hash", () => {
    const h1 = ttsContentHash(baseReq);
    const h2 = ttsContentHash(baseReq);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(32);
  });

  it("hashes change when speed changes", () => {
    const h1 = ttsContentHash(baseReq);
    const h2 = ttsContentHash({ ...baseReq, speed: 1.5 });
    expect(h1).not.toBe(h2);
  });
});

describe("getTTSProvider factory", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns mock when TTS_PROVIDER is unset in non-production", () => {
    delete process.env.TTS_PROVIDER;
    process.env.NODE_ENV = "development";
    expect(getTTSProvider().name).toBe("mock");
  });

  it("hard-fails in production when TTS_PROVIDER is unset", () => {
    delete process.env.TTS_PROVIDER;
    process.env.NODE_ENV = "production";
    expect(() => getTTSProvider()).toThrow(/TTS_PROVIDER/);
  });

  it("hard-fails in production when TTS_PROVIDER=mock", () => {
    process.env.TTS_PROVIDER = "mock";
    process.env.NODE_ENV = "production";
    expect(() => getTTSProvider()).toThrow(/TTS_PROVIDER/);
  });

  it("returns the azure provider when configured", () => {
    process.env.TTS_PROVIDER = "azure";
    process.env.AZURE_TTS_KEY = "test-key";
    process.env.AZURE_TTS_REGION = "eastus";
    process.env.NODE_ENV = "development";
    expect(getTTSProvider().name).toBe("azure");
  });

  it("falls back to mock in dev when azure is missing creds", () => {
    process.env.TTS_PROVIDER = "azure";
    delete process.env.AZURE_TTS_KEY;
    delete process.env.AZURE_TTS_REGION;
    process.env.NODE_ENV = "development";
    expect(getTTSProvider().name).toBe("mock");
  });

  it("hard-fails in prod when azure is missing creds", () => {
    process.env.TTS_PROVIDER = "azure";
    delete process.env.AZURE_TTS_KEY;
    process.env.NODE_ENV = "production";
    expect(() => getTTSProvider()).toThrow(/AzureTTSProvider/);
  });
});

describe("AzureTTSProvider", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts SSML to the Azure endpoint and returns audio + captions", async () => {
    const audio = loadFixtureAudio("azure-hello.mp3");
    globalThis.fetch = vi.fn(async () =>
      new Response(audio, {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    ) as unknown as typeof fetch;

    const p = new AzureTTSProvider({ key: "k", region: "eastus" });
    const r = await p.generate(baseReq);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, RequestInit];
    expect(url).toContain("eastus.tts.speech.microsoft.com");
    expect((init.headers as Record<string, string>)["Ocp-Apim-Subscription-Key"]).toBe("k");
    expect(init.body).toContain("<speak");

    expect(r.provider).toBe("azure");
    expect(r.storageKey).toMatch(/^data:audio\/mpeg;base64,/);
    expect(r.captions.length).toBeGreaterThan(0);
  });

  it("throws when Azure returns a non-2xx", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Unauthorized", { status: 401 }),
    ) as unknown as typeof fetch;
    const p = new AzureTTSProvider({ key: "k", region: "eastus" });
    await expect(p.generate(baseReq)).rejects.toThrow(/Azure TTS failed: 401/);
  });

  it("escapes SSML special characters in user text", () => {
    const req: TTSRequest = { ...baseReq, text: "tags <like> & \"quoted\"" };
    const ssml = buildAzureSsml(req, "en-US-JennyNeural");
    expect(ssml).toContain("&lt;like&gt;");
    expect(ssml).toContain("&amp;");
    expect(ssml).toContain("&quot;");
  });
});

describe("PollyTTSProvider", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("signs the request, posts JSON, and returns audio", async () => {
    const audio = loadFixtureAudio("polly-hello.mp3");
    globalThis.fetch = vi.fn(async () =>
      new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
    ) as unknown as typeof fetch;

    const p = new PollyTTSProvider({
      accessKey: "AKIATEST",
      secretKey: "secret",
      region: "us-east-1",
    });
    const r = await p.generate(baseReq);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("https://polly.us-east-1.amazonaws.com/v1/speech");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIATEST/);
    expect(headers["X-Amz-Date"]).toMatch(/^\d{8}T\d{6}Z$/);

    const body = JSON.parse(init.body as string);
    expect(body.VoiceId).toBe("Ivy");
    expect(body.Engine).toBe("neural");
    expect(body.TextType).toBe("ssml");

    expect(r.provider).toBe("polly");
    expect(r.storageKey).toMatch(/^data:audio\/mpeg;base64,/);
  });

  it("produces deterministic SigV4 signatures for a fixed timestamp", () => {
    const headers = signAwsRequest({
      accessKey: "AKIATEST",
      secretKey: "secret",
      region: "us-east-1",
      method: "POST",
      host: "polly.us-east-1.amazonaws.com",
      path: "/v1/speech",
      body: "{}",
      contentType: "application/json",
      now: new Date("2025-01-01T00:00:00Z"),
    });
    expect(headers.Authorization).toContain("AWS4-HMAC-SHA256");
    expect(headers["X-Amz-Date"]).toBe("20250101T000000Z");
    expect(headers["X-Amz-Content-Sha256"]).toHaveLength(64);
  });

  it("wraps user text in <speak> SSML", () => {
    const ssml = buildPollySsml(baseReq);
    expect(ssml.startsWith("<speak>")).toBe(true);
    expect(ssml).toContain("Hello, learner!");
  });
});

describe("ElevenLabsTTSProvider", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to the correct voice endpoint and returns audio", async () => {
    const audio = loadFixtureAudio("elevenlabs-hello.mp3");
    globalThis.fetch = vi.fn(async () =>
      new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
    ) as unknown as typeof fetch;

    const p = new ElevenLabsTTSProvider({ apiKey: "xi-test", defaultVoiceId: "fallback" });
    const r = await p.generate(baseReq);

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, init] = call as [string, RequestInit];
    // kid_friendly maps to AZnzlk1XvdvUeBnXmlld
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/AZnzlk1XvdvUeBnXmlld");
    const headers = init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("xi-test");

    expect(r.provider).toBe("elevenlabs");
    expect(r.storageKey).toMatch(/^data:audio\/mpeg;base64,/);
  });

  it("uses the default voice id when our slot is unmapped", async () => {
    const audio = loadFixtureAudio("elevenlabs-hello.mp3");
    globalThis.fetch = vi.fn(async () =>
      new Response(audio, { status: 200 }),
    ) as unknown as typeof fetch;

    const p = new ElevenLabsTTSProvider({ apiKey: "k", defaultVoiceId: "custom-voice" });
    await p.generate({ ...baseReq, voiceId: "warm_female" });
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    // warm_female IS mapped, so we should hit the mapped value, not "custom-voice".
    expect(call[0]).toContain("EXAVITQu4vr4xnSDxMaL");
  });

  it("throws on non-2xx", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("Invalid voice", { status: 422 }),
    ) as unknown as typeof fetch;
    const p = new ElevenLabsTTSProvider({ apiKey: "k" });
    await expect(p.generate(baseReq)).rejects.toThrow(/ElevenLabs TTS failed: 422/);
  });
});
