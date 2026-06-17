"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { clampBreakIntervalMinutes } from "@aivo/accessibility-contract";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type CaptureDescriptor = {
  method: "photo" | "pdf" | "typed";
  label: string;
};

/** A short, calm mindful break — clamped to the accessibility-contract range. */
const BREAK_MINUTES = clampBreakIntervalMinutes(2);
const PROGRESS_DOTS = 5;

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function HomeworkSidebar({
  breakOpen,
  setBreakOpen,
  capture,
  progress,
}: {
  breakOpen: boolean;
  setBreakOpen: (open: boolean) => void;
  capture: CaptureDescriptor;
  progress: number;
}) {
  const t = useTranslations("learner.homework");
  const [secondsLeft, setSecondsLeft] = useState(BREAK_MINUTES * 60);

  useEffect(() => {
    if (!breakOpen) return;
    setSecondsLeft(BREAK_MINUTES * 60);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          setBreakOpen(false);
          return BREAK_MINUTES * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [breakOpen, setBreakOpen]);

  const captureLabel =
    capture.method === "photo"
      ? t("capture_photo")
      : capture.method === "pdf"
        ? t("capture_pdf")
        : t("capture_typed");

  return (
    <aside className="grid content-start gap-4" aria-label={t("sidebar_aria")}>
      <Card className="p-4">
        <h2 className="font-display text-base font-semibold text-iw-text-strong">
          {t("break_title")}
        </h2>
        {breakOpen ? (
          <div className="mt-3 grid justify-items-center gap-3 text-center">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full bg-iw-accent-soft text-2xl font-semibold text-iw-primary motion-safe:animate-pulse"
              aria-hidden="true"
            >
              {formatClock(secondsLeft)}
            </div>
            <p className="text-sm text-iw-ink-muted" aria-live="polite">
              {t("break_breathe")}
            </p>
            <Button type="button" variant="outline" onClick={() => setBreakOpen(false)}>
              {t("break_end")}
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-iw-ink-muted">{t("break_body")}</p>
            <Button type="button" className="mt-3 w-full" onClick={() => setBreakOpen(true)}>
              {t("break_start", { minutes: BREAK_MINUTES })}
            </Button>
          </>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-display text-base font-semibold text-iw-text-strong">
          {t("encourage_title")}
        </h2>
        <p className="mt-1 text-sm text-iw-ink-muted">{t("encourage_body")}</p>
        <div className="mt-3 flex gap-2" aria-hidden="true">
          {Array.from({ length: PROGRESS_DOTS }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full ${
                i < Math.min(progress, PROGRESS_DOTS) ? "bg-iw-primary" : "bg-iw-border"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-iw-text-muted">
          {t("encourage_steps", { count: progress })}
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="font-display text-base font-semibold text-iw-text-strong">
          {t("capture_title")}
        </h2>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-iw-accent-soft px-2.5 py-1 text-xs font-semibold text-iw-primary">
            {captureLabel}
          </span>
        </div>
        <p className="mt-2 truncate text-sm text-iw-ink" title={capture.label}>
          {capture.label}
        </p>
        <Button asChild variant="soft" className="mt-3 w-full">
          <Link href="/learner/homework">{t("capture_retake")}</Link>
        </Button>
      </Card>
    </aside>
  );
}
