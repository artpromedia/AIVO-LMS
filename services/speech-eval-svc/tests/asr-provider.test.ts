/**
 * Sprint F — unit tests for the ASR provider selector.
 *
 * Live HTTP against OpenAI / Azure is an integration concern gated on
 * real API keys in CI. These tests cover provider selection, missing-
 * key fallback to Null, and that the Null provider never makes a
 * network call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __resetAsrProvider,
  getAsrProvider,
} from "../src/services/asr-provider.js";

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const original: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    original[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k]!;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(original)) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k]!;
    }
  });
}

test("defaults to NullProvider when ASR_PROVIDER is unset", async () => {
  await withEnv(
    { ASR_PROVIDER: undefined, OPENAI_API_KEY: undefined, AZURE_SPEECH_KEY: undefined },
    async () => {
      __resetAsrProvider();
      const p = getAsrProvider();
      assert.equal(p.name, "null");
      const result = await p.transcribe({
        audio: Buffer.from([0]),
        mimetype: "audio/webm",
        language: "en-US",
      });
      assert.equal(result.status, "unavailable");
    },
  );
});

test("falls back to NullProvider when openai is selected without a key", async () => {
  await withEnv(
    { ASR_PROVIDER: "openai", OPENAI_API_KEY: undefined },
    () => {
      __resetAsrProvider();
      const p = getAsrProvider();
      assert.equal(p.name, "null");
    },
  );
});

test("selects OpenAiWhisperProvider when openai + key set", async () => {
  await withEnv(
    { ASR_PROVIDER: "openai", OPENAI_API_KEY: "test-key" },
    () => {
      __resetAsrProvider();
      const p = getAsrProvider();
      assert.equal(p.name, "openai-whisper");
    },
  );
});

test("falls back to NullProvider when azure is selected without key+region", async () => {
  await withEnv(
    {
      ASR_PROVIDER: "azure",
      AZURE_SPEECH_KEY: "k",
      AZURE_SPEECH_REGION: undefined,
    },
    () => {
      __resetAsrProvider();
      const p = getAsrProvider();
      assert.equal(p.name, "null");
    },
  );
});

test("selects AzureSpeechProvider when both azure env vars are set", async () => {
  await withEnv(
    {
      ASR_PROVIDER: "azure",
      AZURE_SPEECH_KEY: "k",
      AZURE_SPEECH_REGION: "eastus",
    },
    () => {
      __resetAsrProvider();
      const p = getAsrProvider();
      assert.equal(p.name, "azure-speech");
    },
  );
});

test("unknown provider value falls back to NullProvider", async () => {
  await withEnv({ ASR_PROVIDER: "deepgram" }, () => {
    __resetAsrProvider();
    const p = getAsrProvider();
    assert.equal(p.name, "null");
  });
});
