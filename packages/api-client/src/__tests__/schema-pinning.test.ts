/**
 * Schema-pinning test for the typed `@aivo/api-client/learning` module.
 *
 * Imports the Fastify JSON Schema definitions from
 * `services/learning-svc/src/routes/schemas.ts` directly (workspace
 * resolution) and asserts that for every operation we expose in
 * KNOWN_OPERATIONS:
 *
 *   - The upstream schema export still exists.
 *   - The upstream `operationId` still matches.
 *   - Every field in our `bodyRequired` list is still present in the
 *     upstream `body.required` array.
 *
 * If `services/learning-svc/src/routes/schemas.ts` is changed in a way
 * that breaks an operation (renamed op, removed required field), this
 * test fails and the api-client build is blocked until the typed
 * client is updated to match.
 */
import { describe, expect, it } from "vitest";
import { KNOWN_OPERATIONS } from "../learning/schemas.js";

// Import the upstream Fastify schemas. Resolve the path relative to this
// test file so the test works whether vitest runs from the package root
// or the repo root.
import * as upstream from "../../../../services/learning-svc/src/routes/schemas.js";

type FastifySchema = {
  operationId: string;
  body?: { required?: string[]; properties?: Record<string, unknown> };
  params?: { properties?: Record<string, unknown> };
  querystring?: { properties?: Record<string, unknown> };
  response?: Record<string, unknown>;
};

function findSchemaByOperationId(opId: string): FastifySchema | undefined {
  const entries = Object.values(upstream) as unknown[];
  for (const entry of entries) {
    if (
      entry &&
      typeof entry === "object" &&
      "operationId" in entry &&
      (entry as FastifySchema).operationId === opId
    ) {
      return entry as FastifySchema;
    }
  }
  return undefined;
}

describe("learning-svc schema pinning", () => {
  it("exposes a schema for every KNOWN_OPERATIONS entry", () => {
    for (const op of KNOWN_OPERATIONS) {
      const found = findSchemaByOperationId(op.operationId);
      expect(found, `upstream schema for operationId="${op.operationId}"`).toBeDefined();
    }
  });

  it("matches upstream body required-fields for every operation", () => {
    for (const op of KNOWN_OPERATIONS) {
      const found = findSchemaByOperationId(op.operationId);
      if (!found) continue; // covered by the first test
      const upstreamRequired = found.body?.required ?? [];
      for (const required of op.bodyRequired) {
        expect(
          upstreamRequired,
          `${op.operationId}: required field "${required}" missing in upstream body.required`,
        ).toContain(required);
      }
    }
  });

  it("never advertises an operation that has disappeared upstream", () => {
    // Reverse direction: the set of KNOWN_OPERATIONS operationIds must
    // be a subset of the upstream operationIds. If learning-svc
    // removes a route, this fires so the client can drop it too.
    const upstreamOps = new Set(
      (Object.values(upstream) as FastifySchema[])
        .filter((s) => s && typeof s === "object" && "operationId" in s)
        .map((s) => s.operationId),
    );
    for (const op of KNOWN_OPERATIONS) {
      expect(
        upstreamOps.has(op.operationId),
        `KNOWN_OPERATIONS still lists ${op.operationId} but learning-svc no longer ships it`,
      ).toBe(true);
    }
  });
});
