import { describe, expect, it, afterEach } from "vitest";
import { getSpeechEvalProvider, resetProviderCache } from "../../src/providers/factory.js";
import { MockSpeechEvalProvider } from "../../src/providers/mock.js";
import { WhisperSpeechEvalProvider } from "../../src/providers/whisper.js";

const PRIOR_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...PRIOR_ENV };
  resetProviderCache();
});

describe("speech-eval provider factory", () => {
  it("defaults to mock in non-production when SPEECH_EVAL_PROVIDER is unset", () => {
    process.env.NODE_ENV = "test";
    delete process.env.SPEECH_EVAL_PROVIDER;
    const p = getSpeechEvalProvider({ fresh: true });
    expect(p).toBeInstanceOf(MockSpeechEvalProvider);
  });

  it("throws in production when provider is mock / unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SPEECH_EVAL_PROVIDER;
    expect(() => getSpeechEvalProvider({ fresh: true })).toThrow(/mock/i);

    process.env.SPEECH_EVAL_PROVIDER = "mock";
    expect(() => getSpeechEvalProvider({ fresh: true })).toThrow(/mock/i);
  });

  it("constructs the whisper provider when SPEECH_EVAL_PROVIDER=whisper and key is set", () => {
    process.env.NODE_ENV = "test";
    process.env.SPEECH_EVAL_PROVIDER = "whisper";
    process.env.SPEECH_EVAL_WHISPER_API_KEY = "sk-fake";
    const p = getSpeechEvalProvider({ fresh: true });
    expect(p).toBeInstanceOf(WhisperSpeechEvalProvider);
  });

  it("rejects unknown provider names", () => {
    process.env.NODE_ENV = "test";
    process.env.SPEECH_EVAL_PROVIDER = "carrier-pigeon";
    expect(() => getSpeechEvalProvider({ fresh: true })).toThrow(/unknown/i);
  });
});
