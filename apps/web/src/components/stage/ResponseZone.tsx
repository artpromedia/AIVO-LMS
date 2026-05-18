"use client";
import { useState, useEffect, useRef } from "react";
import { Check, Mic, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "@/providers/i18n-provider";
import { useAuth } from "@/providers/auth-provider";
import type { LearnerSurfaceSpec, SurfaceTelemetryEvent } from "@aivo/learner-surfaces";
import type { Beat, FunctioningLevel, SensoryAdaptations } from "./types";
import { CHOICE_COUNTS } from "./types";
import { useSpeechInput, type SpeechInputError } from "./useSpeechInput";
import { matchVoiceAnswer } from "./voiceMatch";
import { SurfaceResponseZone } from "./SurfaceResponseZone";
import { isSurfaceBeat } from "./surface-normalizer";

const STT_LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ar: "ar-SA",
  hi: "hi-IN",
};

interface ResponseZoneProps {
  beat: Beat | null;
  functioningLevel: FunctioningLevel;
  adaptations: SensoryAdaptations;
  onAnswer: (correct: boolean, payload?: Record<string, unknown>) => void;
  accentColor: string;
  resolveSurface?: (id: string) => LearnerSurfaceSpec | undefined;
  onSurfaceEvent?: (event: SurfaceTelemetryEvent) => void;
}

