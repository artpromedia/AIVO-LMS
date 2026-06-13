"use client";

/**
 * Field-level autosave for the parent assessment wizard (Sprint C-11).
 *
 * The wizard form (`page.tsx`) is a server-rendered `<form action={…}>` of
 * uncontrolled native inputs whose AUTHORITATIVE write is the step-commit POST
 * (Save & continue). Sprint C-11 layers a calmer, continuous truth on top: as
 * the parent types or picks, their answers are saved to the draft store within
 * ~1.6s of going idle, and a quiet "Saved ✓ · just now" indicator on the card
 * proves it — so the anxious 11pm parent never wonders whether a battery death
 * mid-screen lost their work.
 *
 * Design (mirrors the C-10 therapist autosave SaveState pattern, applied to a
 * multi-field server form rather than a controlled single-page form):
 *   - This island WRAPS the form's children and listens to `input`/`change`
 *     events bubbling up from the native fields. It never controls them, so the
 *     existing uncontrolled inputs + the server action keep working unchanged
 *     (and work with JS disabled — the indicator simply never appears).
 *   - On a change it debounces, reads the form's CURRENT values via FormData,
 *     builds one draft payload PER SECTION on the active step (using the same
 *     list-parsing / coercion the server action uses), and PATCHes each to the
 *     draft-lenient BFF. Partial sections are fine (draft ≠ submit).
 *   - States: idle → saving → saved | retry (offline/failed-save). A failed
 *     save shows "Couldn't save — retrying…" and retries with backoff; it never
 *     opens a modal and never blocks the parent. Step-Next remains the
 *     authoritative write, so a missed autosave never costs data.
 *   - The status line is `aria-live="polite"` and DEBOUNCED (announced only on
 *     a settled state, ≥ the debounce gap) so screen readers aren't spammed on
 *     every keystroke.
 *   - Honors `prefers-reduced-motion`: the only motion is the spinner, guarded
 *     by a `motion-reduce:animate-none` variant.
 */
import * as React from "react";
import { useTranslations } from "next-intl";

type SaveState = "idle" | "saving" | "saved" | "retry";

/** How each section's flat form fields fold into its draft payload. Mirrors the
 *  server action's `parseList` / coercion in `page.tsx` so an autosaved draft is
 *  byte-identical to what a Save & continue would have written. */
type FieldKind =
  | { kind: "string"; field: string }
  | { kind: "number"; field: string }
  | { kind: "bool"; field: string }
  | { kind: "list"; field: string; max?: number }
  | { kind: "multi"; field: string }
  | { kind: "diagnoses" } // background.diagnoses + background.diagnosesOther → diagnoses[]
  | { kind: "languages" }; // basics.languages (comma list, max 5)

const SECTION_FIELD_MAP: Record<string, FieldKind[]> = {
  basics: [
    { kind: "string", field: "dob" },
    { kind: "string", field: "pronouns" },
    { kind: "languages" },
  ],
  background: [{ kind: "diagnoses" }, { kind: "multi", field: "services" }],
  strengths: [
    { kind: "string", field: "loves" },
    { kind: "list", field: "goodAt", max: 10 },
    { kind: "string", field: "motivates" },
  ],
  frustration: [
    { kind: "list", field: "triggers" },
    { kind: "list", field: "calmingStrategies" },
  ],
  grade_subject: [
    { kind: "string", field: "gradeBand" },
    { kind: "multi", field: "focusSubjects" },
  ],
  attention: [
    { kind: "number", field: "focusWindowMinutes" },
    { kind: "string", field: "breakStyle" },
    { kind: "bool", field: "movementHelps" },
  ],
  pace: [{ kind: "string", field: "preferred" }],
  communication: [
    { kind: "string", field: "style" },
    { kind: "bool", field: "aacUsed" },
    { kind: "string", field: "notes" },
  ],
  learning_profile: [
    { kind: "string", field: "communicationMode" },
    { kind: "string", field: "deviceInteraction" },
    { kind: "string", field: "responseMethod" },
    { kind: "string", field: "attentionSpanBucket" },
    { kind: "multi", field: "bestModes" },
  ],
  reading: [
    { kind: "string", field: "comfort" },
    { kind: "string", field: "notes" },
  ],
  math: [
    { kind: "string", field: "comfort" },
    { kind: "string", field: "notes" },
  ],
  sensory: [
    { kind: "multi", field: "sensitivities" },
    { kind: "string", field: "seekingOrAvoiding" },
  ],
  accommodations: [
    { kind: "list", field: "known", max: 20 },
    { kind: "bool", field: "extendedTime" },
    { kind: "bool", field: "readAloud" },
    { kind: "bool", field: "speechToText" },
  ],
  homework: [
    { kind: "bool", field: "needsCoaching" },
    { kind: "string", field: "bestTimeOfDay" },
    { kind: "number", field: "typicalSessionMinutes" },
  ],
  goals: [
    { kind: "list", field: "goals", max: 8 },
    { kind: "string", field: "timeline" },
  ],
  motivation: [
    { kind: "list", field: "rewardsThatHelp" },
    { kind: "list", field: "avoidanceFactors" },
  ],
  concerns: [{ kind: "string", field: "concerns" }],
};

