/**
 * Phase 5 — tool-call clients for code_run / image_out / voice_out.
 *
 * Each helper must:
 *   1. enforce the tutor's declared capability list
 *   2. validate basic input shape before reaching the network
 *   3. surface ai-svc errors as a `ToolCallError`
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";
import {
  ToolCallError,
  requestAudioOut,
  requestCodeRun,
  requestImageOut,
} from "../src/lib/tutorTools.js";

const ORIGINAL_FETCH = globalThis.fetch;

function makeTutor(caps: TutorDefinition["capabilities"]): TutorDefinition {
  return defineTutor({
    id: "test-tutor@1.0.0",
    schemaVersion: 1,
    persona: { id: "tester", name: "Tester", tagline: "x", voiceStyle: "neutral", locale: "en-US" },
    capabilities: caps,
    subjects: ["math"],
    gradeBands: ["K"],
    functioningLevels: ["STANDARD"],
    skillGraphRefs: ["ccss-math-k"],
    defaultContentPackRefs: [],
    policy: { requiresConsent: false },
  });
}

describe("tutorTools clients (Phase 5)", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  describe("requestCodeRun", () => {
    it("throws when the tutor doesn't declare code_run", async () => {
      const tutor = makeTutor(["chat"]);
      await assert.rejects(
        requestCodeRun(tutor, { language: "python", source: "print(1)" }),
        (err: unknown) =>
          err instanceof ToolCallError &&
          err.capability === "code_run" &&
          err.status === 400,
      );
    });

    it("rejects empty source", async () => {
      const tutor = makeTutor(["chat", "code_run"]);
      await assert.rejects(
        requestCodeRun(tutor, { language: "python", source: "" }),
        (err: unknown) => err instanceof ToolCallError && err.status === 400,
      );
    });

    it("rejects oversize source (> 8 KB)", async () => {
      const tutor = makeTutor(["chat", "code_run"]);
      const big = "a".repeat(8 * 1024 + 1);
      await assert.rejects(
        requestCodeRun(tutor, { language: "python", source: big }),
        (err: unknown) => err instanceof ToolCallError && err.status === 400,
      );
    });

    it("forwards a valid request and returns the parsed response", async () => {
      const tutor = makeTutor(["chat", "code_run"]);
      let captured: any = null;
      globalThis.fetch = async (url, init) => {
        captured = { url: String(url), body: JSON.parse((init as any).body) };
        return new Response(
          JSON.stringify({
            stdout: "1\n",
            stderr: "",
            exitCode: 0,
            timedOut: false,
            durationMs: 12,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      };
      const res = await requestCodeRun(tutor, {
        language: "python",
        source: "print(1)",
      });
      assert.equal(res.stdout, "1\n");
      assert.equal(captured.body.language, "python");
      assert.match(captured.url, /\/api\/ai\/tools\/code-run$/);
    });

    it("maps ai-svc 5xx to ToolCallError with the response status", async () => {
      const tutor = makeTutor(["chat", "code_run"]);
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ detail: "boom" }), { status: 503 });
      await assert.rejects(
        requestCodeRun(tutor, { language: "python", source: "print(1)" }),
        (err: unknown) => err instanceof ToolCallError && err.status === 503,
      );
    });
  });

  describe("requestImageOut", () => {
    it("requires image_out capability", async () => {
      const tutor = makeTutor(["chat"]);
      await assert.rejects(
        requestImageOut(tutor, { prompt: "a friendly dragon" }),
        (err: unknown) =>
          err instanceof ToolCallError && err.capability === "image_out",
      );
    });

    it("rejects empty prompt", async () => {
      const tutor = makeTutor(["chat", "image_out"]);
      await assert.rejects(
        requestImageOut(tutor, { prompt: "  " }),
        (err: unknown) => err instanceof ToolCallError && err.status === 400,
      );
    });

    it("returns a parsed response on success", async () => {
      const tutor = makeTutor(["chat", "image_out"]);
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            imageBase64: "aGk=",
            mimeType: "image/png",
            altText: "a friendly dragon",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      const out = await requestImageOut(tutor, { prompt: "a dragon" });
      assert.equal(out.altText, "a friendly dragon");
    });
  });

  describe("requestAudioOut", () => {
    it("requires voice_out capability", async () => {
      const tutor = makeTutor(["chat"]);
      await assert.rejects(
        requestAudioOut(tutor, { prompt: "4-beat clap pattern" }),
        (err: unknown) =>
          err instanceof ToolCallError && err.capability === "voice_out",
      );
    });

    it("rejects durationMs over 30s", async () => {
      const tutor = makeTutor(["chat", "voice_out"]);
      await assert.rejects(
        requestAudioOut(tutor, { prompt: "x", durationMs: 60_000 }),
        (err: unknown) => err instanceof ToolCallError && err.status === 400,
      );
    });
  });
});
