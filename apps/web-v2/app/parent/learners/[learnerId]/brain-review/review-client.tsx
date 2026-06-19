"use client";

/**
 * BrainReview right column (client) — BrainReview.dc.html.
 *
 * One native <form> spans the three handoff cards so the parent's removed tags,
 * context/change notes, and consent all submit together without bespoke wiring:
 *
 *   - Removing a Superpower / Support tag (×) hides it and emits a hidden
 *     `value:<field>=off` input — folded for accommodations, recorded-only for
 *     superpowers (the server decides; therapist-pinned supports stay locked).
 *   - "Add context" / "Request changes" reveal a shared note box; their buttons
 *     submit via `stageAction` (stage + route to the clone-watch recap).
 *   - "Approve & Create" submits the form to `approveAction` (stage + the shared
 *     consent/RAI trust gate + fold + approval record), gated on the consent
 *     checkbox AND opening the RAI disclosure — defense-in-depth still rejects a
 *     forged POST server-side.
 *
 * Reduced motion: no entrance animation here; the only motion is the brain bob
 * on the server-rendered hero, which is itself behind prefers-reduced-motion.
 */
import * as React from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  MessageSquarePlus,
  PencilLine,
  Shield,
  Sliders,
  Sparkles,
  Star,
  X,
  Zap,
} from "lucide-react";

export type TagDTO = { field: string; label: string; locked?: boolean };
export type SensoryDTO = { body: string; tags: string[] };
export type PacingDTO = { label: string; sub: string };
export type GuideDTO = { name: string; icon: string; sub: string };
export type RaiDTO = {
  dataSources: string[];
  biasMitigations: string[];
  transparency: string;
  oversight: string;
};

interface Props {
  learnerId: string;
  learnerName: string;
  superpowers: TagDTO[];
  supports: TagDTO[];
  sensory: SensoryDTO | null;
  pacing: PacingDTO;
  guide: GuideDTO | null;
  rai: RaiDTO | null;
  editProfileHref: string;
  backHref: string;
  raiVersion: string;
  initialError: string | null;
  stageAction: (formData: FormData) => Promise<void>;
  approveAction: (formData: FormData) => Promise<void>;
}

const CARD = "rounded-[22px] bg-white p-6 shadow-[0_12px_34px_rgba(60,40,110,0.08)]";
const SECTION_LABEL =
  "mb-2.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.04em] text-iw-text-muted";

function ApproveButton({ ready, label }: { ready: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!ready || pending}
      aria-disabled={!ready || pending}
      className={
        ready && !pending
          ? "inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[var(--aivo-color-aivoPurple-400)] to-[var(--aivo-sensory-primary)] px-6 py-3.5 text-base font-bold text-white shadow-[0_12px_26px_rgba(124,58,237,0.3)] hover:brightness-110"
          : "inline-flex items-center gap-2.5 rounded-full bg-[var(--aivo-color-aivoPurple-200)] px-6 py-3.5 text-base font-bold text-white cursor-not-allowed"
      }
    >
      {label}
      <ArrowRight className="h-[19px] w-[19px]" aria-hidden="true" />
    </button>
  );
}

