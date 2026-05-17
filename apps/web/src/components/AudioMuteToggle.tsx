"use client";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isAudioMuted, setAudioMuted, subscribeAudioMuted } from "@/lib/audio";

interface AudioMuteToggleProps {
  /** Optional className override for the wrapping button. */
  className?: string;
  /** Compact variant used inside narrow toolbars. */
  compact?: boolean;
}

/**
 * Persistent global audio mute toggle. Reads + writes
 * `localStorage["aivo:audio-muted"]` via `lib/audio` so every chime, swell
 * and tutor voice line in the app respects the same single source of truth.
 */
export default function AudioMuteToggle({ className = "", compact = false }: AudioMuteToggleProps) {
  // Hydration-safe: start in an "unknown" state and resolve in useEffect so
  // server-rendered HTML never disagrees with client state.
  const [muted, setMuted] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setMuted(isAudioMuted());
    setHydrated(true);
    return subscribeAudioMuted(setMuted);
  }, []);

  const Icon = muted ? VolumeX : Volume2;
  const label = muted ? "Unmute audio" : "Mute audio";
  const sizeCls = compact ? "w-9 h-9" : "w-10 h-10";

  return (
    <button
      type="button"
      onClick={() => setAudioMuted(!muted)}
      aria-pressed={hydrated ? muted : undefined}
      aria-label={label}
      title={label}
      className={`${sizeCls} inline-flex items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        muted
          ? "bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/15"
          : "bg-white/15 border-white/25 text-white hover:bg-white/25"
      } ${className}`}
      style={{ borderRadius: "var(--tier-radius-pill, 999px)" }}
    >
      <Icon className={compact ? "w-4 h-4" : "w-4.5 h-4.5"} aria-hidden="true" />
    </button>
  );
}
