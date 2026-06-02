import { describe, it, expect } from "vitest";
import {
  initBaseline,
  pickNextItem,
  recordResponse,
  shouldStop,
  type BaselineItem,
  type BaselineState,
} from "@aivo/adaptive-baseline";
import type { BaselineAssessment, BaselineAttempt, BaselineQuestion } from "@/lib/db/types";
import { questionsToBank } from "./baseline-stream";
import { streamNextQuestion, type StreamClient } from "./baseline-session";

let qSeq = 0;
function q(difficulty: BaselineQuestion["difficulty"]): BaselineQuestion {
  qSeq += 1;
  return {
    id: `q${qSeq}`,
    baselineId: "bas1",
    subjectId: "sub1",
    skillId: `sk${qSeq}`,
    order: qSeq,
    prompt: "p",
    difficulty,
    accommodationTags: [],
  };
}

let aSeq = 0;
function attempt(questionId: string, isCorrect: boolean, skipped = false): BaselineAttempt {
  aSeq += 1;
  return {
    id: `a${aSeq}`,
    baselineId: "bas1",
    questionId,
    learnerId: "lrn1",
    tenantId: "t1",
    response: "x",
    isCorrect,
    skipped,
    respondedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, aSeq)).toISOString(),
  };
}

function baseAssessment(adaptiveSessionId?: string): BaselineAssessment {
  return {
    id: "bas1",
    learnerId: "lrn1",
    tenantId: "t1",
    subjectIds: ["sub1"],
    status: "in_progress",
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    summary: null,
    adaptiveSessionId,
  };
}

/** In-memory assessment-svc double backed by the real engine. */
function makeFakeServer(bank: BaselineItem[]) {
  const sessions = new Map<string, { state: BaselineState; lastServedItemId: string | null }>();
  let counter = 0;
  const client: StreamClient = {
    async start({ priorTheta, readingDifficulty }) {
      const state = initBaseline({ priorTheta, readingDifficulty });
      const stop = shouldStop(state);
      const nextItem = stop.stop ? null : pickNextItem(state, bank);
      const sessionId = `sess${++counter}`;
      sessions.set(sessionId, { state, lastServedItemId: nextItem?.id ?? null });
      return { ok: true, sessionId, learnerId: "lrn1", nextItem, stop };
    },
    async respond({ sessionId, response }) {
      const s = sessions.get(sessionId);
      if (!s) return { ok: false, reason: "non_2xx", status: 404, message: "no session" };
      if (s.lastServedItemId !== null && response.itemId !== s.lastServedItemId) {
        return {
          ok: false,
          reason: "response_rejected",
          rejection: "unexpected_item",
          message: "x",
        };
      }
      const item = bank.find((b) => b.id === response.itemId);
      if (!item)
        return { ok: false, reason: "response_rejected", rejection: "unknown_item", message: "x" };
      const state = recordResponse({ state: s.state, item, response });
      const stop = shouldStop(state);
      const nextItem = stop.stop ? null : pickNextItem(state, bank);
      sessions.set(sessionId, { state, lastServedItemId: nextItem?.id ?? null });
      return { ok: true, sessionId, nextItem, stop, theta: state.theta };
    },
    async active() {
      const last = [...sessions.values()].at(-1);
      if (!last) return { ok: true, active: false };
      return {
        ok: true,
        active: true,
        itemsAdministered: last.state.administered.length,
        lastServedItemId: last.lastServedItemId,
        stop: shouldStop(last.state),
      };
    },
  };
  return { sessions, client };
}

