import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DeepgramSpeechEvalProvider } from "../../src/providers/deepgram.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/providers/deepgram-success.json"), "utf8"),
);

function mockFetchOk(body: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response));
}

describe("DeepgramSpeechEvalProvider", () => {
  it("POSTs raw audio with Token auth + model query string", async () => {
    const fetchImpl = mockFetchOk(fixture);
    const provider = new DeepgramSpeechEvalProvider({
      apiKey: "dg-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const audio = Buffer.from("opus...");
    await provider.evaluate(audio, "the quick brown fox", {
      language: "en-US",
      contentType: "audio/webm",
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("https://api.deepgram.com/v1/listen?");
    expect(String(url)).toContain("model=nova-3-general");
    expect(String(url)).toContain("language=en-US");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Token dg-key");
    expect(headers["Content-Type"]).toBe("audio/webm");
    expect(init?.body).toBe(audio);
  });

  it("parses results.channels[0].alternatives[0].transcript", async () => {
    const fetchImpl = mockFetchOk(fixture);
    const provider = new DeepgramSpeechEvalProvider({
      apiKey: "dg-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await provider.evaluate(Buffer.from(""), "the quick brown fox", {
      language: "en-US",
    });
    expect(result.transcript).toBe("the quick brown fox jumps over the lazy dog");
    expect(result.degraded).toBe(false);
    expect(result.durationMs).toBe(3420);
    expect(result.scores.pronunciation).toBeGreaterThan(0);
  });

  it("requires an API key", () => {
    expect(() => new DeepgramSpeechEvalProvider({ apiKey: "" })).toThrow(/KEY/);
  });
});
