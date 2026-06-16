"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@aivo/ui/utils";
import { LessonSecondaryAction } from "@aivo/ui/learner-dashboard";

type FeaturedLessonActionsProps = {
  readAloudLabel: string;
  overviewLabel: string;
  overviewHref: string;
  speechText: string;
};

export function FeaturedLessonActions({
  readAloudLabel,
  overviewLabel,
  overviewHref,
  speechText,
}: FeaturedLessonActionsProps) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSpeechSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const cleanSpeechText = useMemo(() => speechText.replace(/\s+/g, " ").trim(), [speechText]);

  const toggleSpeech = () => {
    if (!speechSupported || !cleanSpeechText) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      <LessonSecondaryAction
        onClick={toggleSpeech}
        disabled={!speechSupported || !cleanSpeechText}
        aria-pressed={speaking}
        aria-label={speaking ? `Stop ${readAloudLabel}` : readAloudLabel}
        title={speechSupported ? readAloudLabel : "Text-to-speech is unavailable in this browser"}
        icon={
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 10v4a1 1 0 0 0 1 1h3l4 4V5l-4 4H4a1 1 0 0 0-1 1Z" />
            <path d="M15 9a4 4 0 0 1 0 6" />
            <path d="M18 6a8 8 0 0 1 0 12" />
          </svg>
        }
      >
        {speaking ? "Stop reading" : readAloudLabel}
      </LessonSecondaryAction>
      <Link
        href={overviewHref}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-iw-card text-sm font-semibold",
          "bg-white border border-iw-border/80 text-iw-text-strong",
          "hover:bg-iw-bg hover:border-[var(--color-aivo-primary)]/40",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aivo-primary)] focus-visible:ring-offset-2",
          "transition-colors",
        )}
      >
        <span aria-hidden="true" className="w-4 h-4 inline-flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
        </span>
        {overviewLabel}
      </Link>
    </>
  );
}
