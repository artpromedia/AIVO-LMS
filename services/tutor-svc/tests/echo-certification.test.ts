/**
 * Wave E (S10) — Echo certification spec.
 *
 * Echo (speech) is the highest-risk agentic tutor: it serves learners
 * down to PRE_SYMBOLIC, overlaps the bespoke Speech Buddy audio core,
 * and carries the one domain tool whose backing service can legitimately
 * REFUSE (speech-eval without an ASR provider). This spec certifies the
 * configuration invariants that make Echo safe to onboard:
 *
 *   1. Instruments — score_pronunciation is declared AND its adapter is
 *      executable (real service contract, multipart).
 *   2. Action floor — free-text `say` is impossible at LOW_VERBAL and
 *      below at EVERY layer Echo touches (policy, validator, machine).
 *   3. Delegation — live voice still routes to Speech Buddy; the agent
 *      loop must not become a second, unconsented audio path.
 *   4. Refusal honesty — an ASR refusal reaches the model as an error,
 *      never as fabricated pronunciation scores.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { validateTutorDefinition, NO_SAY_LEVELS } from "@aivo/tutor-sdk";
import { SessionMachine } from "@aivo/stage-runtime";
import type { Beat } from "@aivo/stage-ui";
import { speechTutor } from "../src/modes/speechTutor.js";
import { getTutorDefinition } from "../src/modes/registry.js";
import { registerTutorSessionRoutes } from "../src/routes/tutorSession.js";
import { executeDomainTool } from "../src/agent/tools.js";
import { DOMAIN_TOOLS, READ_TOOLS } from "../src/agent/orchestrator.js";

describe("Echo certification — instruments", () => {
  it("is the registry's echo entry and validates clean", () => {
    assert.equal(getTutorDefinition("echo"), speechTutor);
    assert.deepEqual(validateTutorDefinition(speechTutor), []);
  });

  it("declares score_pronunciation and only executable tools", () => {
    assert.ok(speechTutor.toolset.includes("score_pronunciation"));
    for (const tool of speechTutor.toolset) {
      assert.ok(
        READ_TOOLS.has(tool) || DOMAIN_TOOLS.has(tool),
        `tool ${tool} has no executor`,
      );
    }
  });
});

describe("Echo certification — the say floor holds at every layer", () => {
  it("policy: say is absent from LOW_VERBAL, NON_VERBAL, PRE_SYMBOLIC", () => {
    for (const level of NO_SAY_LEVELS) {
      const actions = speechTutor.actionPolicy[level] ?? [];
      assert.ok(!actions.includes("say"), `say leaked into ${level}`);
      assert.ok(actions.length > 0, `${level} still has regulation moves`);
    }
  });

  it("machine: a say proposed below the floor is rejected with a deterministic next", () => {
    for (const level of ["LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"] as const) {
      const beats: Beat[] = [
        { id: "b0", type: "narration", tutorState: "idle" },
        { id: "b1", type: "interaction", tutorState: "idle" },
      ];
      const machine = new SessionMachine({
        learnerId: "cert",
        functioningLevel: level,
        beats,
        initialPhase: "core",
      });
      const verdict = machine.proposeTransition({ kind: "say" });
      assert.equal(verdict.accepted, false);
      assert.ok(!verdict.accepted && verdict.reason === "say_below_floor");
      assert.ok(!verdict.accepted && verdict.deterministicNext === "advance");
    }
  });
});

describe("Echo certification — voice delegation is preserved", () => {
  it("the plan route still hands the live audio loop to Speech Buddy", async () => {
    const app = Fastify({ logger: false });
    registerTutorSessionRoutes(app);
    await app.ready();
    const res = await app.inject({
      method: "POST",
      url: "/api/tutors/echo/plan",
      payload: {
        learnerId: "lrn-cert",
        functioningLevel: "STANDARD",
        // Echo's honest coverageMatrix (remediation Sprint 01) authors K, 3,
        // and 7 only — this certification exercises the Speech-Buddy
        // delegation handshake, so it must run on an authored band; grade 2
        // is now correctly refused as grade_band_not_production.
        gradeBand: "3",
        consentRecordId: "consent-cert",
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as {
      delegate?: { kind: string; endpoint: string };
    };
    assert.equal(body.delegate?.kind, "speech-buddy");
    assert.equal(body.delegate?.endpoint, "/api/speech-buddy/sessions");
    await app.close();
  });
});

describe("Echo certification — refusal honesty", () => {
  it("a speech-eval 503 surfaces as an error, never as scores", async () => {
    const result = await executeDomainTool(
      "score_pronunciation",
      {
        target_text: "ship",
        audio_base64: Buffer.from("audio").toString("base64"),
      },
      {
        learnerId: "lrn-cert",
        observation: {
          beatIndex: 1,
          totalBeats: 3,
          beatKind: "guided",
          beatKinds: ["welcome", "guided", "celebrate"],
          prompt: "Say: ship",
          learnerResponse: "",
          isCorrect: false,
        },
      },
      {
        fetchImpl: (async () => ({
          ok: false,
          status: 503,
          json: async () => ({}),
          text: async () => '{"error":"Speech evaluation is temporarily unavailable"}',
        })) as unknown as typeof fetch,
      },
    );
    assert.ok(typeof result.error === "string");
    assert.equal(result.pronunciation, undefined, "no fabricated score fields");
    assert.equal(result.fluency, undefined);
  });
});
