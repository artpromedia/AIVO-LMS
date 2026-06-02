import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerGovernanceSubscriber } from "@aivo/enterprise-core";
import { runErasureFanout } from "../orchestrator/erasure.js";
import { runExportFanout, validateArt20Bundle } from "../orchestrator/export.js";
import type { GovernanceFetch, Subscriber } from "../orchestrator/subscribers.js";

/**
 * Integration: drive the real `registerGovernanceSubscriber` handlers via
 * the orchestrator. Instead of HTTP we route the orchestrator's dispatch
 * through `app.inject`, so this exercises the actual subscriber contract
 * end to end — proving a full erasure fan-out leaves zero records in
 * data services while audit keeps an anonymized (not deleted) trail.
 */

// A learning-data service: a subject's rows are hard-deleted.
function buildLearningApp() {
  const app = Fastify({ logger: false });
  // Simulated store, seeded with the subject's rows.
  const store = { lesson_runs: 3, chat_logs: 5 };
  registerGovernanceSubscriber(app, {
    service: "learning-svc",
    internalKey: "test-key",
    erase: () => {
      const counts = { ...store };
      store.lesson_runs = 0;
      store.chat_logs = 0;
      return { counts };
    },
    export: () => ({
      counts: { lesson_runs: store.lesson_runs },
      bundle: { lessonRuns: [], chatLogs: [] },
    }),
  });
  return { app, store };
}

// audit-svc: anonymize actor info, preserve the hash-chained rows.
function buildAuditApp() {
  const app = Fastify({ logger: false });
  const chain = { audit_events: 8, anonymized: 0 };
  registerGovernanceSubscriber(app, {
    service: "audit-svc",
    internalKey: "test-key",
    erase: () => {
      // No deletions — rows stay so the hash chain is intact; actor PII is
      // scrubbed in place.
      chain.anonymized = chain.audit_events;
      return { counts: {}, anonymizedCounts: { audit_events: chain.audit_events } };
    },
    export: () => ({ counts: { audit_events: chain.audit_events }, bundle: { events: [] } }),
  });
  return { app, chain };
}

describe("governance subscriber contract (integration)", () => {
  it("full erasure fan-out empties data services and anonymizes audit", async () => {
    const learning = buildLearningApp();
    const audit = buildAuditApp();
    const apps: Record<string, ReturnType<typeof Fastify>> = {
      "learning-svc": learning.app,
      "audit-svc": audit.app,
    };
    const subscribers: Subscriber[] = [
      { name: "learning-svc", baseUrl: "http://learning" },
      { name: "audit-svc", baseUrl: "http://audit" },
    ];
    const injectFetch: GovernanceFetch = async (sub, path, body) => {
      const res = await apps[sub.name].inject({
        method: "POST",
        url: path,
        headers: { "x-internal-key": "test-key" },
        payload: body,
      });
      const json = res.json();
      return {
        service: sub.name,
        ok: res.statusCode === 200,
        counts: json.counts ?? {},
        anonymizedCounts: json.anonymizedCounts,
      };
    };

    const outcome = await runErasureFanout(
      { subjectId: "learner-9", subjectType: "learner" },
      { subscribers, fetchImpl: injectFetch },
    );

    expect(outcome.allConfirmed).toBe(true);
    expect(outcome.totalErased).toBe(8); // 3 + 5 from learning
    expect(outcome.totalAnonymized).toBe(8); // audit rows kept, anonymized
    // Zero records remain in the data service after erasure.
    expect(learning.store.lesson_runs).toBe(0);
    expect(learning.store.chat_logs).toBe(0);
    // Audit chain preserved (rows not deleted), but anonymized.
    expect(audit.chain.audit_events).toBe(8);
    expect(audit.chain.anonymized).toBe(8);

    await learning.app.close();
    await audit.app.close();
  });

  it("rejects an erase call without the internal key", async () => {
    const { app } = buildLearningApp();
    const res = await app.inject({
      method: "POST",
      url: "/__governance/erase",
      payload: { subjectId: "x" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("export fan-out assembles an Art. 20 bundle from real subscribers", async () => {
    const learning = buildLearningApp();
    const audit = buildAuditApp();
    const apps: Record<string, ReturnType<typeof Fastify>> = {
      "learning-svc": learning.app,
      "audit-svc": audit.app,
    };
    const subscribers: Subscriber[] = [
      { name: "learning-svc", baseUrl: "http://learning" },
      { name: "audit-svc", baseUrl: "http://audit" },
    ];
    const injectFetch: GovernanceFetch = async (sub, path, body) => {
      const res = await apps[sub.name].inject({
        method: "POST",
        url: path,
        headers: { "x-internal-key": "test-key" },
        payload: body,
      });
      const json = res.json();
      return {
        service: sub.name,
        ok: res.statusCode === 200,
        counts: json.counts ?? {},
        bundle: json.bundle,
      };
    };
    const bundle = await runExportFanout(
      { subjectId: "learner-9" },
      { subscribers, fetchImpl: injectFetch },
    );
    expect(validateArt20Bundle(bundle).valid).toBe(true);
    expect(Object.keys(bundle.data).sort()).toEqual(["audit-svc", "learning-svc"]);
    await learning.app.close();
    await audit.app.close();
  });
});
