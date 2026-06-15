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
 * the only one wired to read-aloud. This client island closes that gap.
 *
 * Voice quality: it plays audio from the **server TTS pipeline** (the same
 * `/api/bff/learners/:id/tts` endpoint the rest of the app uses — consistent,
 * kid-friendly voice, plus caching, consent and cost/usage tracking). When the
 * server can't help — generation fails, the learner lacks consent, or the
 * generated clip won't play — it gracefully falls back to the browser's
 * `speechSynthesis` voice so a tap still speaks the prompt. Usage is recorded
 * server-side on every successful generation, exactly like other read-aloud
 * surfaces.
 *
 * On-screen controls (Done looks like): beyond the play/stop pill the learner
 * gets a **Replay** button (restart the prompt from the very start) and a
 * **Pause/Resume** button (hold and pick playback back up) so a non-reader can
 * hear a question again without re-navigating. These appear only while audio is
 * active so they never present a dead affordance. They drive whichever path is
 * currently speaking — the server `<audio>` clip or the browser fallback voice.
 *
 * Voice + speed respect the learner's saved read-aloud preference (`speed` /
 * `voiceId`, sourced from `getLearnerVoicePreference`). `speed` is sent to the
 * server TTS request and also drives the browser fallback's utterance rate
 * (clamped 0.5–2.0 to stay intelligible); `voiceId` is sent to the server and,
 * for the fallback, selects the closest matching browser voice + pitch. The six
 * saved voices don't map 1:1 onto a device's installed voices, so the fallback
 * match is best-effort — the higher-fidelity server voices are the primary path.
 *
 * Calm + shame-free: it speaks the prompt exactly once per mount (the call site
 * keys it by question id so each new question re-fires), never loops, and only
 * auto-starts when listening mode is on. Any in-flight speech/generation is
 * cancelled on unmount so the voice never trails past the screen that started
 * it, and a generation that resolves after stop/unmount is discarded.
 *
 * Captions: the server TTS pipeline returns time-coded caption lines
 * (`asset.captions`). While the server clip plays we surface the current line
 * near the prompt, synced to the audio's playback position, so a learner who
 * benefits from seeing the words as they're spoken can follow along. The
 * browser-voice fallback has no caption timings, so it degrades to no captions.
 * When the learner's `captionsAlways` preference is on, the full transcript
 * stays visible even when audio isn't playing (once a clip has been generated).
 */