export function ResponseZone({
  beat,
  functioningLevel,
  adaptations,
  onAnswer,
  accentColor,
  resolveSurface,
  onSurfaceEvent,
}: ResponseZoneProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [droppedItems, setDroppedItems] = useState<Record<string, string>>({});
  const prevBeatId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (beat?.id !== prevBeatId.current) {
      setSelected(null);
      setFeedback(null);
      setDraggedId(null);
      setDroppedItems({});
      prevBeatId.current = beat?.id;
    }
  }, [beat?.id]);

  if (beat && isSurfaceBeat(beat)) {
    return (
      <SurfaceResponseZone
        beat={beat}
        resolveSurface={resolveSurface}
        onCorrectnessEvaluated={(correct, payload) => onAnswer(correct, payload)}
        onSurfaceEvent={onSurfaceEvent}
      />
    );
  }

  const interaction = beat?.interaction;
  if (!interaction) return null;

  const maxChoices = CHOICE_COUNTS[functioningLevel];

  const handleChoice = (choiceId: string, isCorrect: boolean) => {
    if (selected) return;
    setSelected(choiceId);
    setFeedback(isCorrect ? "correct" : "incorrect");
    onAnswer(isCorrect);
    setTimeout(() => {
      setSelected(null);
      setFeedback(null);
    }, 1500);
  };

  const handleDragStart = (itemId: string) => {
    setDraggedId(itemId);
  };

  const handleDrop = (zoneId: string) => {
    if (!draggedId || !interaction.dragItems) return;
    const item = interaction.dragItems.find((d) => d.id === draggedId);
    if (!item) return;
    const newDropped = { ...droppedItems, [draggedId]: zoneId };
    setDroppedItems(newDropped);
    setDraggedId(null);

    if (Object.keys(newDropped).length === interaction.dragItems.length) {
      const allCorrect = interaction.dragItems.every((d) => newDropped[d.id] === d.targetZone);
      onAnswer(allCorrect);
    }
  };

  if (interaction.type === "multiple_choice" && interaction.choices) {
    const choices = interaction.choices.slice(0, maxChoices);
    const isLargeTarget = functioningLevel !== "STANDARD";

    return (
      <div className="w-full px-4 md:px-12" role="group" aria-label="Answer choices">
        {interaction.prompt && (
          <p className="vi-text-muted text-center text-sm font-body mb-3" id="mc-prompt">
            {interaction.prompt}
          </p>
        )}
        <div
          className={`grid gap-3 ${choices.length <= 2 ? "grid-cols-2" : choices.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}
          aria-describedby={interaction.prompt ? "mc-prompt" : undefined}
        >
          {choices.map((choice) => {
            const isSelected = selected === choice.id;
            const showCorrect = feedback === "correct" && isSelected;
            const showIncorrect = feedback === "incorrect" && isSelected;

            return (
              <button
                key={choice.id}
                onClick={() => handleChoice(choice.id, choice.isCorrect)}
                disabled={!!selected}
                aria-label={`${choice.label}${showCorrect ? ", correct" : showIncorrect ? ", try again" : ""}`}
                className={`relative rounded-2xl border-2 transition-all duration-300 font-heading font-extrabold text-center
                  ${isLargeTarget ? "py-6 px-4 text-lg" : "py-4 px-3 text-base"}
                  ${
                    showCorrect
                      ? "bg-[hsl(var(--visual-science)/0.16)] border-[hsl(var(--visual-science))] scale-105 ring-4 ring-[hsl(var(--visual-science)/0.4)]"
                      : showIncorrect
                        ? "bg-[hsl(var(--visual-math)/0.16)] border-[hsl(var(--visual-math))] scale-95 ring-4 ring-[hsl(var(--visual-math)/0.4)]"
                        : isSelected
                          ? "opacity-50"
                          : "bg-white vi-border hover:vi-surface-soft hover:scale-105 active:scale-95 shadow-sm"
                  } focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))]`}
              >
                {choice.emoji && (
                  <span className="text-3xl block mb-1" aria-hidden="true">
                    {choice.emoji}
                  </span>
                )}
                {choice.image && (
                  <span className="text-4xl block mb-1" aria-hidden="true">
                    {choice.image}
                  </span>
                )}
                <span className="text-slate-900">{choice.label}</span>
                {showCorrect && (
                  <span
                    className="absolute -top-2 -right-2 text-2xl animate-bounce"
                    aria-hidden="true"
                  >
                    ⭐
                  </span>
                )}
                {showIncorrect && (
                  <span className="absolute -top-2 -right-2 text-xl" aria-hidden="true">
                    💭
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div aria-live="polite" className="sr-only">
          {feedback === "correct" && "Correct answer!"}
          {feedback === "incorrect" && "Not quite, try again!"}
        </div>
      </div>
    );
  }

  if (interaction.type === "drag_drop" && interaction.dragItems && interaction.dragZones) {
    return (
      <div className="w-full px-4 md:px-12">
        {interaction.prompt && (
          <p className="vi-text-muted text-center text-sm font-body mb-3">{interaction.prompt}</p>
        )}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          <div className="flex gap-2 flex-wrap justify-center">
            {interaction.dragItems
              .filter((d) => !droppedItems[d.id])
              .map((item) => (
                <div
                  key={item.id}
                  role="listitem"
                  draggable
                  onDragStart={() => handleDragStart(item.id)}
                  onTouchStart={() => handleDragStart(item.id)}
                  className="bg-white vi-border border-2 rounded-xl px-4 py-3 cursor-grab active:cursor-grabbing hover:vi-surface-soft hover:scale-105 transition-all text-slate-900 font-heading font-extrabold shadow-sm"
                >
                  {item.emoji && <span className="mr-1">{item.emoji}</span>}
                  {item.label}
                </div>
              ))}
          </div>

          <div className="vi-text-muted text-2xl">→</div>

          <div className="flex gap-3 flex-wrap justify-center">
            {interaction.dragZones.map((zone) => (
              <div
                key={zone.id}
                role="listitem"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(zone.id)}
                onTouchEnd={() => handleDrop(zone.id)}
                className="w-28 h-20 rounded-xl border-2 border-dashed vi-border flex items-center justify-center vi-text-muted text-sm font-body vi-surface-soft hover:bg-white transition-all"
                style={{ borderColor: draggedId ? accentColor : undefined }}
              >
                {Object.entries(droppedItems).find(([_, z]) => z === zone.id)?.[0] ? (
                  <Check className="w-5 h-5 text-slate-900" strokeWidth={3} aria-hidden />
                ) : (
                  zone.label
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (interaction.type === "voice") {
    return (
      <VoiceResponse
        prompt={interaction.prompt}
        correctAnswer={interaction.correctAnswer}
        onAnswer={onAnswer}
        accentColor={accentColor}
        functioningLevel={functioningLevel}
      />
    );
  }

  if (interaction.type === "tap") {
    return (
      <div className="w-full flex justify-center">
        <button
          onClick={() => onAnswer(true)}
          className="px-8 py-4 rounded-2xl bg-white vi-border border-2 text-slate-900 font-heading font-extrabold text-lg hover:vi-surface-soft hover:scale-105 active:scale-95 transition-all shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))]"
          style={{ boxShadow: `0 4px 14px ${accentColor}30` }}
        >
          {interaction.prompt || "Tap to continue"}
        </button>
      </div>
    );
  }

  return null;
}

interface VoiceResponseProps {
  prompt?: string;
  correctAnswer?: string;
  onAnswer: (correct: boolean) => void;
  accentColor: string;
  functioningLevel: FunctioningLevel;
}

function VoiceResponse({
  prompt,
  correctAnswer,
  onAnswer,
  accentColor,
  functioningLevel,
}: VoiceResponseProps) {
  const t = useTranslations("stt");
  const { locale } = useLocale();
  const { accessToken } = useAuth();
  const sttLocale = STT_LOCALE_MAP[locale] || "en-US";
  const isLargeTarget = functioningLevel !== "STANDARD";
  const [committedText, setCommittedText] = useState<string | null>(null);
  const [matched, setMatched] = useState<boolean | null>(null);
  const answeredRef = useRef(false);

  const { status, transcript, error, isSupported, start, stop, reset } = useSpeechInput({
    locale: sttLocale,
    authToken: accessToken,
    onResult: (text) => {
      setCommittedText(text);
      const result = matchVoiceAnswer(text, correctAnswer);
      setMatched(result.matched);
      if (result.matched && !answeredRef.current) {
        answeredRef.current = true;
        onAnswer(true);
      }
    },
  });

  useEffect(
    () => () => {
      stop();
    },
    [stop],
  );

  const handleClick = () => {
    if (status === "listening") {
      stop();
      return;
    }
    if (status === "processing") return;
    setCommittedText(null);
    setMatched(null);
    reset();
    void start();
  };

  const handleAcceptIncorrect = () => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    onAnswer(false);
  };

  const errorLabel = (e: SpeechInputError | null) => {
    switch (e) {
      case "permission_denied":
        return t("mic_denied");
      case "no_speech":
        return t("no_speech");
      case "unsupported":
        return t("mic_unavailable");
      case "network":
      case "transcription_failed":
        return t("transcription_failed");
      case "audio_capture":
        return t("audio_capture_error");
      default:
        return null;
    }
  };

  const buttonSize = isLargeTarget ? "w-24 h-24" : "w-20 h-20";
  const isListening = status === "listening";
  const isProcessing = status === "processing";

  return (
    <div
      className="w-full flex flex-col items-center gap-2"
      role="group"
      aria-label={t("voice_answer_group")}
    >
      {prompt && (
        <p className="vi-text-muted text-center text-sm font-body" id="voice-prompt">
          {prompt}
        </p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={!isSupported || isProcessing}
        aria-label={
          isListening
            ? t("listening_stop")
            : isProcessing
              ? t("processing")
              : isSupported
                ? t("tap_to_speak")
                : t("mic_unavailable")
        }
        aria-pressed={isListening}
        aria-describedby={prompt ? "voice-prompt" : undefined}
        className={`relative ${buttonSize} rounded-full flex items-center justify-center bg-white vi-border border-[3px] transition-all shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))] disabled:opacity-50 disabled:cursor-not-allowed ${
          isListening
            ? "scale-110 ring-4 ring-[hsl(var(--visual-primary)/0.35)] animate-pulse"
            : "hover:vi-surface-soft hover:scale-110 active:scale-95"
        }`}
        style={{ boxShadow: `0 4px 14px ${accentColor}33` }}
      >
        {isProcessing ? (
          <Loader2
            className="w-7 h-7 text-slate-700 animate-spin"
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : (
          <Mic className="w-7 h-7 text-slate-700" strokeWidth={2} aria-hidden="true" />
        )}
        {isListening && (
          <span
            className="absolute inset-0 rounded-full border-2 animate-ping"
            style={{ borderColor: accentColor }}
            aria-hidden="true"
          />
        )}
      </button>
      <p className="vi-text-muted text-xs font-body min-h-4" aria-hidden="true">
        {isListening
          ? t("listening")
          : isProcessing
            ? t("processing")
            : !isSupported
              ? t("mic_unavailable")
              : t("tap_to_speak")}
      </p>
      {committedText && (
        <p
          className={`text-sm font-body italic max-w-md text-center ${
            matched === true
              ? "text-emerald-700"
              : matched === false
                ? "text-rose-700"
                : "text-slate-700"
          }`}
          aria-live="polite"
        >
          “{committedText}”
        </p>
      )}
      {matched === false && !isListening && !isProcessing && (
        <div className="flex flex-col items-center gap-2" role="status">
          <p className="text-rose-600 text-xs font-body">{t("not_quite")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-heading font-bold bg-white vi-border border-2 text-slate-800 hover:vi-surface-soft active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))]"
              aria-label={t("try_again")}
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2.5} aria-hidden />
              {t("try_again")}
            </button>
            <button
              type="button"
              onClick={handleAcceptIncorrect}
              className="px-4 py-2 rounded-full text-sm font-heading font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--visual-primary))]"
            >
              {t("skip")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-rose-600 text-xs font-body inline-flex items-center gap-1" role="alert">
          <AlertCircle className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
          {errorLabel(error)}
        </p>
      )}
      <div aria-live="polite" className="sr-only">
        {isListening && t("listening")}
        {isProcessing && t("processing")}
        {status === "idle" && committedText && matched === true && t("answer_correct")}
        {status === "idle" &&
          committedText &&
          matched === false &&
          t("answer_not_quite", { text: committedText })}
        {status === "idle" &&
          transcript &&
          matched === null &&
          t("heard_answer", { text: transcript })}
      </div>
    </div>
  );
}
