"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, Delete, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./create-pin.module.css";

/**
 * /onboarding/pin — CreatePin.dc.html "Create a PIN for {name}".
 *
 * Age-appropriate learner PIN on the calm cool-lavender keypad: enter 4 digits
 * (auto-advances) then re-enter to confirm; a mismatch shakes and restarts. On
 * a match it POSTs to `/api/bff/learners/[learnerId]/pin` (dual-paths to
 * identity-svc or the in-memory dev store) and shows the "all set!" screen that
 * lets the learner enter their stage. The PIN gates the learner into their own
 * profile after a parent sets up the account and approves the cloned brain — it
 * is not a sign-in credential by itself.
 */

type LearnerOption = { id: string; firstName: string };

const NEXT_STEP = (learnerId: string) =>
  `/learner/select/auto?learnerId=${encodeURIComponent(learnerId)}`;
const REVIEW_STEP = (learnerId: string) =>
  `/parent/learners/${encodeURIComponent(learnerId)}/brain-clone-watch`;

async function postPin(learnerId: string, pin: string): Promise<{ blockedForApproval: boolean }> {
  const res = await fetch(`/api/bff/learners/${learnerId}/pin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  let json: { ok?: boolean; error?: { code?: string } } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) {
    if (json.error?.code === "brain_not_approved") return { blockedForApproval: true };
    throw new Error("pin_persist_failed");
  }
  return { blockedForApproval: false };
}

export default function PinSetupPage() {
  const t = useTranslations("onboarding.pin");
  const search = useSearchParams();
  const queryLearnerId = search?.get("learnerId") ?? null;

  const [stage, setStage] = React.useState<"create" | "confirm" | "done">("create");
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [err, setErr] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [learners, setLearners] = React.useState<LearnerOption[] | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = React.useState<string>(queryLearnerId ?? "");

  // Resolve which learner this PIN belongs to (query param wins; else fetch).
  React.useEffect(() => {
    if (queryLearnerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bff/learners");
        const json = (await res.json()) as { ok?: boolean; data?: { learners?: LearnerOption[] } };
        if (cancelled) return;
        const list = json.ok ? (json.data?.learners ?? []) : [];
        setLearners(list);
        if (list.length === 1 && list[0]) setSelectedLearnerId(list[0].id);
      } catch {
        if (!cancelled) setLearners([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryLearnerId]);

  const needsLearner = !selectedLearnerId;
  const noLearnersAvailable = !queryLearnerId && learners !== null && learners.length === 0;
  const selectedName = learners?.find((l) => l.id === selectedLearnerId)?.firstName ?? null;
  const name = selectedName ?? t("your_learner");

  async function save(finalPin: string) {
    if (!selectedLearnerId) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const result = await postPin(selectedLearnerId, finalPin);
      if (result.blockedForApproval) {
        setSaveError(t("approval_required"));
        setStage("create");
        setPin("");
        setConfirm("");
        setSubmitting(false);
        return;
      }
      setStage("done");
    } catch {
      setSaveError(t("save_error"));
      setStage("create");
      setPin("");
      setConfirm("");
      setSubmitting(false);
    }
  }

  function press(d: string) {
    if (submitting || needsLearner) return;
    setSaveError(null);
    if (stage === "create") {
      if (pin.length >= 4) return;
      const v = pin + d;
      if (v.length === 4) {
        setPin(v);
        setConfirm("");
        setStage("confirm");
        setErr(false);
      } else {
        setPin(v);
      }
    } else if (stage === "confirm") {
      if (confirm.length >= 4) return;
      const v = confirm + d;
      if (v.length < 4) {
        setConfirm(v);
      } else if (v === pin) {
        setConfirm(v);
        void save(v);
      } else {
        setConfirm("");
        setPin("");
        setStage("create");
        setErr(true);
      }
    }
  }

  function del() {
    if (stage === "create") setPin((p) => p.slice(0, -1));
    else if (stage === "confirm") setConfirm((c) => c.slice(0, -1));
  }

  const current = stage === "confirm" ? confirm : pin;
  const title = stage === "confirm" ? t("confirm_title") : t("create_title", { name });
  const subtitle = stage === "confirm" ? t("confirm_subtitle") : t("create_subtitle", { name });

  return (
    <div className={`${styles.canvas} flex min-h-screen flex-col`}>
      <header className={styles.headerBar}>
        <div className="mx-auto flex h-[68px] max-w-[1080px] items-center justify-between px-9">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO"
              width={130}
              height={28}
              priority
              className="h-7 w-auto"
            />
            <span className={`${styles.muted} font-iw-display text-base font-bold`}>
              | {t("setup_label")}
            </span>
          </div>
          <div className={`${styles.muted} flex items-center gap-1.5 text-sm font-bold`}>
            <Lock className="h-4 w-4" aria-hidden="true" />
            {t("secure_private")}
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-8">
        {noLearnersAvailable ? (
          <div className="w-[420px] max-w-full rounded-iw-card border border-iw-border bg-white p-8 text-center shadow-soft-3">
            <p className={`${styles.ink} font-iw-display text-xl font-bold`}>
              {t("no_learner_title")}
            </p>
            <p className={`${styles.muted} mt-2 text-sm`}>{t("no_learner_body")}</p>
            <Link
              href="/onboarding/learner/new"
              className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-iw-primary px-7 text-base font-semibold text-white hover:bg-iw-primary-hover"
            >
              {t("no_learner_cta")}
            </Link>
          </div>
        ) : stage === "done" ? (
          <div
            className={`${styles.doneCard} w-[460px] max-w-full rounded-[28px] bg-white p-10 text-center`}
            style={{ boxShadow: "0 20px 50px rgba(60,40,110,0.14)" }}
          >
            <div
              className={`${styles.doneCheck} mx-auto mb-3.5 flex h-[78px] w-[78px] items-center justify-center rounded-full`}
            >
              <Check
                className="h-10 w-10 text-[var(--aivo-status-success)]"
                strokeWidth={2.4}
                aria-hidden="true"
              />
            </div>
            <h1 className={`${styles.ink} font-iw-display text-3xl font-bold`}>
              {t("done_title", { name })}
            </h1>
            <p className={`${styles.muted} mx-auto mb-2 mt-2 text-[15.5px] leading-relaxed`}>
              {t("done_subtitle", { name })}
            </p>
            <div
              className={`${styles.pinChip} my-4 inline-flex items-center gap-2.5 rounded-[14px] px-5 py-3`}
            >
              <span className={`${styles.muted} text-[13px] font-bold`}>
                {t("pin_label", { name })}
              </span>
              <span className={`${styles.pinChipValue} font-iw-display text-[22px] font-bold`}>
                {pin}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <Link
                href={NEXT_STEP(selectedLearnerId)}
                className="flex items-center justify-center gap-2.5 rounded-full bg-iw-primary p-4 font-iw-display text-lg font-semibold text-white hover:bg-iw-primary-hover"
              >
                {t("enter_stage")}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link
                href="/parent/home"
                className={`${styles.muted} p-2 text-sm font-bold hover:underline`}
              >
                {t("back_to_dashboard")}
              </Link>
            </div>
          </div>
        ) : (
          <div className="w-[420px] max-w-full text-center">
            <Image
              src="/images/mascots/cloud-coach.png"
              alt=""
              width={120}
              height={120}
              className={`${styles.bob} mx-auto mb-1.5 block h-auto w-[120px]`}
            />
            <h1 className={`${styles.ink} font-iw-display text-3xl font-bold`}>{title}</h1>
            <p className={`${styles.muted} mx-auto mb-6 max-w-[360px] text-[15px] leading-relaxed`}>
              {subtitle}
            </p>

            {needsLearner && learners && learners.length > 1 ? (
              <div className="mx-auto mb-5 flex max-w-[300px] flex-col gap-1.5 text-left">
                <label htmlFor="pin-learner" className={`${styles.ink} text-sm font-bold`}>
                  {t("select_learner_label")}
                </label>
                <select
                  id="pin-learner"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="h-12 rounded-iw-control border border-iw-border bg-white px-3 text-base outline-none focus:border-iw-primary"
                >
                  <option value="" disabled>
                    {t("select_learner_placeholder")}
                  </option>
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div
              className={cn(
                "mb-[18px] flex justify-center gap-3.5",
                err && stage === "create" && styles.shake,
              )}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={`${styles.dot} ${i < current.length ? styles.dotFilled : styles.dotEmpty}`}
                />
              ))}
            </div>
            <span className="sr-only" role="status">
              {t("digits_entered", { count: current.length })}
            </span>

            {err ? (
              <p
                role="alert"
                className="mb-4 text-[13.5px] font-bold text-[var(--aivo-status-error-strong)]"
              >
                {t("mismatch")}
              </p>
            ) : null}
            {saveError ? (
              <p
                role="alert"
                className="mb-4 text-[13.5px] font-bold text-[var(--aivo-status-error-strong)]"
              >
                {saveError}
              </p>
            ) : null}

            <div className="mx-auto mt-1.5 grid max-w-[300px] grid-cols-3 gap-3.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => press(n)}
                  disabled={submitting || needsLearner}
                  aria-label={n}
                  className={`${styles.key} flex h-16 items-center justify-center rounded-[18px] font-iw-display text-[26px] font-semibold disabled:opacity-50`}
                >
                  {n}
                </button>
              ))}
              <span aria-hidden="true" className="h-16" />
              <button
                type="button"
                onClick={() => press("0")}
                disabled={submitting || needsLearner}
                aria-label="0"
                className={`${styles.key} flex h-16 items-center justify-center rounded-[18px] font-iw-display text-[26px] font-semibold disabled:opacity-50`}
              >
                0
              </button>
              <button
                type="button"
                onClick={del}
                disabled={submitting}
                aria-label={t("delete")}
                className={`${styles.keyDel} flex h-16 items-center justify-center rounded-[18px] disabled:opacity-50`}
              >
                <Delete className={`${styles.muted} h-[26px] w-[26px]`} aria-hidden="true" />
              </button>
            </div>

            <p className="mt-7">
              <Link
                href={selectedLearnerId ? REVIEW_STEP(selectedLearnerId) : "/parent/learners"}
                className={`${styles.muted} text-xs hover:underline`}
              >
                {t("review_first")}
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
