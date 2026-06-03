"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard, StepperHeader } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { useTranslations } from "next-intl";

const STEPS = [
  { label: "about_you" },
  { label: "role" },
  { label: "family" },
  { label: "consent" },
] as const;

const NEXT_STEP = "/onboarding/learner/new";

/**
 * /onboarding/parent-setup
 *
 * Slice 4 (gap #7): the step now persists. The household name and optional
 * co-parent email used to be dropped on `<Link>` navigation; Continue now POSTs
 * them to `/api/bff/onboarding/household`, which saves the name and records a
 * household-scoped co-parent invite (emailed via comms-svc when wired). Both
 * fields are optional, so an empty form still advances — it just has nothing to
 * persist. A persistence failure surfaces inline without navigating.
 */

async function saveHousehold(name: string, coParentEmail: string): Promise<void> {
  const res = await fetch("/api/bff/onboarding/household", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: name.trim() || undefined,
      coParentEmail: coParentEmail.trim() || undefined,
    }),
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) throw new Error("household_persist_failed");
}

export default function ParentSetupPage() {
  const t = useTranslations("onboarding.parent_setup");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const router = useRouter();
  const [household, setHousehold] = React.useState("");
  const [coParentEmail, setCoParentEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await saveHousehold(household, coParentEmail);
      router.push(NEXT_STEP);
    } catch {
      setError(coParentEmail.trim() ? t("coparent_invite_error") : t("save_error"));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS.map((s) => ({ label: ts(s.label) }))} current={2} />
        <AuthCard
          icon={<AivoIcon name="care" size={32} />}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          reassurance={
            <ReassuranceCard
              tone="privacy"
              title={t("reassure_title")}
              body={t("reassure_body")}
              link={{ href: "/onboarding/privacy", label: t("reassure_link") }}
            />
          }
          actions={
            <form onSubmit={handleSubmit} className="contents">
              <button
                type="submit"
                disabled={submitting}
                aria-disabled={submitting}
                className={`w-full h-12 rounded-iw-control text-white font-semibold flex items-center justify-center ${
                  submitting
                    ? "bg-[var(--aivo-sensory-primary)]/50 cursor-not-allowed"
                    : "bg-[var(--aivo-sensory-primary)] hover:opacity-95"
                }`}
              >
                {submitting ? t("saving") : t("continue")}
              </button>
              {error ? (
                <p role="alert" className="text-xs text-[var(--aivo-status-error)] text-center">
                  {error}
                </p>
              ) : null}
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/role" className="hover:underline">
                  {tc("back")}
                </Link>
              </p>
            </form>
          }
        >
          <AuthInput
            id="household"
            label={t("household_label")}
            value={household}
            onChange={(e) => setHousehold(e.target.value)}
            placeholder={t("household_placeholder")}
            helper={t("household_helper")}
          />
          <AuthInput
            id="coparent"
            label={t("coparent_label")}
            type="email"
            inputMode="email"
            value={coParentEmail}
            onChange={(e) => setCoParentEmail(e.target.value)}
            placeholder="coparent@example.com"
            helper={t("coparent_helper")}
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