function parseList(raw: string, max = 10): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Build the draft payload for one section from the live form snapshot. Only
 *  includes fields the parent has actually touched/filled, so an empty section
 *  PATCHes `{}` (a no-op the draft-lenient endpoint accepts). Exported for the
 *  autosave unit test (type → idle → persisted-draft assertion). */
export function buildSectionPayload(form: FormData, section: string): Record<string, unknown> {
  const spec = SECTION_FIELD_MAP[section];
  if (!spec) return {};
  const out: Record<string, unknown> = {};
  for (const f of spec) {
    switch (f.kind) {
      case "string": {
        const v = String(form.get(`${section}.${f.field}`) ?? "").trim();
        if (v) out[f.field] = v;
        break;
      }
      case "number": {
        const raw = String(form.get(`${section}.${f.field}`) ?? "").trim();
        if (raw) {
          const n = Number.parseInt(raw, 10);
          if (Number.isFinite(n)) out[f.field] = n;
        }
        break;
      }
      case "bool": {
        // A checkbox only appears in FormData when checked. Always emit the
        // boolean so unchecking persists `false` (a real, savable answer).
        out[f.field] = form.get(`${section}.${f.field}`) === "on";
        break;
      }
      case "list": {
        const v = parseList(String(form.get(`${section}.${f.field}`) ?? ""), f.max ?? 10);
        if (v.length > 0) out[f.field] = v;
        break;
      }
      case "multi": {
        const v = form.getAll(`${section}.${f.field}`).map(String).filter(Boolean);
        if (v.length > 0) out[f.field] = v;
        break;
      }
      case "diagnoses": {
        const diagnoses = form.getAll("background.diagnoses").map(String).filter(Boolean);
        const other = String(form.get("background.diagnosesOther") ?? "").trim();
        if (other) diagnoses.push(...parseList(other, 5));
        if (diagnoses.length > 0) out.diagnoses = diagnoses;
        break;
      }
      case "languages": {
        const v = parseList(String(form.get("basics.languages") ?? ""), 5);
        if (v.length > 0) out.languages = v;
        break;
      }
    }
  }
  return out;
}

export interface AssessmentAutosaveProps {
  learnerId: string;
  /** The section ids on the current step — only these get autosaved. */
  sections: string[];
  /** The wizard `<form>` and its fields. */
  children: React.ReactNode;
  /** Debounce window in ms (idle → save). Default ~1.6s. */
  debounceMs?: number;
}

/**
 * Wraps the wizard form and drives field-level autosave. Renders the visible +
 * accessible save indicator on the card, then the form (children).
 */
