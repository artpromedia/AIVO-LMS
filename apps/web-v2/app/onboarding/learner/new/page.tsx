"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { createOnboardingLearnerAction, type AddLearnerState } from "./actions";
import styles from "./add-learner.module.css";

/** Button values mirror GRADE_MAP keys in actions.ts; labels are localized. */
const GRADES = [
  { value: "Pre-K (3-4)", key: "grade_preK" },
  { value: "K-2 (5-7)", key: "grade_k2" },
  { value: "3-5 (8-10)", key: "grade_35" },
  { value: "6-8 (11-13)", key: "grade_68" },
  { value: "9-12 (14-18)", key: "grade_912" },
] as const;

const IEP_OPTIONS = ["yes", "no", "unsure"] as const;

type StepState = "done" | "active" | "upcoming";

function Stepper({ steps }: { steps: Array<{ label: string; state: StepState }> }) {
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-1 items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-xs font-bold",
              s.state === "done" && "bg-[var(--aivo-status-success)] text-white",
              s.state === "active" && "bg-iw-primary text-white",
              s.state === "upcoming" && "bg-[var(--aivo-color-surface-sunken)] text-iw-ink-muted",
            )}
          >
            {s.state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-xs font-bold",
              s.state === "upcoming"
                ? "text-iw-ink-muted"
                : s.state === "done"
                  ? "text-[var(--aivo-status-success)]"
                  : "text-iw-primary",
            )}
          >
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function NewLearnerPage() {
  const t = useTranslations("onboarding.learner_new");
  const ts = useTranslations("onboarding.steps");
  const [state, formAction, pending] = useActionState<AddLearnerState, FormData>(
    createOnboardingLearnerAction,
    { status: "idle" },
  );

  const [firstName, setFirstName] = React.useState("");
  const [grade, setGrade] = React.useState("");
  const [hasIep, setHasIep] = React.useState("");

  const created = state.status === "created";
  const canSubmit = firstName.trim().length > 0 && !pending;

  const steps: Array<{ label: string; state: StepState }> = [
    { label: ts("about_you"), state: "done" },
    { label: ts("add_learner"), state: created ? "done" : "active" },
    { label: ts("assessment"), state: created ? "active" : "upcoming" },
    { label: ts("ready"), state: "upcoming" },
  ];

  return (
    <div className={`${styles.canvas} flex min-h-screen flex-col items-center px-5`}>
      <header className="flex w-full max-w-[560px] items-center justify-between py-5">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO Learning"
          width={140}
          height={30}
          priority
          className="h-[30px] w-auto"
        />
        <Link
          href="/parent/home"
          className="whitespace-nowrap text-[13.5px] font-bold text-iw-ink-muted hover:underline"
        >
          {t("maybe_later")}
        </Link>
      </header>

      <main className="flex w-full max-w-[560px] flex-1 flex-col justify-center pb-10">
        <Stepper steps={steps} />

        {created ? (
          <div className="rounded-iw-hero border border-iw-border bg-white p-9 text-center shadow-soft-3">
            <Image
              src="/images/mascots/cloud-coach.png"
              alt=""
              width={140}
              height={140}
              className="mx-auto mb-1 block h-auto w-[140px]"
            />
            <h1 className="font-iw-display text-[26px] font-bold text-iw-text-strong">
              {t("done_title", { name: state.firstName })}
            </h1>
            <p className="mx-auto mb-6 mt-2 max-w-[26rem] text-[14.5px] leading-relaxed text-iw-text-muted">
              {t("done_subtitle")}
            </p>
            <Link
              href={`/parent/learners/${state.learnerId}/assessment`}
              className="inline-flex items-center gap-2.5 rounded-iw-card bg-iw-primary px-6 py-3.5 font-iw-display text-base font-semibold text-white shadow-md transition-colors hover:bg-iw-primary-hover"
            >
              {t("start_assessment")}
              <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <p className="mt-3.5">
              <Link
                href="/parent/home"
                className="text-[13px] font-bold text-iw-ink-muted hover:underline"
              >
                {t("do_later")}
              </Link>
            </p>
          </div>
        ) : (
          <form
            action={formAction}
            noValidate
            className="rounded-iw-hero border border-iw-border bg-white p-8 shadow-soft-3"
          >
            <input type="hidden" name="grade" value={grade} />
            <input type="hidden" name="hasIep" value={hasIep} />

            <span className="mb-4 inline-flex h-[52px] w-[52px] items-center justify-center rounded-[15px] bg-iw-primary-soft text-iw-primary">
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 14c1.5-1.5 3-3.3 3-5.5A3.5 3.5 0 0 0 15.5 6 3.5 3.5 0 0 0 9 8.5c0 2.2 1.5 4 3 5.5l3 3z" />
                <circle cx="6.5" cy="17.5" r="3.5" />
              </svg>
            </span>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.1em] text-iw-ink-muted">
              {t("eyebrow")}
            </p>
            <h1 className="mb-1.5 font-iw-display text-[27px] font-bold text-iw-text-strong">
              {t("title")}
            </h1>
            <p className="mb-6 text-[14.5px] leading-relaxed text-iw-text-muted">{t("subtitle")}</p>

            {state.status === "error" ? (
              <div
                role="alert"
                className="mb-4 rounded-iw-control border border-[var(--aivo-status-error-subtle)] bg-[var(--aivo-status-error-subtle)] px-4 py-3 text-sm font-semibold text-[var(--aivo-status-error-strong)]"
              >
                {state.error === "seat_limit" ? t("error_seat_limit") : t("error_first_name")}
              </div>
            ) : null}

            <div className="mb-[18px]">
              <label
                htmlFor="firstName"
                className="mb-1.5 block text-[13px] font-bold text-iw-text-strong"
              >
                {t("first_name_label")}
              </label>
              <input
                id="firstName"
                name="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t("first_name_placeholder")}
                autoComplete="off"
                required
                className="h-[50px] w-full rounded-[13px] border-[1.5px] border-iw-border bg-white px-[15px] text-[15px] text-iw-text-strong outline-none focus:border-iw-primary focus:ring-2 focus:ring-iw-primary/20"
              />
            </div>

            <fieldset className="mb-[18px]">
              <legend className="mb-1.5 block text-[13px] font-bold text-iw-text-strong">
                {t("grade_band_label")}
              </legend>
              <div className="grid grid-cols-2 gap-2.5">
                {GRADES.map((g) => {
                  const selected = grade === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setGrade(selected ? "" : g.value)}
                      className={cn(
                        "rounded-xl border-[1.5px] p-3 text-[13.5px] font-bold text-iw-text-strong transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
                        selected
                          ? "border-iw-primary bg-iw-primary-soft"
                          : "border-iw-border bg-white hover:border-iw-text-muted",
                      )}
                    >
                      {t(g.key)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-iw-ink-muted">{t("grade_band_help")}</p>
            </fieldset>

            <fieldset className="mb-6">
              <legend className="mb-0.5 block text-[13px] font-bold text-iw-text-strong">
                {t("iep_legend")}
              </legend>
              <p className="mb-2.5 text-xs text-iw-ink-muted">{t("iep_help")}</p>
              <div className="flex gap-2.5">
                {IEP_OPTIONS.map((v) => {
                  const selected = hasIep === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setHasIep(selected ? "" : v)}
                      className={cn(
                        "flex-1 rounded-xl border-[1.5px] p-3 text-sm font-bold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring",
                        selected
                          ? "border-iw-primary bg-iw-primary-soft text-iw-primary"
                          : "border-iw-border bg-white text-iw-ink-muted hover:border-iw-text-muted",
                      )}
                    >
                      {t(`iep_${v}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div
              className={`${styles.privacyNote} mb-[22px] flex items-start gap-2.5 rounded-[14px] border px-4 py-3.5`}
            >
              <Lock className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden="true" />
              <p className="text-[12.5px] leading-relaxed">
                {t("privacy_note")}{" "}
                <Link href="/onboarding/privacy" className="font-bold underline">
                  {t("privacy_link")}
                </Link>
              </p>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex w-full items-center justify-center gap-2.5 rounded-[14px] p-[15px] font-iw-display text-base font-semibold text-white transition-colors",
                canSubmit
                  ? "bg-iw-primary shadow-md hover:bg-iw-primary-hover"
                  : "cursor-not-allowed bg-[var(--aivo-color-surface-sunken)] !text-iw-ink-muted",
              )}
            >
              <span>{t("continue")}</span>
              <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <p className="mt-3.5 text-center text-[13px]">
              <Link
                href="/onboarding/parent-setup"
                className="font-bold text-iw-ink-muted hover:underline"
              >
                {t("back")}
              </Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
