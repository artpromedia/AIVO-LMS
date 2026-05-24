import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SurfaceHost } from "../SurfaceHost.js";
import type { LearnerSurfaceSpec } from "../types.js";

const baseSurface: Omit<LearnerSurfaceSpec, "id" | "type" | "prompt"> = {
  capture: { finalAnswer: true, inkStrokes: true },
  scoring: { mode: "exact" },
  accessibility: {
    altText: "Alt text",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
};

describe("SurfaceHost", () => {
  it("renders scratchpad, geometry, choice-grid, video, and audio surfaces", () => {
    const scratchpadMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s1",
          type: "scratchpad",
          prompt: "Draw your work",
          scratchpad: { enabled: true },
        }}
      />,
    );

    const geometryMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s2",
          type: "geometry_workspace",
          prompt: "Find the angle",
          diagram: {
            canvasMode: "svg",
            shapes: [{ id: "c", kind: "circle", cx: 100, cy: 100, r: 20 }],
          },
          scratchpad: { enabled: true },
          answerInput: { type: "number", label: "Angle" },
        }}
      />,
    );

    const choiceMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s3",
          type: "choice_grid",
          prompt: "Pick one",
          choices: [
            { id: "a", label: "Option A" },
            { id: "b", label: "Option B" },
          ],
        }}
      />,
    );

    const videoMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s5",
          type: "video",
          prompt: "Watch",
          media: {
            src: "https://example.invalid/video.m3u8",
            mimeType: "application/x-mpegURL",
            assets: [
              {
                type: "captions",
                src: "data:text/vtt;charset=utf-8,WEBVTT",
                lang: "en",
                default: true,
              },
            ],
          },
        }}
      />,
    );

    const audioMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s6",
          type: "audio",
          prompt: "Listen",
          media: {
            src: "https://example.invalid/audio.mp3",
            mimeType: "audio/mpeg",
            assets: [
              {
                type: "captions",
                src: "data:text/vtt;charset=utf-8,WEBVTT",
                lang: "en",
                default: true,
              },
            ],
          },
        }}
      />,
    );

    expect(scratchpadMarkup).toContain("scratchpad-surface");
    expect(geometryMarkup).toContain("geometry-surface");
    expect(choiceMarkup).toContain("choice-grid-surface");
    expect(videoMarkup).toContain("video-surface");
    expect(audioMarkup).toContain("audio-surface");
  });

  it("renders fallback and emits telemetry for unsupported surfaces", () => {
    const events: Array<{ type: string }> = [];

    const unsupportedMarkup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s4",
          type: "graph",
          prompt: "Unsupported",
        }}
        onEvent={(event) => events.push({ type: event.type })}
      />,
    );

    expect(unsupportedMarkup).toContain("Activity type unavailable");
    expect(events.some((event) => event.type === "unsupported_surface")).toBe(true);
  });

  it("requires captions for media surfaces and emits telemetry", () => {
    const events: Array<{ type: string }> = [];

    const markup = renderToStaticMarkup(
      <SurfaceHost
        surface={{
          ...baseSurface,
          id: "s7",
          type: "video",
          prompt: "Needs captions",
          media: {
            src: "https://example.invalid/video.mp4",
            mimeType: "video/mp4",
            assets: [],
          },
        }}
        onEvent={(event) => events.push({ type: event.type })}
      />,
    );

    expect(markup).toContain("Captions are required");
    expect(events.some((event) => event.type === "captions_missing")).toBe(true);
  });
});
