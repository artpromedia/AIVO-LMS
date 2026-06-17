"use client";

/**
 * State 2 — In-progress teacher assessment wizard (client island).
 *
 * Left-rail eight-section stepper + a focused question panel per section.
 * Answers autosave (debounced PATCH per section) so the teacher can leave and
 * resume; the URL stays in sync (`?step=N`) for deep-links and the review
 * screen's Edit affordance. Single/multi/text question types render as
 * full-width WCAG pills (native inputs for keyboard + screen-reader semantics,
 * custom visuals via `has-[:checked]`/`peer-checked`). @aivo/brand tokens only.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  TEACHER_ASSESSMENT_SECTIONS,
  TEACHER_ASSESSMENT_TOTAL_QUESTIONS,
  requiredQuestionCount,
  withName,
  type TASection,
  type TAQuestion,
} from "@/lib/teacher/assessment-content";
import {
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  HeartIcon,
  PRIMARY_BTN,
  SECONDARY_BTN,
  GHOST_BTN,
} from "@/components/teacher/assessment/shared";

type SectionAnswers = Record<string, string | string[]>;
type AllAnswers = Record<string, SectionAnswers>;
type SaveState = "idle" | "saving" | "saved" | "error";

function normalize(raw: Record<string, Record<string, unknown>>): AllAnswers {
  const out: AllAnswers = {};
  for (const section of TEACHER_ASSESSMENT_SECTIONS) {
    const src = (raw[section.id] ?? {}) as Record<string, unknown>;
    const dest: SectionAnswers = {};
    for (const q of section.questions) {
      const v = src[q.id];
      if (q.type === "multi") {
        if (Array.isArray(v)) dest[q.id] = v.filter((x): x is string => typeof x === "string");
      } else if (typeof v === "string") {
        dest[q.id] = v;
      }
    }
    out[section.id] = dest;
  }
  return out;
}

function isSectionComplete(section: TASection, answers: SectionAnswers): boolean {
  const requiredQs = section.questions.filter((q) => !q.optional);
  if (requiredQs.length === 0) {
    // A fully-optional section counts as complete once any answer exists.
    return Object.values(answers).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  }
  return requiredQs.every((q) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim());
  });
}

export function TeacherAssessmentWizard({
  learnerId,
  learnerName,
  initialStep,
  initialAnswers,
  introHref,
  reviewHref,
}: {
  learnerId: string;
  learnerName: string;
  initialStep: number;
  initialAnswers: Record<string, Record<string, unknown>>;
  introHref: string;
  reviewHref: string;
}) {
  const router = useRouter();
  const sections = TEACHER_ASSESSMENT_SECTIONS;
  const total = sections.length;

  const [answers, setAnswers] = React.useState<AllAnswers>(() => normalize(initialAnswers));
  const [index, setIndex] = React.useState(() =>
    Math.min(Math.max(initialStep - 1, 0), total - 1),
  );
  const [save, setSave] = React.useState<SaveState>("idle");

  const section = sections[index];
  const name = learnerName;
  const percent = Math.round(((index + 1) / total) * 100);

  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = React.useCallback(
    async (sectionId: string, data: SectionAnswers) => {
      setSave("saving");
      try {
        const res = await fetch(`/api/bff/learners/${learnerId}/teacher-assessment`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ section: sectionId, data }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
        setSave(res.ok && json.ok ? "saved" : "error");
      } catch {
        setSave("error");
      }
    },
    [learnerId],
  );

  // Flush any pending debounced save immediately (used before navigating away).
  const flush = React.useCallback(
    (sectionId: string, data: SectionAnswers) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void persist(sectionId, data);
    },
    [persist],
  );

  const updateAnswer = React.useCallback(
    (question: TAQuestion, value: string) => {
      setAnswers((prev) => {
        const current = { ...(prev[section.id] ?? {}) };
        if (question.type === "multi") {
          const list = Array.isArray(current[question.id])
            ? [...(current[question.id] as string[])]
            : [];
          const at = list.indexOf(value);
          if (at >= 0) list.splice(at, 1);
          else list.push(value);
          current[question.id] = list;
        } else {
          current[question.id] = value;
        }
        const next = { ...prev, [section.id]: current };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void persist(section.id, current), 600);
        return next;
      });
    },
    [section.id, persist],
  );

  // Keep the URL in sync for deep-links / the review Edit affordance.
  React.useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(index + 1));
    window.history.replaceState(window.history.state, "", url.toString());
  }, [index]);

  React.useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function goTo(nextIndex: number) {
    flush(section.id, answers[section.id] ?? {});
    setIndex(Math.min(Math.max(nextIndex, 0), total - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }

  function goReview() {
    flush(section.id, answers[section.id] ?? {});
    router.push(reviewHref);
  }

  const isLast = index === total - 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Left rail — stepper */}
      <nav aria-label="Assessment sections" className="lg:sticky lg:top-20 lg:self-start">
        <ol className="flex flex-col gap-1">
          {sections.map((s, i) => {
            const complete = isSectionComplete(s, answers[s.id] ?? {});
            const active = i === index;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={active ? "step" : undefined}
                  className={[
                    "flex w-full items-center gap-3 rounded-iw-control px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)]",
                    active
                      ? "bg-[var(--aivo-color-aivoPurple-50)] text-iw-text-strong"
                      : "text-iw-text-muted hover:bg-[var(--aivo-color-surface-muted)]",
                  ].join(" ")}
                >
                  <span
                    aria-hidden="true"
                    className={[
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      complete
                        ? "bg-[var(--aivo-color-aivoTeal-600)] text-white"
                        : active
                          ? "bg-[var(--aivo-sensory-primary)] text-white"
                          : "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted",
                    ].join(" ")}
                  >
                    {complete ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0 text-sm font-semibold leading-tight">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Right — question panel */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--aivo-sensory-primary)]">
              Section <span className="tabular-nums">{index + 1}</span> of{" "}
              <span className="tabular-nums">{total}</span>
            </p>
            <h1 className="mt-1 font-iw-display text-2xl font-bold text-iw-text-strong">
              {section.title}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-iw-text-strong tabular-nums">{percent}% complete</p>
            <p className="mt-0.5 h-4 text-xs text-iw-text-muted" aria-live="polite">
              {save === "saving"
                ? "Saving…"
                : save === "saved"
                  ? "Saved"
                  : save === "error"
                    ? "Couldn't save — retrying on next change"
                    : ""}
            </p>
          </div>
        </div>

        <div
          className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[var(--aivo-color-aivoPurple-50)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Assessment progress"
        >
          <div
            className="h-full rounded-full bg-[var(--aivo-color-aivoTeal-600)] transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        {section.subtitle ? (
          <p className="mb-6 text-sm leading-relaxed text-iw-text-muted">
            {withName(section.subtitle, name)}
          </p>
        ) : null}

        <div className="flex flex-col gap-7">
          {section.questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              name={name}
              value={answers[section.id]?.[q.id]}
              onChange={(value) => updateAnswer(q, value)}
            />
          ))}
        </div>

        {/* Need a break */}
        <div className="mt-7 flex items-start gap-3 rounded-iw-card border border-iw-border bg-[var(--aivo-color-aivoPurple-50)] p-4">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-iw-control bg-white text-[var(--aivo-sensory-primary)]"
            aria-hidden="true"
          >
            <HeartIcon className="h-5 w-5" />
          </span>
          <p className="min-w-0 text-sm text-iw-text-strong">
            <span className="font-semibold">Need a break?</span> Everything is
            saved automatically — close this tab and pick up exactly where you
            left off whenever it suits you.
          </p>
        </div>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-iw-border pt-5">
          {index === 0 ? (
            <a href={introHref} className={GHOST_BTN}>
              <ArrowLeftIcon className="h-4 w-4" />
              Overview
            </a>
          ) : (
            <button type="button" onClick={() => goTo(index - 1)} className={SECONDARY_BTN}>
              <ArrowLeftIcon className="h-4 w-4" />
              Previous
            </button>
          )}

          {isLast ? (
            <button type="button" onClick={goReview} className={PRIMARY_BTN}>
              Review &amp; submit
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => goTo(index + 1)} className={PRIMARY_BTN}>
              Next section
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-iw-text-muted">
          <span className="tabular-nums">{TEACHER_ASSESSMENT_TOTAL_QUESTIONS}</span> questions
          across <span className="tabular-nums">{total}</span> sections ·{" "}
          <span className="tabular-nums">{requiredQuestionCount(section.id)}</span> required in this
          section
        </p>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  name,
  value,
  onChange,
}: {
  question: TAQuestion;
  name: string;
  value: string | string[] | undefined;
  onChange: (value: string) => void;
}) {
  const prompt = withName(question.prompt, name);
  const helper = question.helper ? withName(question.helper, name) : null;
  const placeholder = question.placeholder ? withName(question.placeholder, name) : undefined;

  if (question.type === "text") {
    const v = typeof value === "string" ? value : "";
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={question.id} className="text-base font-semibold text-iw-text-strong">
          {prompt}
          {question.optional ? (
            <span className="ml-2 text-xs font-medium text-iw-text-muted">Optional</span>
          ) : null}
        </label>
        {helper ? <p className="-mt-1 text-xs text-iw-text-muted">{helper}</p> : null}
        <textarea
          id={question.id}
          value={v}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full resize-y rounded-iw-control border border-iw-border bg-white px-3.5 py-3 text-sm text-iw-text-strong placeholder:text-iw-text-muted focus:border-[var(--aivo-sensory-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-ringFocus)]"
        />
      </div>
    );
  }

  const isMulti = question.type === "multi";
  const selected = (val: string) =>
    isMulti ? (Array.isArray(value) ? value.includes(val) : false) : value === val;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-base font-semibold text-iw-text-strong">
        {prompt}
        {question.optional ? (
          <span className="ml-2 text-xs font-medium text-iw-text-muted">Optional</span>
        ) : null}
      </legend>
      {helper ? <p className="-mt-1 mb-1 text-xs text-iw-text-muted">{helper}</p> : null}
      <div className="grid gap-2">
        {question.options?.map((o) => {
          const sel = selected(o.value);
          return (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-3 rounded-iw-control border border-iw-border bg-white px-4 py-3 text-sm text-iw-text-strong transition-colors hover:bg-[var(--aivo-color-surface-muted)] has-[:checked]:border-[var(--aivo-sensory-primary)] has-[:checked]:bg-[var(--aivo-color-aivoPurple-50)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--aivo-sensory-ringFocus)]"
            >
              <input
                type={isMulti ? "checkbox" : "radio"}
                name={question.id}
                value={o.value}
                checked={sel}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={[
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center border text-white",
                  isMulti ? "rounded-[6px]" : "rounded-full",
                  sel
                    ? "border-[var(--aivo-sensory-primary)] bg-[var(--aivo-sensory-primary)]"
                    : "border-iw-border",
                ].join(" ")}
              >
                {sel ? <CheckIcon className="h-3 w-3" /> : null}
              </span>
              <span className="min-w-0 font-medium">{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
