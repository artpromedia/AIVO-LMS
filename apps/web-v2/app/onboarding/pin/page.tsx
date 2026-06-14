"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, AuthCard, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { useTranslations } from "next-intl";

/**
 * /onboarding/pin
 *
 * Age-appropriate learner PIN. 4 digits, big touch targets, no
 * keyboard-only assumption. The PIN is the learner's gate into their
 * own profile after a parent has set up the account and approved the cloned
 * AIVO brain — it is NOT a sign-in credential by itself; the device must
 * already be associated with a verified parent account.
 *
 * Slice 4 (gap #7): the step now persists. A PIN belongs to a specific
 * learner, so the page resolves a `learnerId` from the `?learnerId=` query
 * string and, when absent, gates behind learner selection (fetching the
 * parent's learners) — the same resolution pattern as the slice 3 IEP step.
 * On Save it POSTs the PIN to `/api/bff/learners/[learnerId]/pin`, which
 * dual-paths to identity-svc (the value the mobile `pin-login` flow verifies)
 * or the in-memory store in development fallback. Skipping is always allowed and simply
 * advances without setting a PIN.
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
  const router = useRouter();
  const search = useSearchParams();
  const queryLearnerId = search?.get("learnerId");

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
        // Auto-select when there's exactly one learner — the common funnel case.
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentLock" size={32} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        reassurance={
          <ReassuranceCard tone="safety" title={t("reassure_title")} body={t("reassure_body")} />
        }
        actions={
          noLearnersAvailable ? (
            <Link
              href="/onboarding/learner/new"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {t("no_learner_cta")}
            </Link>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="contents">
                <button
                  type="submit"
                  disabled={!canSave}
                  aria-disabled={!canSave}
                  className={`w-full h-12 rounded-iw-control text-white font-semibold flex items-center justify-center ${
                    canSave
                      ? "bg-[var(--aivo-sensory-primary)] hover:opacity-95"
                      : "bg-[var(--aivo-sensory-primary)]/50 cursor-not-allowed"
                  }`}
                >
                  {submitting ? t("saving") : t("save")}
                </button>
                {error ? (
                  <p role="alert" className="text-xs text-[var(--aivo-status-error)] text-center">
                    {error}
                  </p>
                ) : null}
              </form>
              <Link
                href={selectedLearnerId ? REVIEW_STEP(selectedLearnerId) : "/parent/learners"}
                className="text-xs text-iw-text-muted text-center hover:underline"
              >
                {t("review_first")}
              </Link>
            </>
          )
        }
      >
        {noLearnersAvailable ? (
          <div className="rounded-iw-card border border-iw-border p-5 text-center">
            <p className="text-sm font-semibold text-iw-text-strong">{t("no_learner_title")}</p>
            <p className="text-xs text-iw-text-muted mt-2">{t("no_learner_body")}</p>
          </div>
        ) : (
          <>
            {/* Learner picker only when the funnel arrives without a learnerId
                and the parent has more than one learner to choose from. */}
            {!queryLearnerId && learners && learners.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pin-learner" className="text-sm font-medium text-iw-text-strong">
                  {t("select_learner_label")}
                </label>
                <select
                  id="pin-learner"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="h-12 px-3 rounded-iw-control bg-white border border-iw-border text-base text-iw-text-strong focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20 outline-none"
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
            <PinRing label={t("choose_pin")} value={pin} onChange={setPin} />
            <PinRing
              label={t("confirm_pin")}
              value={confirm}
              onChange={setConfirm}
              error={mismatch ? t("mismatch") : undefined}
            />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}

function PinRing({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-iw-text-strong">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        aria-invalid={error ? true : undefined}
        className={`h-14 px-3 rounded-iw-control bg-white border text-center text-2xl font-bold tracking-[0.6em] tabular-nums outline-none transition-colors ${
          error
            ? "border-[var(--aivo-status-error)] focus:ring-2 focus:ring-[var(--aivo-status-error)]/30"
            : "border-iw-border focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20"
        }`}
      />
      {error ? (
        <p role="alert" className="text-xs text-[var(--aivo-status-error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
