import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SurfaceHost } from "../SurfaceHost.js";
import type { LearnerSurfaceSpec } from "../types.js";

const baseSurface: Omit<LearnerSurfaceSpec, "id" | "type" | "prompt"> = {
  capture: { finalAnswer: true },
  scoring: { mode: "rubric" },
  accessibility: {
    altText: "Voice prompt",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
};

const voiceSurface: LearnerSurfaceSpec = {
  ...baseSurface,
  id: "vr1",
  type: "voice_response",
  prompt: "Say the days of the week",
  instructions: "Record yourself saying all seven days.",
  voiceResponse: {
    language: "en-US",
    targetText: "Sunday Monday Tuesday Wednesday Thursday Friday Saturday",
    maxDurationSeconds: 30,
  },
};

describe("VoiceResponseSurface", () => {
  it("renders via SurfaceHost without crashing", () => {
    const markup = renderToStaticMarkup(<SurfaceHost surface={voiceSurface} />);
    expect(markup).toContain("voice-response-surface");
    expect(markup).toContain("Say the days of the week");
    expect(markup).toContain("Record yourself saying all seven days.");
  });

  it("renders record and submit buttons in idle state (SSR)", () => {
    const markup = renderToStaticMarkup(<SurfaceHost surface={voiceSurface} />);
    expect(markup).toContain("record voice answer");
    expect(markup).toContain("submit voice answer");
  });

  it("renders locked panel when lingua tutor not entitled", () => {
    const events: Array<{ type: string; payload?: Record<string, unknown> }> = [];
    const markup = renderToStaticMarkup(
      <SurfaceHost
        surface={voiceSurface}
        entitledTutors={[]}
        onEvent={(e) => events.push({ type: e.type, payload: e.payload })}
      />,
    );
    expect(markup).toContain("locked learner surface");
    expect(events.some((e) => e.type === "unsupported_surface")).toBe(true);
  });

  it("defaults to entitled when entitledTutors not supplied", () => {
    const markup = renderToStaticMarkup(<SurfaceHost surface={voiceSurface} />);
    expect(markup).not.toContain("locked learner surface");
    expect(markup).toContain("voice-response-surface");
  });

  it("renders with reduced-motion spec (no level meter in SSR)", () => {
    const reducedSurface: LearnerSurfaceSpec = {
      ...voiceSurface,
      accessibility: { ...voiceSurface.accessibility, reduceMotionSafe: true },
    };
    const markup = renderToStaticMarkup(<SurfaceHost surface={reducedSurface} />);
    // Level meter is not rendered in SSR / idle state
    expect(markup).not.toContain("recording level");
  });

  it("emits surface_started telemetry on mount", () => {
    const events: Array<{ type: string }> = [];
    renderToStaticMarkup(
      <SurfaceHost surface={voiceSurface} onEvent={(e) => events.push({ type: e.type })} />,
    );
    expect(events.some((e) => e.type === "surface_started")).toBe(true);
  });

  it("renders a surface with no voiceResponse spec (uses prompt as targetText)", () => {
    const noSpec: LearnerSurfaceSpec = {
      ...baseSurface,
      id: "vr2",
      type: "voice_response",
      prompt: "Repeat after me",
    };
    const markup = renderToStaticMarkup(<SurfaceHost surface={noSpec} />);
    expect(markup).toContain("voice-response-surface");
    expect(markup).toContain("Repeat after me");
  });
});
