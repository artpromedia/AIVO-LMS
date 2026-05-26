import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AzureSpeechEvalProvider } from "../../src/providers/azure.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/providers/azure-success.json"), "utf8"),
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

describe("AzureSpeechEvalProvider", () => {
  it("posts raw audio to the regional STT endpoint with subscription header", async () => {
    const fetchImpl = mockFetchOk(fixture);
    const provider = new AzureSpeechEvalProvider({
      apiKey: "azure-secret",
      region: "eastus",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const audio = Buffer.from("RIFF....");
    await provider.evaluate(audio, "the quick brown fox", { language: "en-US" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("https://eastus.stt.speech.microsoft.com/");
    expect(String(url)).toContain("language=en-US");
    expect(String(url)).toContain("format=detailed");
    const headers = init?.headers as Record<string, string>;
    expect(headers["Ocp-Apim-Subscription-Key"]).toBe("azure-secret");
    expect(headers["Pronunciation-Assessment"]).toBeDefined();
    expect(init?.body).toBe(audio);
  });

  it("embeds the reference text inside the Pronunciation-Assessment header", async () => {
    const fetchImpl = mockFetchOk(fixture);
    const provider = new AzureSpeechEvalProvider({
      apiKey: "k",
      region: "eastus",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await provider.evaluate(Buffer.from(""), "my reference text", { language: "en-US" });
    const [, init] = fetchImpl.mock.calls[0]!;
    const headerB64 = (init?.headers as Record<string, string>)["Pronunciation-Assessment"]!;
    const decoded = JSON.parse(Buffer.from(headerB64, "base64").toString("utf8"));
    expect(decoded.ReferenceText).toBe("my reference text");
    expect(decoded.GradingSystem).toBe("HundredMark");
    expect(decoded.Granularity).toBe("Word");
  });

  it("parses NBest[0] pronunciation + fluency + per-word", async () => {
    const fetchImpl = mockFetchOk(fixture);
    const provider = new AzureSpeechEvalProvider({
      apiKey: "k",
      region: "eastus",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await provider.evaluate(Buffer.from(""), "the quick brown fox", {
      language: "en-US",
    });
    expect(result.transcript).toContain("quick brown fox");
    expect(result.degraded).toBe(false);
    expect(result.scores.pronunciation).toBe(88); // round(87.5)
    expect(result.scores.fluency).toBe(91);
    expect(result.scores.perWord).toHaveLength(4);
    expect(result.durationMs).toBe(3420);
  });

  it("requires both key and region", () => {
    expect(() => new AzureSpeechEvalProvider({ apiKey: "", region: "eastus" })).toThrow();
    expect(() => new AzureSpeechEvalProvider({ apiKey: "k", region: "" })).toThrow();
  });
});
