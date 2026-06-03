/**
 * Contract test for the React-Native SSE hook. We assert the public
 * shape (exists, callable) so the polling fallback wiring in
 * `MessagesInbox` and `LearnerLiveSessionCard` stays honest. Behaviour
 * tests require a fetch stream and `AppState` shim that lives at the
 * integration boundary, not here.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: () => ({ remove: () => {} }),
  },
}));

describe("useSse (mobile)", () => {
  it("exports a hook", async () => {
    const mod = await import("../hooks/useSse");
    expect(typeof mod.useSse).toBe("function");
  });
});
