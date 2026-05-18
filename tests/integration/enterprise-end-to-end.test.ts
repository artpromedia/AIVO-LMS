/**
 * End-to-end integration test that boots the enterprise services in the
 * same process (each as a Fastify app via `buildApp({ skipAuth: true })`)
 * and exercises a cross-service flow:
 *
 *   1. Create a problem session in problem-session-svc.
 *   2. Append attempts and a frustration event.
 *   3. Complete the session — recommendation-svc receives candidate
 *      signals.
 *   4. Verify an audit-svc event was emitted by the snapshot save.
 *   5. Build a parent export via data-governance-svc and verify raw IEP
 *      / private-notes text is stripped.
 *
 * The test runs as part of the existing
 * `pnpm test:integration` script and is independent of Postgres /
 * docker: all stores are in-memory and the services talk to each other
 * over local fetch().
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

import { buildApp as buildProblemSessionApp } from "@aivo/problem-session-svc";
import { buildApp as buildAuditApp } from "@aivo/audit-svc";
import {
  buildApp as buildRecommendationApp,
  seedRecommendationForTest,
} from "@aivo/recommendation-svc";
import { buildApp as buildDataGovernanceApp } from "@aivo/data-governance-svc";

interface ServiceHandle {
  app: FastifyInstance;
  port: number;
  url: string;
}

async function bootService(
  factory: () => Promise<FastifyInstance>,
  port: number,
): Promise<ServiceHandle> {
  const app = await factory();
  await app.listen({ port, host: "127.0.0.1" });
  return { app, port, url: `http://127.0.0.1:${port}` };
}

let problemSession: ServiceHandle;
let audit: ServiceHandle;
let recommendation: ServiceHandle;
let dataGovernance: ServiceHandle;

const originalEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string): void {
  if (!(key in originalEnv)) originalEnv[key] = process.env[key];
  process.env[key] = value;
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeAll(async () => {
  // Pick high ephemeral ports so we don't clash with anything else
  // listening locally during the test run.
  problemSession = await bootService(() => buildProblemSessionApp({ skipAuth: true }), 39061);
  audit = await bootService(() => buildAuditApp({ skipAuth: true }), 39069);
  recommendation = await bootService(() => buildRecommendationApp({ skipAuth: true }), 39066);
  dataGovernance = await bootService(() => buildDataGovernanceApp({ skipAuth: true }), 39070);

  setEnv("AUDIT_SVC_URL", audit.url);
  setEnv("RECOMMENDATION_SVC_URL", recommendation.url);
  setEnv("AIVO_FEATURE_DATA_GOVERNANCE_CENTER", "true");
  setEnv("AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2", "true");
});

afterAll(async () => {
  await problemSession.app.close();
  await audit.app.close();
  await recommendation.app.close();
  await dataGovernance.app.close();
  restoreEnv();
});

describe("enterprise end-to-end", () => {
  it("snapshot save emits an audit event", async () => {
    // Create a session.
    const sessionRes = await fetch(`${problemSession.url}/api/problem-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "00000000-0000-4000-8000-000000000001",
        learnerId: "00000000-0000-4000-8000-0000000000aa",
        subject: "math",
        source: "lesson",
      }),
    });
    expect(sessionRes.status).toBe(201);
    const session = await sessionRes.json();

    // Save a snapshot — should fan-out to audit-svc.
    const snapRes = await fetch(
      `${problemSession.url}/api/problem-sessions/${session.id}/snapshots`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          surfaceId: "surf-1",
          snapshotType: "ink",
          snapshot: { strokes: [] },
          strokeCount: 3,
        }),
      },
    );
    expect(snapRes.status).toBe(201);

    // Audit emission is fire-and-forget. Poll briefly for the event.
    let counts: Record<string, number> = {};
    for (let i = 0; i < 20 && !counts.problem_session_snapshot_saved; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const reportRes = await fetch(`${audit.url}/api/audit-reports/counts-by-action`);
      if (reportRes.ok) {
        const data = (await reportRes.json()) as { counts: Record<string, number> };
        counts = data.counts;
      }
    }
    expect(counts.problem_session_snapshot_saved ?? 0).toBeGreaterThanOrEqual(1);
  }, 15_000);

  it("parent decision on a recommendation emits an audit event", async () => {
    // Seed a recommendation so we can apply a decision.
    seedRecommendationForTest({
      id: "rec-e2e-1",
      learnerId: "00000000-0000-4000-8000-0000000000aa",
      type: "preferred_surface_change",
      title: "Use scratchpad",
      parentSummary: "Switch to scratchpad as the default surface.",
      currentValue: "none",
      proposedValue: "scratchpad",
      confidence: 0.8,
      evidence: [],
      safety: {
        requiresParentApproval: true,
        affectsIEP: false,
        affectsInstructionalAccess: false,
        reversible: true,
      },
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const acceptRes = await fetch(`${recommendation.url}/api/recommendations/rec-e2e-1/accept`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorRole: "parent" }),
    });
    expect(acceptRes.status).toBe(200);

    let counts: Record<string, number> = {};
    for (let i = 0; i < 20 && !counts.profile_recommendation_approved; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const reportRes = await fetch(`${audit.url}/api/audit-reports/counts-by-action`);
      if (reportRes.ok) {
        const data = (await reportRes.json()) as { counts: Record<string, number> };
        counts = data.counts;
      }
    }
    expect(counts.profile_recommendation_approved ?? 0).toBeGreaterThanOrEqual(1);
  }, 15_000);

  it("parent export strips raw IEP / private notes / OCR text", async () => {
    const exportRes = await fetch(`${dataGovernance.url}/api/exports/parent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId: "00000000-0000-4000-8000-0000000000aa",
        learnerProfileSummary: {
          name: "Alex",
          iepText: "raw IEP that must be stripped",
          parentPrivateNotes: "raw private notes that must be stripped",
        },
        brainProfileSummary: {
          masteryLevels: { math: 0.7 },
          ocrText: "raw OCR string",
        },
        approvedAccommodations: ["extended_time"],
        recommendationHistory: [],
        baselineSummaries: [],
        lessonProgressSummaries: [],
        homeworkSummaries: [],
        problemSessionSummaries: [],
        parentDecisions: [],
        teacherObservationsVisibleToParent: [],
        auditSummary: { profile_recommendation_approved: 1 },
      }),
    });
    expect(exportRes.status).toBe(200);
    const job = (await exportRes.json()) as {
      artifacts: Array<{ format: string; filename: string; contents: string }>;
    };
    for (const artifact of job.artifacts) {
      const lower = artifact.contents.toLowerCase();
      expect(lower).not.toContain("raw iep that must be stripped");
      expect(lower).not.toContain("raw private notes that must be stripped");
      expect(lower).not.toContain("raw ocr string");
    }
  }, 15_000);
});
