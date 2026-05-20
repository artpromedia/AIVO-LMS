"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Homework/HomeworkUploadCard
 *
 * Big, calm capture card for the Homework Helper. Three entry points
 * share one rounded card: camera capture (primary on mobile), file
 * upload (browse), and text entry. The card is a tabset — selecting
 * a tab reveals its input.
 *
 * Per Sprint 9 spec the camera path is camera-first on mobile (uses
 * the `capture="environment"` attribute) and the text-entry path is
 * always available so a learner can type a word problem when no
 * paper is in front of them.
 */
export type HomeworkUploadMode = "camera" | "file" | "text";

export interface HomeworkUploadCardProps {
  /** Form field names — kept stable so the host can wire one action. */
  cameraName?: string;
  fileName?: string;
  textName?: string;
  /** Defaults to "camera" on mobile-friendly screens. */
  defaultMode?: HomeworkUploadMode;
  /** Subject detected from the upload (renders the floating chip). */
  detectedSubject?: React.ReactNode;
  /** Optional helper line ("PDF, photo, or text · up to 10MB"). */
  helper?: React.ReactNode;
  /** Primary submit slot — typically a button passed by the host form. */
  submit?: React.ReactNode;
  /** Optional second action (e.g. "Need a hint instead?"). */
  secondary?: React.ReactNode;
  className?: string;
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-iw-chip px-3 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-[var(--aivo-sensory-primary)] text-white"
          : "bg-white text-iw-text-strong border border-iw-border hover:bg-[var(--aivo-color-aivoPurple-50)]/40",
      )}
    >
      {children}
    </button>
  );
}

export function HomeworkUploadCard({
  cameraName = "homework.photo",
  fileName = "homework.file",
  textName = "homework.text",
  defaultMode = "camera",
  detectedSubject,
  helper,
  submit,
  secondary,
  className,
}: HomeworkUploadCardProps) {
  const [mode, setMode] = React.useState<HomeworkUploadMode>(defaultMode);

  return (
    <section
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-8 flex flex-col gap-5",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ModeTab active={mode === "camera"} onClick={() => setMode("camera")}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Camera
          </ModeTab>
          <ModeTab active={mode === "file"} onClick={() => setMode("file")}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            File
          </ModeTab>
          <ModeTab active={mode === "text"} onClick={() => setMode("text")}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="14" y2="18" />
            </svg>
            Type
          </ModeTab>
        </div>
        {detectedSubject ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-iw-chip text-[11px] font-semibold bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border border-[var(--aivo-color-aivoTeal-100)]"
            role="status"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Detected: {detectedSubject}
          </span>
        ) : null}
      </header>

      <div className="rounded-iw-card-lg border-2 border-dashed border-[var(--aivo-color-aivoPurple-200)] bg-[var(--aivo-color-aivoPurple-50)]/30 p-6 md:p-10 flex flex-col items-center text-center gap-4">
        {mode === "camera" ? (
          <>
            <span
              className="w-16 h-16 rounded-2xl bg-white shadow-[0_4px_16px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)] inline-flex items-center justify-center text-[var(--aivo-sensory-primary)]"
              aria-hidden="true"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-iw-text-strong">Snap a photo of your homework</p>
              <p className="text-sm text-iw-text-muted">Hold the page flat. I'll figure out the rest.</p>
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 cursor-pointer">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Open camera
              <input type="file" accept="image/*" capture="environment" name={cameraName} className="sr-only" />
            </label>
          </>
        ) : null}

        {mode === "file" ? (
          <>
            <span
              className="w-16 h-16 rounded-2xl bg-white shadow-[0_4px_16px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)] inline-flex items-center justify-center text-[var(--aivo-sensory-primary)]"
              aria-hidden="true"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold text-iw-text-strong">Pick a file from your device</p>
              <p className="text-sm text-iw-text-muted">PDF, image, or a Word doc.</p>
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-iw-control px-5 py-2.5 text-sm font-semibold text-white bg-[var(--aivo-sensory-primary)] hover:brightness-110 cursor-pointer">
              Choose file
              <input
                type="file"
                name={fileName}
                accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
              />
            </label>
          </>
        ) : null}

        {mode === "text" ? (
          <div className="w-full flex flex-col gap-2 items-stretch">
            <label htmlFor={textName} className="text-sm font-semibold text-iw-text-strong text-left">
              Tell me what you're working on
            </label>
            <textarea
              id={textName}
              name={textName}
              rows={5}
              placeholder="Type or paste your homework here. A word problem, a sentence to fix, anything."
              className="w-full rounded-iw-card border border-iw-border bg-white p-4 text-base text-iw-text-strong placeholder:text-iw-text-muted/70 focus:outline-none focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)]/40"
            />
          </div>
        ) : null}
      </div>

      {helper ? <p className="text-xs text-iw-text-muted">{helper}</p> : null}

      {(submit || secondary) && (
        <footer className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-iw-border">
          {secondary}
          {submit}
        </footer>
      )}
    </section>
  );
}

HomeworkUploadCard.displayName = "Homework/HomeworkUploadCard";
