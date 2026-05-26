import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { WhisperSpeechEvalProvider } from "../../src/providers/whisper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/providers/whisper-success.json"), "utf8"),
);

function mockFetchOk(body: unknown) {
  return vi.fn(async (..._args: Parameters<typeof fetch>) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response));
}

describe("WhisperSpeechEvalProvider", () => {
  it("sends a multipart POST to /audio/transcriptions with bearer auth", async () => {
    const fetchImpl = mockFetchOk(fixture);
    const provider = new WhisperSpeechEvalProvider({
      apiKey: "sk-test-key",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await provider.evaluate(Buffer.from("audio"), "the quick brown fox", {
      language: "en-US",
      contentType: "audio/webm",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test-key");
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("parses transcript + duration and computes scores", async () => {
    const fetchImpl = mockFetchOk(fixture);
    const provider = new WhisperSpeechEvalProvider({
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await provider.evaluate(Buffer.from("audio"), "the quick brown fox", {
      language: "en-US",
    });
    expect(result.transcript).toBe("the quick brown fox jumps over the lazy dog");
    expect(result.degraded).toBe(false);
    expect(result.durationMs).toBe(3420);
    expect(result.scores.pronunciation).toBeGreaterThan(0);
    expect(result.scores.perWord).toBeDefined();
    expect(result.scores.perWord!.length).toBeGreaterThan(0);
  });

  it("throws on non-2xx responses with the upstream error code", async () => {
    const failing = vi.fn(async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
      text: async () => '{"error":"bad key"}',
    } as unknown as Response));
    const provider = new WhisperSpeechEvalProvider({
      apiKey: "sk-test",
      fetchImpl: failing as unknown as typeof fetch,
    });
    await expect(
      provider.evaluate(Buffer.from("a"), "hi", { language: "en-US" }),
    ).rejects.toThrow(/401/);
  });

  it("requires an API key", () => {
    expect(() => new WhisperSpeechEvalProvider({ apiKey: "" })).toThrow(/API_KEY/);
  });
});
