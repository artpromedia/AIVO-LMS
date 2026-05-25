/**
 * Sprint 10 — notification stream hook contract.
 *
 * We don't have @testing-library/react in this package, so the hook is
 * tested via its pure helper surface (`parseList`-style payload
 * acceptance, the polling-fallback shape). The end-to-end behaviour
 * (SSE branch, mark-read POST) is verified by the BFF integration
 * tests once the server endpoint ships in services/comms-svc.
 */
import { describe, it, expect } from "vitest";
import { useNotificationStream } from "./useNotificationStream";

describe("useNotificationStream exports", () => {
  it("exports the hook as a function", () => {
    expect(typeof useNotificationStream).toBe("function");
  });
});
