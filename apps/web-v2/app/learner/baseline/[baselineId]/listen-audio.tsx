"use client";

import * as React from "react";
import { ReadAloudButton } from "@aivo/ui";

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
 * Calm + shame-free: it speaks the prompt exactly once per mount (the call site
 * keys it by question id so each new question re-fires), never loops, and only
 * auto-starts when listening mode is on. If `speechSynthesis` is unavailable
 * (SSR / unsupported browser) the control disables itself instead of presenting
 * a dead affordance, and any in-flight speech is cancelled on unmount so the
 * voice never trails past the screen that started it.
 */
export function BaselineListenAudio({
  text,
  autoStart = false,
  className,
}: {
  text: string;
  autoStart?: boolean;
  className?: string;
}) {
  const [supported, setSupported] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);

  const stop = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }, []);

  const speak = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const trimmed = text.trim();
    if (!trimmed) return;
    // Cancel anything in flight so taps never queue up.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    synth.speak(utterance);
    setPlaying(true);
  }, [text]);

  const toggle = React.useCallback(() => {
    if (playing) stop();
    else speak();
  }, [playing, speak, stop]);

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

  return (
    <ReadAloudButton
      playing={playing}
      onToggle={toggle}
      disabled={!supported}
      className={className}
    />
  );
}
