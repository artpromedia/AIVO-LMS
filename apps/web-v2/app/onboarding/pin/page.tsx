"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AuthSplitLayout,
  AuthSidePanel,
  AuthTrustCard,
  AuthSecureFooter,
} from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";
import { PinPad } from "@/components/auth/pin-pad";

/**
 * /onboarding/pin — design #2 "Set {name}'s PIN".
 *
 * Age-appropriate learner PIN: a 2-step create → confirm flow on the calm
 * PIN keypad. The PIN is the learner's gate into their own profile after a
 * parent sets up the account and approves the cloned AIVO brain — it is NOT a
 * sign-in credential by itself; the device must already be associated with a
 * verified parent account.
 *
 * The step resolves a `learnerId` from the `?learnerId=` query string and,
 * when absent, gates behind learner selection (fetching the parent's learners).
 * On Save it POSTs the PIN to `/api/bff/learners/[learnerId]/pin`, which
 * dual-paths to identity-svc or the in-memory dev store.
 */

type LearnerOption = { id: string; firstName: string };

const NEXT_STEP = (learnerId: string) => `/learner/select/auto?learnerId=${encodeURIComponent(learnerId)}`;
const REVIEW_STEP = (learnerId: string) => `/parent/learners/${encodeURIComponent(learnerId)}/brain-clone-watch`;

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
  const tShell = useTranslations("auth.shell");
  const router = useRouter();
  const search = useSearchParams();
  const queryLearnerId = search?.get("learnerId");

  const [step, setStep] = React.useState<"create" | "confirm">("create");
  const [pin, setPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [learners, setLearners] = React.useState<LearnerOption[] | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = React.useState<string>(queryLearnerId ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const mismatch = confirm.length === 4 && confirm !== pin;
  const pinReady = pin.length === 4 && confirm === pin;

  // Resolve which learner this PIN belongs to. A query param wins; otherwise
  // fetch the parent's learners so the step can gate behind a selection rather
  // than silently dropping the PIN when no learner is in scope.
  React.useEffect(() => {
    if (queryLearnerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bff/learners");
        const json = (await res.json()) as {
          ok?: boolean;
          data?: { learners?: LearnerOption[] };
        };
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
  const canSave = pinReady && !needsLearner && !submitting;

  const selectedName =
    learners?.find((l) => l.id === selectedLearnerId)?.firstName ?? null;
  const title = selectedName ? t("set_title", { name: selectedName }) : t("title");
  const subtitle = selectedName ? t("set_subtitle", { name: selectedName }) : t("subtitle");

  async function handleSave() {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await postPin(selectedLearnerId, pin);
      if (result.blockedForApproval) {
        setError(t("approval_required"));
        setSubmitting(false);
        return;
      }
      router.push(NEXT_STEP(selectedLearnerId));
    } catch {
      setError(t("save_error"));
      setSubmitting(false);
    }
  }

  const panel = (
    <AuthSidePanel
      variant="shield"
      title={selectedName ? t("approved_title") : t("reassure_title")}
      body={selectedName ? t("approved_body", { name: selectedName }) : t("reassure_body")}
    >
      <AuthTrustCard>{tShell("trust_secure")}</AuthTrustCard>
    </AuthSidePanel>
  );

  return (
    <AuthSplitLayout panel={panel}>
      <div className="mb-8 flex justify-center">
        <AivoBrandMark sublabel={tShell("wordmark_family")} />
      </div>

      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-iw-primary">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 font-iw-display text-2xl font-bold text-iw-ink sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-iw-ink-muted">{subtitle}</p>
      </div>

      <div className="mt-8">
        {noLearnersAvailable ? (
          <div className="rounded-iw-card border border-iw-border bg-white p-6 text-center">
            <p className="text-sm font-semibold text-iw-ink">{t("no_learner_title")}</p>
            <p className="mt-2 text-xs text-iw-ink-muted">{t("no_learner_body")}</p>
            <Link
              href="/onboarding/learner/new"
              className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-iw-control bg-iw-primary px-7 text-base font-semibold text-iw-primary-fg shadow-soft-3 transition hover:-translate-y-0.5 hover:bg-iw-primary-hover"
            >
              {t("no_learner_cta")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Learner picker only when the funnel arrives without a learnerId
                and the parent has more than one learner to choose from. */}
            {!queryLearnerId && learners && learners.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pin-learner" className="text-sm font-medium text-iw-ink">
                  {t("select_learner_label")}
                </label>
                <select
                  id="pin-learner"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="h-12 rounded-iw-control border border-iw-border bg-white px-3 text-base text-iw-ink outline-none focus:border-iw-primary focus:ring-2 focus:ring-iw-ring/30"
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

            <div className="flex items-center justify-center gap-2 text-xs font-semibold">
              <span className={step === "create" ? "text-iw-primary" : "text-iw-ink-muted"}>
                {t("step_create")}
              </span>
              <span className="text-iw-border">·</span>
              <span className={step === "confirm" ? "text-iw-primary" : "text-iw-ink-muted"}>
                {t("step_confirm")}
              </span>
            </div>

            {step === "create" ? (
              <>
                <p className="text-center text-sm text-iw-ink-muted">{t("enter_4")}</p>
                <PinPad
                  value={pin}
                  onChange={(v) => setPin(v.slice(0, 4))}
                  length={4}
                  clearLabel={t("step_create")}
                />
                <button
                  type="button"
                  disabled={pin.length !== 4 || needsLearner}
                  onClick={() => {
                    setConfirm("");
                    setStep("confirm");
                  }}
                  className={[
                    "inline-flex min-h-[52px] w-full items-center justify-center rounded-iw-control px-7 text-base font-semibold text-iw-primary-fg transition",
                    pin.length === 4 && !needsLearner
                      ? "bg-iw-primary shadow-soft-3 hover:-translate-y-0.5 hover:bg-iw-primary-hover"
                      : "cursor-not-allowed bg-iw-primary/40",
                  ].join(" ")}
                >
                  {t("step_confirm")}
                </button>
              </>
            ) : (
              <>
                <p className="text-center text-sm text-iw-ink-muted">{t("reenter_4")}</p>
                <PinPad value={confirm} onChange={(v) => setConfirm(v.slice(0, 4))} length={4} />
                {mismatch ? (
                  <p role="alert" className="text-center text-xs font-semibold text-iw-error-strong">
                    {t("mismatch")}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={handleSave}
                  className={[
                    "inline-flex min-h-[52px] w-full items-center justify-center rounded-iw-control px-7 text-base font-semibold text-iw-primary-fg transition",
                    canSave
                      ? "bg-iw-primary shadow-soft-3 hover:-translate-y-0.5 hover:bg-iw-primary-hover"
                      : "cursor-not-allowed bg-iw-primary/40",
                  ].join(" ")}
                >
                  {submitting ? t("saving") : t("save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirm("");
                    setStep("create");
                  }}
                  className="text-center text-sm font-semibold text-iw-primary hover:underline"
                >
                  {t("back")}
                </button>
              </>
            )}

            {error ? (
              <p role="alert" className="text-center text-xs font-semibold text-iw-error-strong">
                {error}
              </p>
            ) : null}

            <Link
              href={selectedLearnerId ? REVIEW_STEP(selectedLearnerId) : "/parent/learners"}
              className="text-center text-xs text-iw-ink-muted hover:underline"
            >
              {t("review_first")}
            </Link>
          </div>
        )}
      </div>

      <AuthSecureFooter lead={tShell("secure_signin")} sub={tShell("encrypted")} />
    </AuthSplitLayout>
  );
}
