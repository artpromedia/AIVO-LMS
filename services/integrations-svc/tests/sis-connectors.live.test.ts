/**
 * Live vendor-sandbox validation for the Schoology + PowerSchool connectors.
 *
 * These tests hit the REAL vendor APIs and only run when sandbox credentials
 * are present in the environment — otherwise they skip. This is the final
 * gate the unit + wire-level e2e tests cannot cover (real auth, real response
 * shapes, real pagination). See docs/runbooks/sis-connector-validation.md.
 *
 * Required env (Schoology):  SCHOOLOGY_LIVE_TOKEN, SCHOOLOGY_LIVE_API_BASE
 * Required env (PowerSchool): POWERSCHOOL_LIVE_TOKEN, POWERSCHOOL_LIVE_URL
 */
import { describe, it, expect } from "vitest";
import { syncSchoology, syncPowerSchool } from "../src/routes/connectors.js";

function fakeDb() {
  const inserts: any[] = [];
  return {
    inserts,
    insert: () => ({
      values: (v: any) => ({
        onConflictDoNothing: () => {
          inserts.push(v);
          return Promise.resolve();
        },
      }),
    }),
  };
}

const schoologyReady = Boolean(
  process.env.SCHOOLOGY_LIVE_TOKEN && process.env.SCHOOLOGY_LIVE_API_BASE,
);
const powerschoolReady = Boolean(
  process.env.POWERSCHOOL_LIVE_TOKEN && process.env.POWERSCHOOL_LIVE_URL,
);

describe.skipIf(!schoologyReady)("Schoology live sandbox", () => {
  it("pulls a non-empty roster from the sandbox", async () => {
    const db = fakeDb();
    const res = await syncSchoology(
      db,
      { id: "live", config: { schoologyApiBase: process.env.SCHOOLOGY_LIVE_API_BASE } },
      { accessToken: process.env.SCHOOLOGY_LIVE_TOKEN },
    );
    expect(res.errors).toHaveLength(0);
    expect(res.synced).toBeGreaterThan(0);
  });
});

describe.skipIf(!powerschoolReady)("PowerSchool live sandbox", () => {
  it("pulls a non-empty roster from the sandbox", async () => {
    const db = fakeDb();
    const res = await syncPowerSchool(
      db,
      { id: "live", config: { powerschoolUrl: process.env.POWERSCHOOL_LIVE_URL } },
      { accessToken: process.env.POWERSCHOOL_LIVE_TOKEN },
    );
    expect(res.errors).toHaveLength(0);
    expect(res.synced).toBeGreaterThan(0);
  });
});
