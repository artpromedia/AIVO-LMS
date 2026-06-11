/**
 * Wave A (G2) — unit tests for the degradation telemetry fan-out.
 *
 * The module's contract: always log + count, page only through the
 * (injected) sender, escalate auth-shaped failures to critical, and
 * never throw into the caller even when the pager is down.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetDegradationForTests,
  __setDegradationAlertSenderForTests,
  emitDegradation,
} from "@/lib/observability/degradation";
import type { LegacyOpsAlert } from "@aivo/ops-alerts";

function captureSender() {
  const sent: LegacyOpsAlert[] = [];
  const sender = vi.fn(async (alert: LegacyOpsAlert) => {
    sent.push(alert);
    return { delivered: true, deduped: false };
  });
  __setDegradationAlertSenderForTests(sender);
  return { sent, sender };
}

afterEach(() => {
  __resetDegradationForTests();
});

describe("emitDegradation", () => {
  it("routes the event to the alert sender with a dedup key", async () => {
    const { sent } = captureSender();
    emitDegradation("baseline_generic_fallback", {
      reason: "timeout",
      learnerId: "lrn-1",
      message: "assessment-svc timed out",
    });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.severity).toBe("warning");
    expect(sent[0]!.title).toContain("baseline_generic_fallback");
    expect(sent[0]!.dedupKey).toBe("baseline_generic_fallback:timeout");
    expect(sent[0]!.body).toContain("assessment-svc timed out");
  });

  it("escalates 401/403 upstream failures to critical with a token hint", async () => {
    const { sent } = captureSender();
    emitDegradation("baseline_generic_fallback", { reason: "non_2xx", status: 401 });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.severity).toBe("critical");
    expect(sent[0]!.body).toContain("ASSESSMENT_SVC_SERVICE_TOKEN");
    expect(sent[0]!.body).toContain("401");
  });

  it("marks a mock provider in production as critical by default", async () => {
    const { sent } = captureSender();
    emitDegradation("lesson_provider_mock_in_prod", {
      reason: "missing_api_key",
      provider: "anthropic",
    });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.severity).toBe("critical");
    expect(sent[0]!.fields?.provider).toBe("anthropic");
  });

  it("does not page outside production when no test sender is injected", () => {
    // NODE_ENV is "test" under vitest; without the injected sender the
    // module must not build a real alerts client (nothing to assert via
    // the network — the contract is simply that this does not throw and
    // does not create timers that keep the process alive).
    expect(() =>
      emitDegradation("lesson_fallback_after_retries", { reason: "schema_mismatch" }),
    ).not.toThrow();
  });

  it("swallows sender failures (paging outage never breaks the caller)", async () => {
    const sender = vi.fn(async () => {
      throw new Error("alerts-proxy down");
    });
    __setDegradationAlertSenderForTests(sender as never);
    expect(() =>
      emitDegradation("lesson_fallback_after_retries", { reason: "provider_error" }),
    ).not.toThrow();
    await vi.waitFor(() => expect(sender).toHaveBeenCalledTimes(1));
  });
});