export function AssessmentAutosave({
  learnerId,
  sections,
  children,
  debounceMs = 1600,
}: AssessmentAutosaveProps) {
  const t = useTranslations("parent.learner_assessment");
  const [state, setState] = React.useState<SaveState>("idle");

  const formRef = React.useRef<HTMLFormElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = React.useRef(0);
  // Monotonic save-request id so a slow in-flight save can't clobber a newer one.
  const saveSeq = React.useRef(0);

  // Resolve the wrapped <form> once mounted so we read live values via FormData.
  React.useEffect(() => {
    formRef.current = wrapperRef.current?.querySelector("form") ?? null;
  }, []);

  const scheduleRetry = React.useCallback((run: () => void) => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    // Capped backoff: 2s, 4s, 8s … max 15s. Keeps retrying quietly forever.
    const delay = Math.min(15000, 2000 * 2 ** Math.min(retries.current, 3));
    retries.current += 1;
    retryTimer.current = setTimeout(run, delay);
  }, []);

  const doSave = React.useCallback(async () => {
    const form = formRef.current;
    if (!form) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // Offline: surface the retry state and try again shortly without losing
      // the typed text (it stays in the uncontrolled inputs + the step-commit).
      setState("retry");
      scheduleRetry(() => void doSave());
      return;
    }
    const snapshot = new FormData(form);
    const seq = ++saveSeq.current;
    setState("saving");
    try {
      const results = await Promise.all(
        sections.map(async (section) => {
          const data = buildSectionPayload(snapshot, section);
          const res = await fetch(`/api/bff/learners/${learnerId}/parent-assessment`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ section, data }),
          });
          return res.ok;
        }),
      );
      if (seq !== saveSeq.current) return; // a newer save superseded this one
      if (results.every(Boolean)) {
        retries.current = 0;
        setState("saved");
      } else {
        setState("retry");
        scheduleRetry(() => void doSave());
      }
    } catch {
      if (seq !== saveSeq.current) return;
      setState("retry");
      scheduleRetry(() => void doSave());
    }
  }, [learnerId, sections, scheduleRetry]);

  const schedule = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(), debounceMs);
  }, [doSave, debounceMs]);

  // Listen for edits bubbling from the native form fields.
  React.useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const onEdit = () => schedule();
    node.addEventListener("input", onEdit);
    node.addEventListener("change", onEdit);
    return () => {
      node.removeEventListener("input", onEdit);
      node.removeEventListener("change", onEdit);
      if (timer.current) clearTimeout(timer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [schedule]);

  // Flush a pending autosave before the page unloads (Save & continue, back,
  // tab close) so the most recent keystrokes are not lost to the debounce gap.
  // The step-commit POST is still the authoritative write; this is belt-and-
  // braces for the autosave's own promise.
  React.useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void doSave();
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [doSave]);

  // Re-try automatically when connectivity returns.
  React.useEffect(() => {
    const onOnline = () => {
      if (state === "retry") void doSave();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [state, doSave]);

  return (
    <div ref={wrapperRef} className="flex flex-col gap-3">
      <AutosaveIndicator state={state} t={t} />
      {children}
    </div>
  );
}

/**
 * The quiet status line at the top of the card. The `aria-live="polite"` region
 * announces only a settled "Saved" / "Couldn't save" — not a burst of "saving"
 * on every keystroke (the debounce throttles state changes). Idle renders
 * nothing so the parent's first impression is the question, not chrome.
 */
function AutosaveIndicator({ state, t }: { state: SaveState; t: (key: string) => string }) {
  if (state === "idle") {
    return (
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="parent-autosave"
        data-state="idle"
      />
    );
  }
  const label =
    state === "saving"
      ? t("autosave_saving")
      : state === "retry"
        ? t("autosave_retry")
        : t("autosave_saved");
  const tone =
    state === "retry"
      ? "text-[var(--aivo-color-status-error-strong)]"
      : state === "saved"
        ? "text-[var(--aivo-color-status-success-strong)]"
        : "text-iw-text-muted";
  return (
    <div
      className="flex items-center justify-end"
      role="status"
      aria-live="polite"
      data-testid="parent-autosave"
      data-state={state}
    >
      <span
        className={`inline-flex items-center gap-1.5 text-xs transition-opacity duration-200 motion-reduce:transition-none ${tone}`}
      >
        {state === "saving" ? <Spinner /> : state === "retry" ? <RetryIcon /> : <CheckIcon />}
        {label}
      </span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
