import { describe, it, expect, afterEach } from "vitest";
import {
  emitSurfaceTelemetry,
  setSurfaceTelemetrySink,
  type MobileSurfaceTelemetryEvent,
} from "../lib/surface-telemetry";

afterEach(() => setSurfaceTelemetrySink(null));

describe("mobile surface telemetry", () => {
  it("emits a well-formed event through the active sink", () => {
    const events: MobileSurfaceTelemetryEvent[] = [];
    setSurfaceTelemetrySink((e) => events.push(e));

    const returned = emitSurfaceTelemetry("art_canvas", "surface_started", { platform: "mobile" });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      surfaceKind: "art_canvas",
      type: "surface_started",
      payload: { platform: "mobile" },
    });
    expect(typeof events[0].occurredAt).toBe("string");
    expect(returned).toBe(events[0]);
  });

  it("reports a fallback surface as unsupported_surface", () => {
    const events: MobileSurfaceTelemetryEvent[] = [];
    setSurfaceTelemetrySink((e) => events.push(e));

    emitSurfaceTelemetry("geometry_workspace", "unsupported_surface", {
      reason: "no_dedicated_mobile_renderer",
    });

    expect(events[0].type).toBe("unsupported_surface");
    expect(events[0].surfaceKind).toBe("geometry_workspace");
    expect(events[0].payload).toMatchObject({ reason: "no_dedicated_mobile_renderer" });
  });

  it("never throws even if the sink throws", () => {
    setSurfaceTelemetrySink(() => {
      throw new Error("sink boom");
    });
    expect(() => emitSurfaceTelemetry("chart", "unsupported_surface")).not.toThrow();
  });
});
