import type { LearnerSurfaceSpec } from "../src/types.js";
import { SurfaceHost } from "../src/SurfaceHost.js";

const baseSurface: Omit<LearnerSurfaceSpec, "id" | "type" | "prompt"> = {
  capture: { finalAnswer: true },
  scoring: { mode: "exact" },
  accessibility: {
    altText: "Media surface",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
};

const captionsAsset = {
  type: "captions" as const,
  src: "data:text/vtt;charset=utf-8,WEBVTT%0A%0A00:00:00.000%20-->%2000:00:05.000%0AWelcome%20to%20captions!%0A",
  lang: "en",
  label: "English",
  default: true,
};

export default {
  title: "Learner Surfaces/Media",
};

export function VideoWithCaptions() {
  return (
    <SurfaceHost
      surface={{
        ...baseSurface,
        id: "story-video",
        type: "video",
        prompt: "Watch and follow along.",
        media: {
          src: "https://example.invalid/video.m3u8",
          mimeType: "application/x-mpegURL",
          assets: [captionsAsset],
        },
      }}
      accessibilityPreferences={{
        largeText: true,
        reducedMotion: true,
      }}
    />
  );
}

export function AudioWithCaptions() {
  return (
    <SurfaceHost
      surface={{
        ...baseSurface,
        id: "story-audio",
        type: "audio",
        prompt: "Listen and read captions.",
        media: {
          src: "https://example.invalid/audio.mp3",
          mimeType: "audio/mpeg",
          assets: [captionsAsset],
        },
      }}
      accessibilityPreferences={{
        dyslexiaFriendlyFont: true,
      }}
    />
  );
}

