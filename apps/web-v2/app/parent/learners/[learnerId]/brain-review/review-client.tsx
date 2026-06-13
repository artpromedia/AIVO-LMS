"use client";

/**
 * Sprint C-05 — review rows (client).
 *
 * One inference per row, phrased as a conversation: ✓ "That's right" /
 * ✎ "Not quite". "Not quite" expands inline controls (native radios via
 * `ScaleField`, optional note via `SoftTextField` — both submit natively, so
 * nothing depends on client state to reach the server) and the sticky footer
 * stages everything server-side in one save.
 *
 * Therapist-pinned rows render locked with attribution and no controls; the
 * server rejects a forged unlock independently (`BrainCorrectionLockedError`).
 *
 * Reduced motion: the only animation is the editor reveal; it uses
 * `motion-safe:` so `prefers-reduced-motion` users get an instant swap.
 * Live regions announce the adjustment count and save errors.
 */
import * as React from "react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Lock, PencilLine } from "lucide-react";
import { ScaleField, SoftTextField } from "@aivo/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ComfortLevel, LearnerBrainProfileState } from "@/lib/db/types";
import type { SaveCorrectionsState } from "./actions";

export type ComfortRowDTO = {
  field: "readingComfort" | "mathComfort";
  current: ComfortLevel | "unspecified";
};

export type SupportRowDTO = {
  slug: string;
  field: string;
  label: string;
  enabled: boolean;
  reasoning: string;
  locked: boolean;
};

export type TutorRowDTO = {
  key: string;
  field: string;
  name: string;
  reasoning: string;
};

const COMFORT_OPTIONS: ComfortLevel[] = ["new", "growing", "confident", "advanced"];

const INITIAL_SAVE_STATE: SaveCorrectionsState = { error: null };

