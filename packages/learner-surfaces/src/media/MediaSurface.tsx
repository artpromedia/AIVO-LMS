import Hls from "hls.js";
import { useEffect, useMemo, useRef, useState, type KeyboardEventHandler } from "react";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import type {
  LearnerSurfaceSpec,
  SurfaceAssetDescriptor,
  SurfaceResponse,
  SurfaceUserAccessibilityPreferences,
} from "../types.js";

export interface MediaSurfaceProps {
  surface: LearnerSurfaceSpec;
  mediaKind: "video" | "audio";
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
  accessibilityPreferences?: SurfaceUserAccessibilityPreferences;
}

type CaptionAsset = Extract<SurfaceAssetDescriptor, { type: "captions" }>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isHlsSource(src: string, mimeType?: string): boolean {
  return src.toLowerCase().includes(".m3u8") || mimeType === "application/x-mpegURL";
}

export function MediaSurface({
  surface,
  mediaKind,
  disabled = false,
  onSubmit,
  onEvent,
  accessibilityPreferences,
}: MediaSurfaceProps) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const missingCaptionsEmittedRef = useRef(false);
  const [captionText, setCaptionText] = useState("");
  const captionAssets = useMemo(
    () =>
      (surface.media?.assets ?? []).filter(
        (asset): asset is CaptionAsset => asset.type === "captions",
      ),
    [surface.media?.assets],
  );
  const defaultCaption = captionAssets.find((asset) => asset.default) ?? captionAssets[0];
  const [selectedCaptionLang, setSelectedCaptionLang] = useState(defaultCaption?.lang ?? "");
  const [captionsEnabled, setCaptionsEnabled] = useState(
    accessibilityPreferences?.captionsAlwaysOn ?? true,
  );

  if (captionAssets.length === 0) {
    if (!missingCaptionsEmittedRef.current) {
      onEvent?.(
        createSurfaceEvent(surface.id, "captions_missing", {
          type: mediaKind,
          reason: "captions_required",
        }),
      );
      missingCaptionsEmittedRef.current = true;
    }
    return (
      <section role="alert" aria-label={`${mediaKind}-surface-error`}>
        <p>{surface.prompt}</p>
        <p>Captions are required to play this {mediaKind} lesson.</p>
      </section>
    );
  }

  const applyTrackModes = () => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) return;
    for (const track of Array.from(mediaElement.textTracks)) {
      const isSelected = track.language === selectedCaptionLang;
      track.mode = captionsEnabled && isSelected ? "showing" : "disabled";
    }
  };

  useEffect(() => {
    const mediaElement = mediaRef.current;
    if (!mediaElement || !surface.media?.src) return;

    const source = surface.media.src;
    if (
      isHlsSource(source, surface.media.mimeType) &&
      !mediaElement.canPlayType("application/vnd.apple.mpegurl") &&
      Hls.isSupported()
    ) {
      const hls = new Hls();
      hls.loadSource(source);
      hls.attachMedia(mediaElement);
      return () => hls.destroy();
    }

    mediaElement.src = source;
    return undefined;
  }, [surface.media?.mimeType, surface.media?.src]);

  useEffect(() => {
    applyTrackModes();
  }, [captionsEnabled, selectedCaptionLang]);

  const emitSeek = () => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) return;
    onEvent?.(createSurfaceEvent(surface.id, "seek", { timeSec: mediaElement.currentTime }));
  };

  const togglePlayback = () => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) return;
    if (mediaElement.paused) {
      void mediaElement.play();
    } else {
      mediaElement.pause();
    }
  };

  const setCaptions = (enabled: boolean) => {
    setCaptionsEnabled(enabled);
    onEvent?.(
      createSurfaceEvent(surface.id, enabled ? "caption-on" : "caption-off", {
        lang: selectedCaptionLang,
      }),
    );
  };

  const onKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    const mediaElement = mediaRef.current;
    if (!mediaElement || disabled) return;

    switch (event.key) {
      case " ":
      case "Spacebar":
        event.preventDefault();
        togglePlayback();
        break;
      case "ArrowLeft":
        event.preventDefault();
        mediaElement.currentTime = Math.max(0, mediaElement.currentTime - 5);
        emitSeek();
        break;
      case "ArrowRight":
        event.preventDefault();
        mediaElement.currentTime = mediaElement.currentTime + 5;
        emitSeek();
        break;
      case "ArrowUp":
        event.preventDefault();
        mediaElement.volume = clamp(mediaElement.volume + 0.1, 0, 1);
        break;
      case "ArrowDown":
        event.preventDefault();
        mediaElement.volume = clamp(mediaElement.volume - 0.1, 0, 1);
        break;
      case "c":
      case "C":
        event.preventDefault();
        setCaptions(!captionsEnabled);
        break;
      default:
        break;
    }
  };

  const fontSize = accessibilityPreferences?.largeText ? "1.125rem" : "1rem";
  const rootStyle = {
    fontFamily: accessibilityPreferences?.dyslexiaFriendlyFont
      ? "OpenDyslexic, Atkinson Hyperlegible, Arial, sans-serif"
      : undefined,
    transitionDuration: accessibilityPreferences?.reducedMotion ? "0ms" : "160ms",
    fontSize,
  };

  const mediaProps = {
    ref: mediaRef,
    controls: true,
    loop: surface.media?.loop,
    autoPlay: surface.media?.autoPlay && !accessibilityPreferences?.reducedMotion,
    "aria-label": `${mediaKind} player`,
    onPlay: () => onEvent?.(createSurfaceEvent(surface.id, "play", { type: mediaKind })),
    onPause: () => onEvent?.(createSurfaceEvent(surface.id, "pause", { type: mediaKind })),
    onSeeked: emitSeek,
    onEnded: () => {
      onEvent?.(createSurfaceEvent(surface.id, "complete", { type: mediaKind }));
      onSubmit?.({ surfaceId: surface.id, answer: "complete" });
    },
    onTimeUpdate: () => {
      const mediaElement = mediaRef.current;
      if (!mediaElement || !captionsEnabled) {
        setCaptionText("");
        return;
      }
      const selectedTrack = Array.from(mediaElement.textTracks).find(
        (track) => track.language === selectedCaptionLang,
      );
      const activeCue = selectedTrack?.activeCues?.[0] as VTTCue | undefined;
      setCaptionText(activeCue?.text ?? "");
    },
    onLoadedMetadata: applyTrackModes,
    disabled,
  };

  return (
    <section
      aria-label={`${mediaKind}-surface`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={rootStyle}
      data-surface-type={mediaKind}
    >
      <p>{surface.prompt}</p>
      {mediaKind === "video" ? (
        <video
          {...mediaProps}
          poster={surface.media?.poster}
          style={{ maxWidth: "100%", width: "100%", borderRadius: 8 }}
        >
          <source src={surface.media?.src} type={surface.media?.mimeType} />
          {captionAssets.map((track) => (
            <track
              key={`${track.lang}-${track.src}`}
              kind="captions"
              src={track.src}
              srcLang={track.lang}
              label={track.label ?? track.lang}
              default={track.default}
            />
          ))}
        </video>
      ) : (
        <audio {...mediaProps} style={{ width: "100%" }}>
          <source src={surface.media?.src} type={surface.media?.mimeType} />
          {captionAssets.map((track) => (
            <track
              key={`${track.lang}-${track.src}`}
              kind="captions"
              src={track.src}
              srcLang={track.lang}
              label={track.label ?? track.lang}
              default={track.default}
            />
          ))}
        </audio>
      )}
      <div
        style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <button
          type="button"
          onClick={() => setCaptions(!captionsEnabled)}
          aria-label="toggle captions"
          disabled={disabled}
        >
          {captionsEnabled ? "Captions on" : "Captions off"}
        </button>
        {captionAssets.length > 1 ? (
          <label>
            Caption language
            <select
              aria-label="caption language"
              value={selectedCaptionLang}
              onChange={(event) => setSelectedCaptionLang(event.currentTarget.value)}
              disabled={disabled}
            >
              {captionAssets.map((track) => (
                <option key={track.lang} value={track.lang}>
                  {track.label ?? track.lang}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <p aria-live="polite" data-caption-text>
        {captionsEnabled ? captionText || "Captions ready" : "Captions hidden"}
      </p>
    </section>
  );
}