describe("streamNextQuestion", () => {
  it("starts a fresh session and returns the first item", async () => {
    const questions = [q("foundational"), q("approaching"), q("grade_level")];
    const { client } = makeFakeServer(questionsToBank(questions));
    let persisted: string | undefined;

    const out = await streamNextQuestion({
      learnerId: "lrn1",
      baseline: baseAssessment(undefined),
      questions,
      attempts: [],
      learner: null,
      client,
      persistSessionId: (id) => {
        persisted = id;
      },
    });

    expect(out.mode).toBe("streaming");
    if (out.mode !== "streaming") return;
    expect(out.next).not.toBeNull();
    expect(persisted).toBeDefined();
    expect(out.sessionId).toBe(persisted);
  });

  it("G7: hands back the full question with accessibility fields (not a stripped item)", async () => {
    const rich: BaselineQuestion = {
      ...q("grade_level"),
      readAloudText: "Read this aloud",
      hint: "a hint",
      choiceEmojis: ["🐱", "🐶"],
      sceneEmoji: "🐱",
      accommodationTags: ["read_aloud"],
    };
    const questions = [rich, q("stretch")];
    const { client } = makeFakeServer(questionsToBank(questions));
    const out = await streamNextQuestion({
      learnerId: "lrn1",
      baseline: baseAssessment(undefined),
      questions,
      attempts: [],
      learner: null,
      client,
      persistSessionId: () => {},
    });
    expect(out.mode).toBe("streaming");
    if (out.mode !== "streaming") return;
    // Whatever the engine served, the returned object is the persisted
    // question (carries its accessibility fields), not the bank item.
    expect(out.next).not.toBeNull();
    expect(questions.some((x) => x.id === out.next!.id)).toBe(true);
    expect(out.next).toHaveProperty("accommodationTags");
  });

  it("reconciles a recorded answer and advances to a new item", async () => {
    const questions = [q("foundational"), q("approaching"), q("grade_level"), q("stretch")];
    const { client } = makeFakeServer(questionsToBank(questions));

    // Render 1 — fresh start.
    let sessionId = "";
    const first = await streamNextQuestion({
      learnerId: "lrn1",
      baseline: baseAssessment(undefined),
      questions,
      attempts: [],
      learner: null,
      client,
      persistSessionId: (id) => {
        sessionId = id;
      },
    });
    expect(first.mode).toBe("streaming");
    if (first.mode !== "streaming") return;
    const servedId = first.next!.id;

    // Render 2 — learner answered the served item.
    const second = await streamNextQuestion({
      learnerId: "lrn1",
      baseline: baseAssessment(sessionId),
      questions,
      attempts: [attempt(servedId, true)],
      learner: null,
      client,
      persistSessionId: () => {},
    });
    expect(second.mode).toBe("streaming");
    if (second.mode !== "streaming") return;
    expect(second.next).not.toBeNull();
    expect(second.next!.id).not.toBe(servedId);
  });

  it("falls back when the server rejects an out-of-sequence answer", async () => {
    const questions = [q("foundational"), q("approaching"), q("grade_level")];
    const { client } = makeFakeServer(questionsToBank(questions));

    let sessionId = "";
    const first = await streamNextQuestion({
      learnerId: "lrn1",
      baseline: baseAssessment(undefined),
      questions,
      attempts: [],
      learner: null,
      client,
      persistSessionId: (id) => {
        sessionId = id;
      },
    });
    if (first.mode !== "streaming") throw new Error("expected streaming");
    const servedId = first.next!.id;
    const otherId = questions.find((x) => x.id !== servedId)!.id;

    const out = await streamNextQuestion({
      learnerId: "lrn1",
      baseline: baseAssessment(sessionId),
      questions,
      attempts: [attempt(otherId, true)], // answered something we never served
      learner: null,
      client,
      persistSessionId: () => {},
    });
    expect(out.mode).toBe("fallback");
    if (out.mode === "fallback") expect(out.reason).toBe("response_rejected");
  });

  it("falls back when the session cannot be started", async () => {
    const questions = [q("grade_level")];
    const client: StreamClient = {
      async start() {
        return { ok: false, reason: "non_2xx", status: 500, message: "down" };
      },
      async respond() {
        throw new Error("unreachable");
      },
      async active() {
        return { ok: true, active: false };
      },
    };
    const out = await streamNextQuestion({
      learnerId: "lrn1",
      baseline: baseAssessment(undefined),
      questions,
      attempts: [],
      learner: null,
      client,
      persistSessionId: () => {},
    });
    expect(out.mode).toBe("fallback");
    if (out.mode === "fallback") expect(out.reason).toBe("non_2xx");
  });

  it("drives a full run to completion (next becomes null)", async () => {
    const questions = [q("foundational"), q("approaching"), q("grade_level"), q("stretch")];
    const { client } = makeFakeServer(questionsToBank(questions));

    let baseline = baseAssessment(undefined);
    const attempts: BaselineAttempt[] = [];
    let guard = 0;
    let next: BaselineQuestion | null | undefined;
    do {
      const out = await streamNextQuestion({
        learnerId: "lrn1",
        baseline,
        questions,
        attempts,
        learner: null,
        client,
        persistSessionId: (id) => {
          baseline = { ...baseline, adaptiveSessionId: id };
        },
      });
      expect(out.mode).toBe("streaming");
      if (out.mode !== "streaming") return;
      next = out.next;
      if (next) attempts.push(attempt(next.id, attempts.length % 2 === 0));
      guard += 1;
    } while (next && guard < 50);

    expect(next ?? null).toBeNull();
    expect(attempts.length).toBe(questions.length); // every item administered once
    expect(guard).toBeLessThan(50);
  });
});
