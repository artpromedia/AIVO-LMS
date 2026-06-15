"use client";

import * as React from "react";
import { ReadAloudButton } from "@aivo/ui";
import { cn } from "@/lib/utils";
import type { TTSVoiceId } from "@/lib/db/types";

/**
 * Non-scan read-aloud playback for the baseline runner.
 *
 * The server-rendered runner can only emit a link (`?read=…`) for read-aloud,
 * which never actually played audio for non-scan learners — the scan path was
 * the only one wired to the browser Speech API. This client island closes that
 * gap: it backs the read-aloud pill with `speechSynthesis` so a tap really
 * speaks the prompt, and, when `autoStart` is set (listening mode), it begins
 * playing the question on its own once the screen loads — no tap required.
 *
 * On-screen controls (Done looks like): beyond the play/stop pill the learner
 * gets a **Replay** button (restart the prompt from the very start) and a
 * **Pause/Resume** button (hold and pick playback back up) so a non-reader can
 * hear a question again without re-navigating. These appear only while audio is
 * active so they never present a dead affordance.
 *
 * Voice + speed respect the learner's saved read-aloud preference (`speed` /
 * `voiceId`, sourced from `getLearnerVoicePreference`) instead of the browser
 * default: `speed` drives the utterance rate (clamped 0.5–2.0 to stay
 * intelligible) and `voiceId` selects the closest matching browser voice +
 * pitch. The six saved voices don't map 1:1 onto a device's installed voices,
 * so this is a best-effort match — the higher-fidelity server voices are a
 * separate path.
 *
 * Calm + shame-free: it speaks the prompt exactly once per mount (the call site
 * keys it by question id so each new question re-fires), never loops, and only
 * auto-starts when listening mode is on. If `speechSynthesis` is unavailable
 * (SSR / unsupported browser) the controls disable themselves instead of
 * presenting dead affordances, and any in-flight speech is cancelled on unmount
 * so the voice never trails past the screen that started it.
 */

type PlaybackStatus = "idle" | "playing" | "paused";

/**
 * How each saved voice should sound on the browser Speech API. `female` picks
 * the matching installed voice when one can be identified (null = no
 * preference); `pitch` nudges the timbre so the six saved voices stay
 * distinguishable even when the device only ships one or two real voices.
 */
const VOICE_PROFILES: Record<TTSVoiceId, { female: boolean | null; pitch: number }> = {
  warm_female: { female: true, pitch: 1.05 },
  warm_male: { female: false, pitch: 0.95 },
  calm_neutral: { female: null, pitch: 1.0 },
  kid_friendly: { female: true, pitch: 1.3 },
  narrator_low: { female: false, pitch: 0.85 },
  narrator_high: { female: true, pitch: 1.2 },
};

const FEMALE_HINTS = [
  "female",
  "woman",
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "zira",
  "susan",
  "allison",
  "ava",
  "serena",
  "joana",
  "amelie",
  "anna",
];
const MALE_HINTS = [
  "male",
  "man",
  "daniel",
  "alex",
  "fred",
  "david",
  "mark",
  "oliver",
  "thomas",
  "george",
  "rishi",
  "diego",
  "jorge",
];

/** Best-effort gender inference from a browser voice's name. */
function inferFemale(voice: SpeechSynthesisVoice): boolean | null {
  const name = voice.name.toLowerCase();
  if (FEMALE_HINTS.some((h) => name.includes(h))) return true;
  if (MALE_HINTS.some((h) => name.includes(h))) return false;
  return null;
}

/** Pick the installed browser voice that best matches the saved preference. */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  profile: { female: boolean | null },
  lang: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const prefix = lang.slice(0, 2).toLowerCase();
  const byLang = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const pool = byLang.length > 0 ? byLang : voices;
  if (profile.female !== null) {
    const match = pool.find((v) => inferFemale(v) === profile.female);
    if (match) return match;
  }
  return pool.find((v) => v.default) ?? pool[0] ?? null;
}

