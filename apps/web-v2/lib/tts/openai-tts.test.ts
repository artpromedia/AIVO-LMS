import { describe, it, expect } from "vitest";
import { createOpenAITTSProvider } from "./provider";
import type { TTSRequest } from "./provider";

const REQ: TTSRequest = {
  text: "Let's add two numbers. First, count to three.",
  voiceId: "kid_friendly",
  languageCode: "en-US",
  speed: 1,
  pronunciationOverrides: [],
};

// Minimal MP3-ish bytes the fake endpoint "returns".
const FAKE_MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]);

function okFetch(capture?: (url: string, init: RequestInit) => void): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    capture?.(url, init);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => FAKE_MP3.buffer,
      text: async () => "",
    };
  }) as unknown as typeof fetch;
}

describe("OpenAI TTS provider", () => {
  it("posts to the speech endpoint and returns a base64 data: URL", async () => {
    let sentUrl = "";
    let sentInit: RequestInit | undefined;
    const provider = createOpenAITTSProvider({
      apiKey: "sk-test",
      fetchImpl: okFetch((u, i) => {
        sentUrl = u;
        sentInit = i;
      }),
    });

    const result = await provider.generate(REQ);

    // Request shape.
    expect(sentUrl).toBe("https://api.openai.com/v1/audio/speech");
    expect((sentInit!.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    const body = JSON.parse(sentInit!.body as string);
    expect(body.model).toBe("tts-1");
    expect(body.voice).toBe("fable"); // kid_friendly → fable
    expect(body.response_format).toBe("mp3");
    expect(body.input).toContain("count to three");

    // Result shape.
    expect(provider.name).toBe("openai");
    expect(result.provider).toBe("openai");
    expect(result.storageKey.startsWith("data:audio/mpeg;base64,")).toBe(true);
    expect(result.storageKey.length).toBeGreaterThan("data:audio/mpeg;base64,".length);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.captions.length).toBeGreaterThan(0);
    expect(result.costMicroUsd).toBe(REQ.text.length * 15);
  });

  it("clamps speed to OpenAI's 0.25–4.0 range", async () => {
    let body: { speed?: number; input?: string } = {};
    const provider = createOpenAITTSProvider({
      apiKey: "sk-test",
      fetchImpl: okFetch((_u, i) => (body = JSON.parse(i.body as string))),
    });
    await provider.generate({ ...REQ, speed: 9 });
    expect(body.speed).toBe(4);
    await provider.generate({ ...REQ, speed: 0.05 });
    expect(body.speed).toBe(0.25);
  });

  it("applies pronunciation overrides to the synthesized text", async () => {
    let body: { speed?: number; input?: string } = {};
    const provider = createOpenAITTSProvider({
      apiKey: "sk-test",
      fetchImpl: okFetch((_u, i) => (body = JSON.parse(i.body as string))),
    });
    await provider.generate({
      ...REQ,
      text: "Say AIVO clearly.",
      pronunciationOverrides: [{ token: "AIVO", replacement: "Ay-vo", encoding: "ipa" }],
    });
    expect(body.input).toContain("Ay-vo");
    expect(body.input).not.toContain("AIVO");
  });

  it("throws on a non-2xx response so the caller can fall back", async () => {
    const failFetch = (async () => ({
      ok: false,
      status: 401,
      text: async () => "invalid api key",
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as unknown as typeof fetch;
    const provider = createOpenAITTSProvider({ apiKey: "sk-bad", fetchImpl: failFetch });
    await expect(provider.generate(REQ)).rejects.toThrow(/OpenAI TTS failed: 401/);
  });
});

// Live conformance — real OpenAI call. Skipped unless a key is present.
const LIVE_SKIP = !process.env.OPENAI_API_KEY;
describe("OpenAI TTS provider (live conformance)", () => {
  it.skipIf(LIVE_SKIP)("synthesizes real audio into a data: URL", async () => {
    const provider = createOpenAITTSProvider({ apiKey: process.env.OPENAI_API_KEY! });
    const result = await provider.generate({ ...REQ, text: "Hello from AIVO." });
    expect(result.storageKey.startsWith("data:audio/mpeg;base64,")).toBe(true);
    expect(result.storageKey.length).toBeGreaterThan(1000); // real audio is non-trivial
  });
});
