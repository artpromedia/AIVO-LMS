/**
 * Sprint 8 — captions rendering contract.
 *
 * MediaSurface already supports `kind: "captions"` SurfaceAssetDescriptors
 * (rendered as `<track>` children of the `<video>` / `<audio>` element).
 * These tests pin that contract: every caption asset must be rendered
 * with the correct srcLang / label / default attributes, and a media
 * surface with zero caption assets must fall into the error branch
 * (a learner without captions is a hard fail per the accessibility
 * audit).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VideoSurface } from "../VideoSurface.js";
import { AudioSurface } from "../../Audio/AudioSurface.js";
import type { LearnerSurfaceSpec } from "../../types.js";

const baseSurface = (
  overrides: Partial<LearnerSurfaceSpec> & {
    captions?: Array<{ src: string; lang: string; label?: string; default?: boolean }>;
    type: "video" | "audio";
  },
): LearnerSurfaceSpec => ({
  id: "media-1",
  type: overrides.type,
  prompt: "Watch the clip.",
  capture: { finalAnswer: false },
  scoring: { mode: "exact" },
  accessibility: {
    altText: "media",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
  media: {
    src: "https://cdn.example.com/clip.mp4",
    mimeType: "video/mp4",
    assets: (overrides.captions ?? []).map((c) => ({
      type: "captions" as const,
      src: c.src,
      lang: c.lang,
      label: c.label,
      default: c.default,
    })),
  },
});

describe("VideoSurface captions", () => {
  it("renders one <track kind=captions> per caption asset", () => {
    const surface = baseSurface({
      type: "video",
      captions: [
        { src: "/c/en.vtt", lang: "en", label: "English", default: true },
        { src: "/c/es.vtt", lang: "es", label: "Español" },
      ],
    });
    const markup = renderToStaticMarkup(<VideoSurface surface={surface} />);
    expect(markup).toContain(`srcLang="en"`);
    expect(markup).toContain(`srcLang="es"`);
    expect(markup).toContain(`src="/c/en.vtt"`);
    expect(markup).toContain(`src="/c/es.vtt"`);
    expect(markup).toContain(`label="English"`);
    expect(markup).toContain(`kind="captions"`);
  });

  it("marks the default track when the asset sets default=true", () => {
    const surface = baseSurface({
      type: "video",
      captions: [{ src: "/c/en.vtt", lang: "en", default: true }],
    });
    const markup = renderToStaticMarkup(<VideoSurface surface={surface} />);
    // React serialises boolean defaults to either `default=""` or just `default`.
    expect(markup).toMatch(/default(="")?/);
  });

  it("falls back to the error branch when no captions are attached", () => {
    const surface = baseSurface({ type: "video", captions: [] });
    const markup = renderToStaticMarkup(<VideoSurface surface={surface} />);
    expect(markup).toContain("Captions are required");
    expect(markup).not.toContain("<video");
  });
});

describe("AudioSurface captions", () => {
  it("renders a caption track on the <audio> element", () => {
    const surface = baseSurface({
      type: "audio",
      captions: [{ src: "/c/audio.en.vtt", lang: "en", default: true }],
    });
    const markup = renderToStaticMarkup(<AudioSurface surface={surface} />);
    expect(markup).toContain(`src="/c/audio.en.vtt"`);
    expect(markup).toContain(`srcLang="en"`);
    expect(markup).toContain(`kind="captions"`);
  });

  it("rejects audio with no captions", () => {
    const surface = baseSurface({ type: "audio", captions: [] });
    const markup = renderToStaticMarkup(<AudioSurface surface={surface} />);
    expect(markup).toContain("Captions are required");
  });
});
