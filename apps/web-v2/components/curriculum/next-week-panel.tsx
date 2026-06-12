"use client";

/**
 * Remediation Sprint 07 — the parent "Next week" panel.
 *
 * Read-only list of the learner's pre-generated (ready) lessons — what the
 * Sunday-night Creator prepared for the coming week. Real data from the
 * next-week BFF route; no placeholders: an empty week explains when the
 * Creator runs.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface NextWeekLesson {
  lessonRunId: string;
  subjectName: string;
  skillName: string;
  preGenerated: boolean;
  createdAt: string;
}

export function NextWeekPanel({ apiBase }: { apiBase: string }) {
  const t = useTranslations("curriculum.next_week");
  const [lessons, setLessons] = useState<NextWeekLesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(apiBase)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { data?: { lessons?: NextWeekLesson[] } };
        if (!cancelled) setLessons(body.data?.lessons ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  return (
    <section className="rounded-iw-card-lg border border-iw-border bg-white p-6 flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-iw-text-strong">{t("title")}</h3>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : lessons === null ? (
        <p className="text-sm text-iw-text-muted">…</p>
      ) : lessons.length === 0 ? (
        <p className="text-sm text-iw-text-muted">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="next-week-lessons">
          {lessons.map((lesson, index) => (
            <li
              key={lesson.lessonRunId}
              className="flex items-start gap-3 rounded-iw-card border border-iw-border p-3"
            >
              <span
                className="shrink-0 w-8 h-8 rounded-iw-control flex items-center justify-center text-sm font-bold tabular-nums bg-iw-surface-subtle"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-iw-text-strong">
                  {lesson.subjectName} — {lesson.skillName}
                </span>
                <span className="text-xs text-iw-text-muted">
                  {t("ready_badge")}
                  {" · "}
                  {t("generated_at", {
                    date: new Date(lesson.createdAt).toLocaleDateString(),
                  })}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
