"use client";

import * as React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Read-aloud control backed by the browser SpeechSynthesis (Web Speech)
 * API. Renders alongside calm-dashboard copy (e.g. MascotCoach) so a
 * learner or caregiver can hear the tip spoken.
 *
 * Behaviour:
 *   - Toggles between speak and stop; cancels any in-flight utterance
 *     before starting a new one so taps never queue up.
 *   - Tracks `isSpeaking` from the utterance lifecycle so the label and
 *     icon reflect the real state, including when speech finishes on its
 *     own.
 *   - Gracefully disables itself when SpeechSynthesis is unavailable
 *     (SSR, or browsers without the API) instead of presenting a dead
 *     affordance.
 *   - Cancels speech on unmount to avoid the voice trailing past the
 *     screen that started it.
 */
export function ReadAloudButton({
  text,
  label = "Read aloud",
  stopLabel = "Stop",
  className,
}: {
  text: string;
  label?: string;
  stopLabel?: string;
  className?: string;
}) {
  const [supported, setSupported] = React.useState(false);
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  React.useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleClick = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    // Toggle off if we're already speaking.
    if (synth.speaking || synth.pending) {
      synth.cancel();
      setIsSpeaking(false);
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setIsSpeaking(true);
  }, [text]);

  return (
    <Button
      type="button"
      variant="soft"
      className={className}
      onClick={handleClick}
      disabled={!supported}
      aria-pressed={isSpeaking}
      aria-label={isSpeaking ? stopLabel : label}
      title={supported ? undefined : "Read aloud isn't supported in this browser"}
    >
      {isSpeaking ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      )}
      {isSpeaking ? stopLabel : label}
    </Button>
  );
}
