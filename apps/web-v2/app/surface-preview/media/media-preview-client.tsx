"use client";

import { SurfaceHost, type LearnerSurfaceSpec } from "@aivo/learner-surfaces";

const captionSrc =
  "data:text/vtt;charset=utf-8,WEBVTT%0A%0A00:00:00.000%20-->%2000:00:04.000%0ACaptions%20are%20working.%0A";

const surface: LearnerSurfaceSpec = {
  id: "preview-video",
  type: "video",
  prompt: "Preview video with captions",
  capture: { finalAnswer: true },
  scoring: { mode: "exact" },
  accessibility: {
    altText: "Media preview",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
  media: {
    src: "https://example.invalid/preview.m3u8",
    mimeType: "application/x-mpegURL",
    assets: [{ type: "captions", src: captionSrc, lang: "en", label: "English", default: true }],
  },
};

export function MediaPreviewClient() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Surface preview: media captions</h1>
      <SurfaceHost
        surface={surface}
        accessibilityPreferences={{
          largeText: true,
          reducedMotion: true,
        }}
      />
    </div>
  );
}