type PlaybackStatus = "idle" | "playing" | "paused";
type PlaybackMode = "server" | "browser";
type Caption = { startMs: number; endMs: number; text: string };

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
  learnerId,
  text,
  contextRefId,
  autoStart = false,
  className,
  speed,
  voiceId,
  languageCode,
  captionsAlways = false,
}: {
  learnerId: string;
  text: string;
  contextRefId?: string | null;
  autoStart?: boolean;
  className?: string;
  /** Saved playback speed (0.5–2.0). Defaults to 1.0 when unset. */
  speed?: number;
  /** Saved voice preference; sent to the server and matched on the fallback. */
  voiceId?: TTSVoiceId;
  /** BCP-47 tag for the prompt; defaults to the document language. */
  languageCode?: string;
  /** When true, keep the transcript visible even while audio isn't playing. */
  captionsAlways?: boolean;
}) {
  const [supported, setSupported] = React.useState(false);
  const [status, setStatus] = React.useState<PlaybackStatus>("idle");
  // Time-coded caption lines from the server clip, plus the line that matches
  // the current playback position (-1 = before the first line / none active).
  const [captions, setCaptions] = React.useState<Caption[]>([]);
  const [captionIndex, setCaptionIndex] = React.useState(-1);
  // Mirror captions into a ref so the audio `timeupdate` handler (a stable
  // closure on the <audio> element) always reads the latest list.
  const captionsRef = React.useRef<Caption[]>([]);
  const voicesRef = React.useRef<SpeechSynthesisVoice[]>([]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  // Cache the generated server clip so repeated taps/replays reuse it (no cost).
  const serverSrcRef = React.useRef<string | null>(null);
  // Monotonic token: bumped on every stop/new-speak so a generation that
  // resolves late (after stop/unmount/another tap) can detect it's stale.
  const activeRef = React.useRef(0);
  // Which pathway is currently speaking, so pause/resume targets the right one.
  const modeRef = React.useRef<PlaybackMode | null>(null);

  const rate = Math.min(2, Math.max(0.5, speed ?? 1));
  const profile = (voiceId && VOICE_PROFILES[voiceId]) || VOICE_PROFILES.calm_neutral;
  const lang =
    languageCode ??
    (typeof document !== "undefined" ? document.documentElement.lang : "") ??
    "en-US";

  const browserSupported = () =>
    typeof window !== "undefined" && "speechSynthesis" in window;

  const stopBrowser = React.useCallback(() => {
    if (browserSupported()) window.speechSynthesis.cancel();
  }, []);

  // Set the caption list in both the ref (read by the audio timeupdate handler)
  // and state (drives the rendered line). Resets the active line.
  const applyCaptions = React.useCallback((list: Caption[]) => {
    captionsRef.current = list;
    setCaptions(list);
    setCaptionIndex(-1);
  }, []);

  const stopServer = React.useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
  }, []);

  const stop = React.useCallback(() => {
    activeRef.current += 1;
    stopServer();
    stopBrowser();
    modeRef.current = null;
    setCaptionIndex(-1);
    setStatus("idle");
  }, [stopServer, stopBrowser]);

  // Browser fallback voice (varies by device; used only when the server can't).
  // Respects the saved speed/voice preference as closely as the device allows.
  const speakBrowser = React.useCallback(() => {
    // The browser voice has no caption timings — drop any captions so a stale
    // server line never lingers over a fallback read.
    applyCaptions([]);
    if (!browserSupported()) {
      modeRef.current = null;
      setStatus("idle");
      return;
    }
    const synth = window.speechSynthesis;
    const trimmed = text.trim();
    if (!trimmed) {
      modeRef.current = null;
      setStatus("idle");
      return;
    }
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
    modeRef.current = "browser";
    synth.speak(utterance);
    setStatus("playing");
  }, [text, rate, profile, lang, applyCaptions]);

  // Play a server-generated clip; on any playback error fall back to the voice.
  const playServerSrc = React.useCallback(
    (src: string) => {
      let a = audioRef.current;
      if (!a) {
        a = new Audio();
        a.onended = () => {
          setCaptionIndex(-1);
          setStatus("idle");
        };
        // Sync the visible caption line to the clip's playback position. Caption
        // timings live on the clip's own timeline, so currentTime maps directly
        // regardless of playbackRate.
        a.ontimeupdate = () => {
          const list = captionsRef.current;
          if (list.length === 0) return;
          const ms = (audioRef.current?.currentTime ?? 0) * 1000;
          let idx = list.findIndex((c) => ms >= c.startMs && ms < c.endMs);
          // Past the last boundary: hold on the final line until playback ends.
          if (idx === -1 && ms >= (list[list.length - 1]?.endMs ?? 0)) {
            idx = list.length - 1;
          }
          setCaptionIndex(idx);
        };
        audioRef.current = a;
      }
      a.onerror = () => {
        speakBrowser();
      };
      a.src = src;
      a.currentTime = 0;
      a.playbackRate = rate;
      modeRef.current = "server";
      setCaptionIndex(-1);
      setStatus("playing");
      void a.play().catch(() => {
        speakBrowser();
      });
    },
    [speakBrowser, rate],
  );

  // Try the higher-quality server voice first; fall back to the browser voice
  // when generation fails or the learner lacks consent.
  const speak = React.useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Cancel anything already speaking so taps never overlap.
    stopServer();
    stopBrowser();

    // Reuse an already-generated clip on repeat taps/replays.
    if (serverSrcRef.current) {
      playServerSrc(serverSrcRef.current);
      return;
    }

    const token = (activeRef.current += 1);
    setStatus("playing");
    try {
      const res = await fetch(`/api/bff/learners/${learnerId}/tts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          contextKind: "baseline_question",
          contextRefId: contextRefId ?? null,
          ...(voiceId ? { voiceId } : {}),
          ...(speed != null ? { speed: rate } : {}),
          ...(languageCode ? { languageCode } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      // Stale: a stop/unmount/newer tap happened while we were waiting.
      if (token !== activeRef.current) return;
      const src: string | undefined = json?.data?.asset?.storageKey;
      if (!res.ok || !json?.ok || !src) {
        throw new Error("tts_unavailable");
      }
      serverSrcRef.current = src;
      // Surface the clip's time-coded captions (empty/missing → no captions).
      const lines = json?.data?.asset?.captions;
      applyCaptions(Array.isArray(lines) ? lines : []);
      playServerSrc(src);
    } catch {
      if (token !== activeRef.current) return;
      speakBrowser();
    }
  }, [
    text,
    learnerId,
    contextRefId,
    voiceId,
    speed,
    rate,
    languageCode,
    stopServer,
    stopBrowser,
    playServerSrc,
    speakBrowser,
    applyCaptions,
  ]);

  // Replay restarts the prompt from the very beginning (re-speak).
  const replay = React.useCallback(() => void speak(), [speak]);

  // Pause holds playback in place; resume picks it back up where it stopped.
  // Targets whichever pathway is currently active.
  const togglePause = React.useCallback(() => {
    if (status === "playing") {
      if (modeRef.current === "server") {
        audioRef.current?.pause();
      } else if (browserSupported()) {
        window.speechSynthesis.pause();
      }
      setStatus("paused");
    } else if (status === "paused") {
      if (modeRef.current === "server") {
        void audioRef.current?.play().catch(() => speakBrowser());
      } else if (browserSupported()) {
        window.speechSynthesis.resume();
      }
      setStatus("playing");
    }
  }, [status, speakBrowser]);

  // Primary pill: start when idle, stop otherwise (covers playing + paused).
  const toggle = React.useCallback(() => {
    if (status === "idle") void speak();
    else stop();
  }, [status, speak, stop]);

  // Keep the installed-voice list fresh — browsers populate it asynchronously.
  React.useEffect(() => {
    if (!browserSupported()) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => synth.removeEventListener?.("voiceschanged", load);
  }, []);

  React.useEffect(() => {
    // Usable whenever JS runs: server TTS is the primary path, browser speech
    // the fallback. Disables only during SSR.
    setSupported(typeof window !== "undefined");
    if (typeof window === "undefined" || !autoStart) {
      return () => stop();
    }
    // Defer briefly so the question DOM has settled and the user-activation from
    // the navigation that brought us here still applies. Cleared on unmount (and
    // on React StrictMode's dev re-mount) so we speak exactly once.
    const id = window.setTimeout(() => void speak(), 150);
    return () => {
      window.clearTimeout(id);
      stop();
    };
    // Auto-start is mount-only; the call site keys this by question id so a new
    // question remounts and re-fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = status !== "idle";

  // What to show in the caption region:
  //  - while a server clip plays: the line synced to the current position;
  //  - while idle, only if `captionsAlways` is on: the full transcript.
  // The browser fallback clears `captions`, so it never shows a caption line.
  const liveLine =
    captionIndex >= 0 && captionIndex < captions.length
      ? captions[captionIndex].text
      : null;
  const captionText = active
    ? liveLine
    : captionsAlways && captions.length > 0
      ? captions.map((c) => c.text).join(" ")
      : null;

  return (
    <div className="flex flex-col gap-1.5">
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
      {captionText ? (
        <p
          data-testid="baseline-listen-caption"
          aria-live="polite"
          className="rounded-iw-chip bg-[var(--aivo-color-aivoPurple-50)] px-3 py-1.5 text-sm font-medium text-[var(--aivo-color-aivoPurple-800)]"
        >
          {captionText}
        </p>
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