export function BrainReviewClient({
  learnerId,
  learnerName,
  comfortRows,
  modalities,
  supportRows,
  tutorRows,
  initialValues,
  initialNotes,
  hasDraft,
  saveAction,
}: {
  learnerId: string;
  learnerName: string;
  comfortRows: ComfortRowDTO[];
  modalities: LearnerBrainProfileState["preferredModalities"];
  supportRows: SupportRowDTO[];
  tutorRows: TutorRowDTO[];
  /** field → control value ("on"/"off" or a comfort level) from the staged draft. */
  initialValues: Record<string, string>;
  /** field → note text from the staged draft. */
  initialNotes: Record<string, string>;
  hasDraft: boolean;
  saveAction: (prev: SaveCorrectionsState, formData: FormData) => Promise<SaveCorrectionsState>;
}) {
  const t = useTranslations("parent.brain_review");
  const formRef = useRef<HTMLFormElement>(null);
  const [saveState, formAction, pending] = useActionState(saveAction, INITIAL_SAVE_STATE);

  // Rows whose ✎ editor is open. Staged-draft rows resume open so the parent
  // sees exactly what they saved last time.
  const [openEditors, setOpenEditors] = useState<ReadonlySet<string>>(
    () => new Set([...Object.keys(initialValues), ...Object.keys(initialNotes)]),
  );
  // Rows the parent confirmed with ✓ — visual acknowledgement only; an
  // unconfirmed, untouched row is treated identically by the save.
  const [confirmed, setConfirmed] = useState<ReadonlySet<string>>(new Set());
  // Fields currently carrying a real adjustment (value differs or note text).
  const [adjusted, setAdjusted] = useState<ReadonlySet<string>>(new Set());

  // What "unchanged" means per field, for the live adjustment count.
  const originals = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of comfortRows) map.set(row.field, row.current);
    for (const row of supportRows) map.set(row.field, row.enabled ? "on" : "off");
    for (const row of tutorRows) map.set(row.field, "on");
    return map;
  }, [comfortRows, supportRows, tutorRows]);

  const recount = React.useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const next = new Set<string>();
    for (const [key, entry] of data.entries()) {
      if (typeof entry !== "string") continue;
      if (key.startsWith("value:")) {
        const field = key.slice("value:".length);
        if (entry !== originals.get(field)) next.add(field);
      } else if (key.startsWith("note:") && entry.trim().length > 0) {
        next.add(key.slice("note:".length));
      }
    }
    setAdjusted(next);
  }, [originals]);

  // Editors mount/unmount their native inputs — recount after each change.
  useEffect(() => {
    recount();
  }, [openEditors, recount]);

  const toggleEditor = (field: string) => {
    setOpenEditors((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
    setConfirmed((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const confirmRow = (field: string) => {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
    // Confirming closes the editor — the row stays exactly as AIVO built it.
    setOpenEditors((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const comfortLabel = (value: ComfortLevel | "unspecified") =>
    value === "unspecified" ? t("comfort_unspecified") : t(`comfort_${value}`);

  const rowActions = (field: string, locked: boolean) => {
    if (locked) return null;
    const isOpen = openEditors.has(field);
    const isConfirmed = confirmed.has(field);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={isConfirmed ? "soft" : "outline"}
          aria-pressed={isConfirmed}
          onClick={() => confirmRow(field)}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {isConfirmed ? t("confirmed_row") : t("confirm_row")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isOpen ? "soft" : "outline"}
          aria-expanded={isOpen}
          aria-controls={`${field}-editor`}
          onClick={() => toggleEditor(field)}
        >
          <PencilLine className="h-4 w-4" aria-hidden="true" />
          {isOpen ? t("close_editor") : t("correct_row")}
        </Button>
      </div>
    );
  };

  const editorShell = (field: string, children: React.ReactNode) => (
    <div
      id={`${field}-editor`}
      className="brain-review-editor mt-3 space-y-4 rounded-iw-card border border-iw-border bg-iw-raised p-4"
    >
      {children}
    </div>
  );

  const noteField = (field: string) => (
    <SoftTextField
      name={`note:${field}`}
      label={t("note_label")}
      placeholder={t("note_placeholder")}
      multiline
      maxLength={500}
      defaultValue={initialNotes[field]}
    />
  );

  const adjustedBadge = (field: string) =>
    adjusted.has(field) ? <Badge tone="primary">{t("corrected_badge")}</Badge> : null;

  const count = adjusted.size;

  return (
    <form ref={formRef} action={formAction} onChange={recount} onInput={recount}>
      <input type="hidden" name="learnerId" value={learnerId} />

      {hasDraft ? (
        <Card variant="accent" className="mb-4 p-4">
          <p role="status" className="text-sm text-aivo-ink">
            {t("resume_note")}
          </p>
        </Card>
      ) : null}

      {/* ── How {name} learns ─────────────────────────────────────── */}
      <section aria-labelledby="brain-review-how" className="mb-8">
        <h2 id="brain-review-how" className="text-lg font-semibold text-aivo-ink">
          {t("section_how_learns", { name: learnerName })}
        </h2>
        <p className="mt-1 text-sm text-aivo-ink-soft">{t("section_how_learns_hint")}</p>
        <ul className="mt-3 space-y-3">
          {comfortRows.map((row) => {
            const label =
              row.field === "readingComfort"
                ? t("reading_comfort_label")
                : t("math_comfort_label");
            return (
              <li key={row.field}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-aivo-ink">{label}</p>
                    <span className="flex items-center gap-2">
                      {adjustedBadge(row.field)}
                      <Badge tone="neutral">{comfortLabel(row.current)}</Badge>
                    </span>
                  </div>
                  <div className="mt-3">{rowActions(row.field, false)}</div>
                  {openEditors.has(row.field)
                    ? editorShell(
                        row.field,
                        <>
                          <ScaleField
                            name={`value:${row.field}`}
                            legend={t("comfort_picker_legend", { name: learnerName })}
                            options={COMFORT_OPTIONS.map((value) => ({
                              value,
                              label: t(`comfort_${value}`),
                            }))}
                            defaultValue={
                              initialValues[row.field] ??
                              (row.current === "unspecified" ? undefined : row.current)
                            }
                          />
                          {noteField(row.field)}
                        </>,
                      )
                    : null}
                </Card>
              </li>
            );
          })}
          <li>
            <Card className="p-4">
              <p className="text-sm font-semibold text-aivo-ink">{t("modalities_label")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {modalities.map((m) => (
                  <Badge key={m} tone="primary">
                    {t(`modality_${m}`)}
                  </Badge>
                ))}
              </div>
            </Card>
          </li>
        </ul>
      </section>

      {/* ── Supports ──────────────────────────────────────────────── */}
      <section aria-labelledby="brain-review-supports" className="mb-8">
        <h2 id="brain-review-supports" className="text-lg font-semibold text-aivo-ink">
          {t("section_supports")}
        </h2>
        <p className="mt-1 text-sm text-aivo-ink-soft">
          {t("section_supports_hint", { name: learnerName })}
        </p>
        <ul className="mt-3 space-y-3">
          {supportRows.map((row) => (
            <li key={row.field}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-aivo-ink">{row.label}</p>
                  <span className="flex items-center gap-2">
                    {adjustedBadge(row.field)}
                    {row.locked ? (
                      <Badge tone="accent">
                        <Lock className="h-3 w-3" aria-hidden="true" /> {t("locked_badge")}
                      </Badge>
                    ) : null}
                    <Badge tone={row.enabled ? "success" : "neutral"}>
                      {row.enabled ? t("support_on") : t("support_off")}
                    </Badge>
                  </span>
                </div>
                <p className="mt-2 text-sm text-aivo-ink-soft">{row.reasoning}</p>
                {row.locked ? (
                  <p className="mt-3 flex items-start gap-2 rounded-iw-card bg-iw-accent-soft p-3 text-sm text-aivo-ink">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {t("locked_by_therapist", { name: learnerName })}
                  </p>
                ) : (
                  <div className="mt-3">{rowActions(row.field, false)}</div>
                )}
                {!row.locked && openEditors.has(row.field)
                  ? editorShell(
                      row.field,
                      <>
                        <ScaleField
                          name={`value:${row.field}`}
                          legend={t("support_picker_legend")}
                          options={[
                            {
                              value: "on",
                              label: row.enabled ? t("support_keep_on") : t("support_turn_on"),
                            },
                            {
                              value: "off",
                              label: row.enabled ? t("support_turn_off") : t("support_keep_off"),
                            },
                          ]}
                          defaultValue={initialValues[row.field] ?? (row.enabled ? "on" : "off")}
                        />
                        {noteField(row.field)}
                      </>,
                    )
                  : null}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Tutors ────────────────────────────────────────────────── */}
      <section aria-labelledby="brain-review-tutors" className="mb-8">
        <h2 id="brain-review-tutors" className="text-lg font-semibold text-aivo-ink">
          {t("section_tutors", { name: learnerName })}
        </h2>
        <p className="mt-1 text-sm text-aivo-ink-soft">{t("section_tutors_hint")}</p>
        <ul className="mt-3 space-y-3">
          {tutorRows.map((row) => (
            <li key={row.field}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-aivo-ink">{row.name}</p>
                  {adjustedBadge(row.field)}
                </div>
                <p className="mt-2 text-sm text-aivo-ink-soft">{row.reasoning}</p>
                <div className="mt-3">{rowActions(row.field, false)}</div>
                {openEditors.has(row.field)
                  ? editorShell(
                      row.field,
                      <>
                        <ScaleField
                          name={`value:${row.field}`}
                          legend={t("tutor_picker_legend", { name: learnerName })}
                          options={[
                            { value: "on", label: t("tutor_keep") },
                            { value: "off", label: t("tutor_release") },
                          ]}
                          defaultValue={initialValues[row.field] ?? "on"}
                        />
                        {noteField(row.field)}
                      </>,
                    )
                  : null}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Sticky footer: save & continue ─────────────────────────── */}
      <div className="sticky bottom-0 z-10 -mx-2 px-2 pb-2">
        <Card variant="elevated" className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p aria-live="polite" className="text-sm font-medium text-aivo-ink">
              {count > 0 ? t("adjustments_count", { count }) : t("no_adjustments")}
            </p>
            {saveState.error ? (
              <p role="alert" className="mt-1 text-sm text-aivo-danger">
                {saveState.error === "locked" ? t("save_error_locked") : t("save_error")}
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={pending} aria-disabled={pending}>
            {count > 0 ? t("save_continue") : t("confirm_all_continue")}
          </Button>
        </Card>
      </div>

      {/* Calm editor reveal — disabled entirely under prefers-reduced-motion
          (and by the manual [data-reduced-motion="reduce"] override in
          globals.css, which zeroes all animation durations). */}
      <style>{`
        @keyframes brainReviewEditorIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .brain-review-editor { animation: brainReviewEditorIn 160ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .brain-review-editor { animation: none; }
        }
      `}</style>
    </form>
  );
}