export function BrainReviewClient({
  learnerId,
  learnerName,
  superpowers,
  supports,
  sensory,
  pacing,
  guide,
  rai,
  editProfileHref,
  backHref,
  raiVersion,
  initialError,
  stageAction,
  approveAction,
}: Props) {
  const t = useTranslations("parent.brain_review");
  const [denied, setDenied] = React.useState<ReadonlySet<string>>(new Set());
  const [mode, setMode] = React.useState<"none" | "context" | "request">("none");
  const [consent, setConsent] = React.useState(false);
  const [raiSeen, setRaiSeen] = React.useState(false);

  const remove = (field: string) =>
    setDenied((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });

  const deniedCount = denied.size;
  const removedNote =
    deniedCount === 1 ? t("removed_one") : t("removed_other", { count: deniedCount });

  const errorMsg =
    initialError === "consent"
      ? t("error_consent")
      : initialError === "locked"
        ? t("error_locked")
        : initialError === "save"
          ? t("error_save")
          : null;

  const renderTag = (tag: TagDTO, tone: "super" | "support") => {
    if (denied.has(tag.field)) return null;
    const toneClass =
      tone === "super"
        ? "bg-[var(--aivo-color-status-success-subtle)] text-[var(--aivo-color-status-success-strong)]"
        : "bg-[var(--aivo-color-status-error-subtle)] text-[var(--aivo-color-status-error-strong)]";
    return (
      <span
        key={tag.field}
        className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-2 text-[13px] font-bold ${toneClass}`}
      >
        {tag.label}
        {tag.locked ? (
          <Shield className="h-3.5 w-3.5 opacity-70" aria-label={t("locked_badge")} />
        ) : (
          <button
            type="button"
            onClick={() => remove(tag.field)}
            aria-label={t("remove_tag", { label: tag.label })}
            className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/[0.07] hover:bg-black/[0.14]"
          >
            <X className="h-2.5 w-2.5" aria-hidden="true" />
          </button>
        )}
      </span>
    );
  };

  return (
    <form action={approveAction} className="flex flex-col gap-5">
      <input type="hidden" name="learnerId" value={learnerId} />
      <input type="hidden" name="raiVersion" value={raiVersion} />
      <input type="hidden" name="consentGiven" value={consent ? "true" : "false"} />
      <input type="hidden" name="raiAcknowledged" value={raiSeen ? "true" : "false"} />
      {[...denied].map((field) => (
        <input key={field} type="hidden" name={`value:${field}`} value="off" />
      ))}

      {/* ── Pre-Clone Review ─────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="font-iw-display flex items-center gap-2 text-xl font-bold text-iw-text-strong">
            <Sparkles className="h-5 w-5 text-[var(--aivo-sensory-primary)]" aria-hidden="true" />
            {t("review_heading")}
          </div>
          <Link
            href={editProfileHref}
            className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--aivo-color-aivoPurple-50)] px-3.5 py-2 text-[13.5px] font-bold text-[var(--aivo-sensory-primary)] hover:brightness-[0.97]"
          >
            <PencilLine className="h-[15px] w-[15px]" aria-hidden="true" />
            {t("edit_profile")}
          </Link>
        </div>

        <div className="mb-5 grid gap-5 sm:grid-cols-2">
          <div>
            <div className={SECTION_LABEL}>
              <Star className="h-[15px] w-[15px] text-[var(--aivo-color-aivoOrange-500)]" aria-hidden="true" />
              {t("superpowers_heading")}
            </div>
            <div className="flex flex-wrap gap-2">
              {superpowers.length > 0 ? (
                superpowers.map((tag) => renderTag(tag, "super"))
              ) : (
                <p className="text-[13px] text-iw-text-muted">{t("none_yet")}</p>
              )}
            </div>
          </div>
          <div>
            <div className={SECTION_LABEL}>
              <Zap className="h-[15px] w-[15px] text-[var(--aivo-color-aivoOrange-500)]" aria-hidden="true" />
              {t("supports_heading")}
            </div>
            <div className="flex flex-wrap gap-2">
              {supports.length > 0 ? (
                supports.map((tag) => renderTag(tag, "support"))
              ) : (
                <p className="text-[13px] text-iw-text-muted">{t("none_yet")}</p>
              )}
            </div>
          </div>
        </div>

        {sensory ? (
          <>
            <div className={SECTION_LABEL}>
              <Sliders className="h-[15px] w-[15px]" aria-hidden="true" />
              {t("sensory_heading")}
            </div>
            <div className="mb-5 rounded-[14px] bg-[var(--aivo-color-status-info-subtle)] p-4">
              <p className="mb-2.5 text-sm font-semibold leading-relaxed text-[var(--aivo-color-status-info-strong)]">
                {sensory.body}
              </p>
              {sensory.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {sensory.tags.map((tg) => (
                    <span
                      key={tg}
                      className="rounded-full bg-[var(--aivo-color-status-info-default)]/30 px-2.5 py-1 text-xs font-bold text-[var(--aivo-color-status-info-strong)]"
                    >
                      {tg}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className={SECTION_LABEL}>{t("pacing_heading")}</div>
            <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-iw-border px-4 py-3">
              <svg className="h-6 w-6 text-[var(--aivo-color-aivoOrange-500)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <div>
                <div className="text-[14.5px] font-bold text-iw-text-strong">{pacing.label}</div>
                <div className="text-[12.5px] text-iw-text-muted">{pacing.sub}</div>
              </div>
            </div>
          </div>
          {guide ? (
            <div>
              <div className={SECTION_LABEL}>{t("guide_heading")}</div>
              <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-iw-border px-4 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--aivo-color-aivoPurple-50)] text-xl" aria-hidden="true">
                  {guide.icon}
                </span>
                <div>
                  <div className="text-[14.5px] font-bold text-iw-text-strong">{guide.name}</div>
                  <div className="text-[12.5px] text-iw-text-muted">{guide.sub}</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Review actions ───────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="font-iw-display mb-1 text-lg font-bold text-iw-text-strong">
          {t("feel_right_title")}
        </div>
        <p className="mb-3.5 text-sm leading-relaxed text-iw-text-muted">{t("feel_right_body")}</p>
        {deniedCount > 0 ? (
          <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--aivo-color-status-error-subtle)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--aivo-color-status-error-strong)]">
            <X className="h-3 w-3" aria-hidden="true" />
            {removedNote} — {t("removed_suffix")}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setMode((m) => (m === "context" ? "none" : "context"))}
            aria-expanded={mode === "context"}
            className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--aivo-color-aivoPurple-200)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--aivo-sensory-primary)] hover:bg-[var(--aivo-color-aivoPurple-50)]"
          >
            <MessageSquarePlus className="h-[15px] w-[15px]" aria-hidden="true" />
            {t("add_context")}
          </button>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "request" ? "none" : "request"))}
            aria-expanded={mode === "request"}
            className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--aivo-color-aivoOrange-200)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--aivo-color-aivoOrange-700)] hover:bg-[var(--aivo-color-aivoOrange-50)]"
          >
            <PencilLine className="h-[15px] w-[15px]" aria-hidden="true" />
            {t("request_changes")}
          </button>
        </div>
        {mode !== "none" ? (
          <div className="mt-3.5">
            <label htmlFor="brain-review-note" className="sr-only">
              {mode === "context" ? t("add_context") : t("request_changes")}
            </label>
            <textarea
              id="brain-review-note"
              name="note:concern"
              rows={3}
              placeholder={mode === "context" ? t("context_placeholder") : t("request_placeholder")}
              className="w-full resize-y rounded-[13px] border-[1.5px] border-iw-border bg-white p-3.5 text-sm text-iw-text-strong placeholder:text-iw-text-muted/70 focus:border-[var(--aivo-sensory-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)]/40"
            />
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="submit"
                formAction={stageAction}
                className={
                  mode === "context"
                    ? "rounded-[11px] bg-[var(--aivo-sensory-primary)] px-5 py-2.5 text-sm font-bold text-white hover:brightness-110"
                    : "rounded-[11px] bg-[var(--aivo-color-aivoOrange-700)] px-5 py-2.5 text-sm font-bold text-white hover:brightness-110"
                }
              >
                {mode === "context" ? t("send_to_aivo") : t("submit_request")}
              </button>
              <button
                type="button"
                onClick={() => setMode("none")}
                className="px-2 text-sm font-bold text-iw-text-muted hover:text-iw-text-strong"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Parental consent ─────────────────────────────────────────── */}
      <section className={CARD}>
        <div className="font-iw-display mb-3.5 flex items-center gap-2 text-xl font-bold text-iw-text-strong">
          <Shield className="h-5 w-5 text-[var(--aivo-sensory-primary)]" aria-hidden="true" />
          {t("consent_heading")}
        </div>
        <p className="mb-4 text-[14.5px] leading-relaxed text-iw-text-muted">
          {t("consent_body", { name: learnerName })}
        </p>

        {rai ? (
          <details
            className="mb-4 rounded-[14px] border border-iw-border bg-[var(--aivo-color-surface-sunken)] p-4"
            onToggle={(e) => {
              if ((e.currentTarget as HTMLDetailsElement).open) setRaiSeen(true);
            }}
          >
            <summary className="cursor-pointer text-sm font-bold text-[var(--aivo-sensory-primary)]">
              {t("rai_title", { name: learnerName })}
            </summary>
            <div className="mt-3 flex flex-col gap-3 text-[13px] leading-relaxed text-iw-text-muted">
              {rai.dataSources.length > 0 ? (
                <div>
                  <p className="font-bold text-iw-text-strong">{t("rai_data_sources")}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {rai.dataSources.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {rai.biasMitigations.length > 0 ? (
                <div>
                  <p className="font-bold text-iw-text-strong">{t("rai_bias")}</p>
                  <ul className="mt-1 list-disc pl-5">
                    {rai.biasMitigations.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {rai.transparency ? (
                <p>
                  <span className="font-bold text-iw-text-strong">{t("rai_transparency")}: </span>
                  {rai.transparency}
                </p>
              ) : null}
              {rai.oversight ? (
                <p>
                  <span className="font-bold text-iw-text-strong">{t("rai_oversight")}: </span>
                  {rai.oversight}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        <label className="mb-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.currentTarget.checked)}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            className={
              consent
                ? "mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg bg-[var(--aivo-sensory-primary)] text-white"
                : "mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border-2 border-[var(--aivo-color-aivoPurple-200)] bg-white"
            }
          >
            {consent ? <Check className="h-[15px] w-[15px]" strokeWidth={3.2} /> : null}
          </span>
          <span className="flex-1 text-sm leading-relaxed text-iw-text-strong">
            {t("consent_agree", { name: learnerName })}
          </span>
        </label>

        {errorMsg ? (
          <p role="alert" className="mb-3 text-sm font-semibold text-[var(--aivo-color-status-error-strong)]">
            {errorMsg}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <Link href={backHref} className="px-2 py-3 text-base font-bold text-iw-text-muted hover:text-iw-text-strong">
            {t("back")}
          </Link>
          <ApproveButton ready={consent && raiSeen} label={t("approve_cta")} />
        </div>
      </section>
    </form>
  );
}
