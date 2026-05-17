import { describe, expect, it } from "vitest";
import {
  problemSessions,
  problemSessionEvents,
  problemSessionSurfaceSnapshots,
  problemSessionAttempts,
} from "../schema/problem-sessions.js";

describe("problem-sessions schema", () => {
  it("exposes the ledger tables", () => {
    expect(problemSessions).toBeDefined();
    expect(problemSessionEvents).toBeDefined();
    expect(problemSessionSurfaceSnapshots).toBeDefined();
    expect(problemSessionAttempts).toBeDefined();
  });

  it("includes the required columns on problem_sessions", () => {
    const columns = Object.keys(problemSessions);
    for (const col of [
      "id",
      "tenantId",
      "learnerId",
      "subject",
      "skillCode",
      "standardCode",
      "source",
      "sourceSessionId",
      "tutorSku",
      "status",
      "startedAt",
      "completedAt",
      "metadataJson",
      "createdAt",
      "updatedAt",
    ]) {
      expect(columns).toContain(col);
    }
  });

  it("includes the required columns on problem_session_events", () => {
    const columns = Object.keys(problemSessionEvents);
    for (const col of [
      "id",
      "problemSessionId",
      "tenantId",
      "learnerId",
      "eventType",
      "eventPayloadJson",
      "redactedPayloadJson",
      "occurredAt",
      "createdAt",
    ]) {
      expect(columns).toContain(col);
    }
  });

  it("includes the required columns on problem_session_attempts", () => {
    const columns = Object.keys(problemSessionAttempts);
    for (const col of [
      "id",
      "problemSessionId",
      "attemptNumber",
      "responseJson",
      "correct",
      "score",
      "latencyMs",
      "hintCount",
      "eraserCount",
      "toolChangeCount",
      "createdAt",
    ]) {
      expect(columns).toContain(col);
    }
  });

  it("includes the required columns on problem_session_surface_snapshots", () => {
    const columns = Object.keys(problemSessionSurfaceSnapshots);
    for (const col of [
      "id",
      "problemSessionId",
      "surfaceId",
      "snapshotType",
      "snapshotJson",
      "storageUrl",
      "strokeCount",
      "createdAt",
    ]) {
      expect(columns).toContain(col);
    }
  });
});
