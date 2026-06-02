import { describe, it, expect } from "vitest";
import {
  REGULATION_FULFILLMENT_DAYS,
  stricterFulfillmentDays,
  resolveSlaConfig,
  computeDeadlines,
  evaluateSla,
  formatRemaining,
  DEFAULT_ACK_HOURS,
} from "../domain/sla.js";

const T0 = new Date("2026-06-01T00:00:00.000Z");

describe("SLA fulfillment windows", () => {
  it("uses the stricter window when multiple regimes apply", () => {
    expect(stricterFulfillmentDays(["gdpr", "ccpa"])).toBe(30); // GDPR stricter
    expect(stricterFulfillmentDays(["ccpa"])).toBe(45);
    expect(stricterFulfillmentDays([])).toBe(REGULATION_FULFILLMENT_DAYS.gdpr);
  });

  it("clamps a tenant override so it can only get stricter", () => {
    // 60-day override is looser than GDPR's 30 → clamped to 30.
    expect(resolveSlaConfig(["gdpr"], { fulfillmentDays: 60 }).fulfillmentDays).toBe(30);
    // 15-day override is stricter → allowed.
    expect(resolveSlaConfig(["ccpa"], { fulfillmentDays: 15 }).fulfillmentDays).toBe(15);
    // Ack hours likewise clamp at the 72h statutory ceiling.
    expect(resolveSlaConfig(["gdpr"], { ackHours: 96 }).ackHours).toBe(DEFAULT_ACK_HOURS);
    expect(resolveSlaConfig(["gdpr"], { ackHours: 24 }).ackHours).toBe(24);
  });
});

describe("deadline computation", () => {
  it("puts ack at +72h and fulfillment at +30d for GDPR", () => {
    const d = computeDeadlines(T0, resolveSlaConfig(["gdpr"]));
    expect(d.ackDueAt).toBe("2026-06-04T00:00:00.000Z"); // +72h
    expect(d.fulfillmentDueAt).toBe("2026-07-01T00:00:00.000Z"); // +30d
  });
});

describe("live SLA evaluation", () => {
  const deadlines = computeDeadlines(T0, resolveSlaConfig(["gdpr"]));

  it("is on_track early in the window", () => {
    const s = evaluateSla({ deadlines, now: new Date("2026-06-05T00:00:00Z") });
    expect(s.state).toBe("on_track");
    expect(s.fulfillmentOverdue).toBe(false);
  });

  it("is due_soon within 3 days of the fulfillment deadline", () => {
    const s = evaluateSla({ deadlines, now: new Date("2026-06-29T00:00:00Z") });
    expect(s.state).toBe("due_soon");
  });

  it("is overdue past the fulfillment deadline", () => {
    const s = evaluateSla({ deadlines, now: new Date("2026-07-03T00:00:00Z") });
    expect(s.state).toBe("overdue");
    expect(s.fulfillmentOverdue).toBe(true);
    expect(s.fulfillmentRemainingMs).toBeLessThan(0);
  });

  it("flags an unmet ack clock as overdue", () => {
    // 4 days in, still not acknowledged → ack overdue (ack due at +72h).
    const s = evaluateSla({ deadlines, now: new Date("2026-06-05T00:00:00Z") });
    expect(s.ackOverdue).toBe(true);
  });

  it("stops the clocks once fulfilled", () => {
    const s = evaluateSla({
      deadlines,
      now: new Date("2026-08-01T00:00:00Z"),
      acknowledgedAt: "2026-06-02T00:00:00Z",
      fulfilledAt: "2026-06-20T00:00:00Z", // before the 30-day deadline
    });
    expect(s.state).toBe("met");
    expect(s.fulfillmentOverdue).toBe(false);
  });

  it("records a late fulfillment as overdue even in met state", () => {
    const s = evaluateSla({
      deadlines,
      now: new Date("2026-08-01T00:00:00Z"),
      fulfilledAt: "2026-07-10T00:00:00Z", // after the 30-day deadline
    });
    expect(s.state).toBe("met");
    expect(s.fulfillmentOverdue).toBe(true);
  });
});

describe("formatRemaining", () => {
  it("formats positive and overdue durations", () => {
    expect(formatRemaining(2 * 86400000 + 4 * 3600000)).toBe("2d 4h");
    expect(formatRemaining(5 * 3600000)).toBe("5h");
    expect(formatRemaining(-3 * 3600000)).toBe("overdue 3h");
  });
});
