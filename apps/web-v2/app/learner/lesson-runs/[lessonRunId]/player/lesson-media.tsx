"use client";

/**
 * Sprint 12 — captioned media block for guided/check beats, extracted
 * verbatim from the original lesson-player.tsx. Captions default ON; every
 * playback interaction emits telemetry through the provided sink.
 */
import type { SyntheticEvent } from "react";
import type { LessonBeatMedia } from "./beats";

type LessonMediaProps = {
  media: LessonBeatMedia;
  onTelemetry: (event: string) => void;
};

function toVttDataUri(vtt: string): string {
  return `data:text/vtt;charset=utf-8,${encodeURIComponent(vtt)}`;
}

export function LessonMedia({ media, onTelemetry }: LessonMediaProps) {
  const mediaAsset = media.assets.find((asset) => asset.kind === media.surfaceType);
  const captions = media.assets.find((asset) => asset.kind === "captions");
  if (!mediaAsset || !captions) return null;
  const source =
    captions.src.startsWith("WEBVTT") || captions.src.includes("\n")
      ? toVttDataUri(captions.src)
      : captions.src.endsWith(".vtt")
        ? captions.src
        : toVttDataUri(captions.src);

  const props = {
    controls: true,
    className: "w-full rounded-md border border-aivo-border",
    onPlay: () => onTelemetry("play"),
    onPause: () => onTelemetry("pause"),
    onSeeked: () => onTelemetry("seek"),
    onEnded: () => onTelemetry("complete"),
    onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement | HTMLAudioElement>) => {
      const track = event.currentTarget.textTracks?.[0];
      if (track && track.mode !== "showing") {
        track.mode = "showing";
        onTelemetry("caption-on");
      }
    },
  };

  if (media.surfaceType === "video") {
    return (
      <video {...props} data-testid="lesson-media-video">
        <source src={mediaAsset.src} />
        <track
          kind="captions"
          srcLang={captions.language ?? "en"}
          label={captions.label ?? "English"}
          src={source}
          default
        />
      </video>
    );
  }

  return (
    <audio {...props} data-testid="lesson-media-audio">
      <source src={mediaAsset.src} />
      <track
        kind="captions"
        srcLang={captions.language ?? "en"}
        label={captions.label ?? "English"}
        src={source}
        default
      />
    </audio>
  );
}
