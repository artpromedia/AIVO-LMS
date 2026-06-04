/**
 * Contract test for the realtime SSE hook. We pin the public shape so
 * the polling fallback wiring upstream stays honest. Behaviour-level
 * tests (open/closed/error transitions, backoff) require a real
 * EventSource and live with the integration smoke that talks to a real
 * upstream — out of scope for the unit boundary.
 */
import { describe, it, expect } from "vitest";
import { useSse } from "./use-sse";

describe("useSse", () => {
  it("exports a hook", () => {
    expect(typeof useSse).toBe("function");
  });
});