export function BaselineListenAudio({
  text,
  autoStart = false,
  className,
  speed,
  voiceId,
  languageCode,
}: {
  text: string;
  autoStart?: boolean;
  className?: string;
  /** Saved playback speed (0.5–2.0). Defaults to 1.0 when unset. */
  speed?: number;
  /** Saved voice preference; selects the closest browser voice + pitch. */
  voiceId?: TTSVoiceId;
  /** BCP-47 tag for the prompt; defaults to the document language. */
  languageCode?: string;
}) {
  const [supported, setSupported] = React.useState(false);
  const [status, setStatus] = React.useState<PlaybackStatus>("idle");
  const voicesRef = React.useRef<SpeechSynthesisVoice[]>([]);

  const rate = Math.min(2, Math.max(0.5, speed ?? 1));
  const profile = (voiceId && VOICE_PROFILES[voiceId]) || VOICE_PROFILES.calm_neutral;
  const lang =
    languageCode ??
    (typeof document !== "undefined" ? document.documentElement.lang : "") ??
    "en-US";

  const stop = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setStatus("idle");
  }, []);

  const speak = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const trimmed = text.trim();
    if (!trimmed) return;
    // Cancel anything in flight so taps/replays never queue up.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    // Saved preference drives rate + pitch instead of the browser default.
    utterance.rate = rate;
    utterance.pitch = profile.pitch;
    const voice = pickVoice(voicesRef.current, profile, lang || "en-US");
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else if (lang) {
      utterance.lang = lang;
    }
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("idle");
    synth.speak(utterance);
    setStatus("playing");
  }, [text, rate, profile, lang]);

  // Replay restarts the prompt from the very beginning (cancel + re-speak).
  const replay = React.useCallback(() => speak(), [speak]);

  // Pause holds speech in place; resume picks it back up where it stopped.
  const togglePause = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (status === "playing") {
      synth.pause();
      setStatus("paused");
    } else if (status === "paused") {
      synth.resume();
      setStatus("playing");
    }
  }, [status]);

  // Primary pill: start when idle, stop otherwise (covers playing + paused).
  const toggle = React.useCallback(() => {
    if (status === "idle") speak();
    else stop();
  }, [status, speak, stop]);

  // Keep the installed-voice list fresh — browsers populate it asynchronously.
  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, []);

  React.useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (!ok || !autoStart) {
      return () => {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      };
    }
    // Defer briefly so the question DOM has settled and the user-activation from
    // the navigation that brought us here still applies. The timeout is cleared
    // on unmount (and on React StrictMode's dev re-mount), so we speak exactly
    // once and never double-fire.
    const id = window.setTimeout(() => speak(), 150);
    return () => {
      window.clearTimeout(id);
      window.speechSynthesis.cancel();
    };
    // Auto-start is mount-only; the call site keys this by question id so a new
    // question remounts and re-fires.
  }, []);

  const active = status !== "idle";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ReadAloudButton
        playing={active}
        onToggle={toggle}
        disabled={!supported}
        className={className}
      />
      {active ? (
        <>
          <ControlButton
            label="Replay"
            ariaLabel="Replay from the start"
            onClick={replay}
            disabled={!supported}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            }
          />
          <ControlButton
            label={status === "paused" ? "Resume" : "Pause"}
            ariaLabel={status === "paused" ? "Resume reading" : "Pause reading"}
            onClick={togglePause}
            disabled={!supported}
            icon={
              status === "paused" ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              )
            }
          />
        </>
      ) : null}
    </div>
  );
}

/** Small pill control matching ReadAloudButton's resting style. */
function ControlButton({
  label,
  ariaLabel,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-2 rounded-iw-chip px-3 py-1.5 text-sm font-semibold",
        "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)]",
        "border border-[var(--aivo-color-aivoPurple-100)] transition-colors duration-150",
        "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <span
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-[var(--aivo-sensory-primary)] text-white"
        aria-hidden="true"
      >
        <span className="w-3.5 h-3.5 inline-flex items-center justify-center">{icon}</span>
      </span>
      <span>{label}</span>
    </button>
  );
}
