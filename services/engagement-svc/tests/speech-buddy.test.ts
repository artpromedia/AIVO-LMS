import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DAILY_CAPS } from "../src/speechBuddy/index.js";

describe("engagement-svc speech buddy scaffold", () => {
  it("ships default daily caps for every age band", () => {
    assert.equal(DEFAULT_DAILY_CAPS["6-9"].cap, 1);
    assert.equal(DEFAULT_DAILY_CAPS["10-12"].cap, 2);
    assert.equal(DEFAULT_DAILY_CAPS["13-15"].cap, 3);
  });
});
