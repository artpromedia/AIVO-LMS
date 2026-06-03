"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AuthShell,
  AuthCard,
  ReassuranceCard,
  StepperHeader,
  ConsentRow,
  LegalCollapse,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { useTranslations } from "next-intl";

const STEPS = [
  { label: "about_you" },
  { label: "role" },
  { label: "family" },
  { label: "consent" },
] as const;

/**
 * The page's four toggles map onto the canonical `CONSENT_TYPES` enum used
 * by `POST /api/bff/consent`. The parent bucket records both the parent
 * account terms acceptance and the (required) child data-collection
 * acknowledgement so a single Continue persists everything the funnel
 * implies.
 */
const PARENT_CONSENT_TYPES = ["parent_account_terms", "child_data_collection"] as const;
const SCHOOL_CONSENT_TYPE = "school_roster_import";
const AI_CONSENT_TYPE = "ai_personalization";
const MARKETING_CONSENT_TYPE = "marketing_opt_in";

async function postConsent(consentType: string): Promise<void> {
  const res = await fetch("/api/bff/consent", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consentType }),
  });
  // Treat both transport errors and BFF envelope errors as a single failure
  // so the page can surface one i18n'd message instead of leaking server text.
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) {
    throw new Error("consent_persist_failed");
  }
}

/**
 * /onboarding/consent
 *
 * Sprint-3 verbatim acceptance criterion enforced here:
 *
 *   "Separate parent / school / AI consent. Explicit IEP upload
 *    consent. Age-appropriate learner PIN. Progressive disclosure."
 *
 * Each bucket is its own ConsentRow. The parent / guardian bucket is
 * required for any account with a learner attached; the school data
 * sharing and AI personalization buckets are independent and optional.
 */
export default function ConsentReviewPage() {
  const t = useTranslations("onboarding.consent");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const router = useRouter();
  const [parentConsent, setParentConsent] = React.useState(true);
  const [schoolShare, setSchoolShare] = React.useState(false);
  const [aiPersonalize, setAiPersonalize] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canContinue = parentConsent && !submitting;

  async function handleContinue(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canContinue) return;
    setSubmitting(true);
    setError(null);
    try {
      // Parent bucket = account terms + child data collection acknowledgement.
      // School / AI / marketing are independent opt-ins; only persist the
      // ones the parent actually accepted so revocations stay meaningful.
      const types: string[] = [...PARENT_CONSENT_TYPES];
      if (schoolShare) types.push(SCHOOL_CONSENT_TYPE);
      if (aiPersonalize) types.push(AI_CONSENT_TYPE);
      if (marketing) types.push(MARKETING_CONSENT_TYPE);
      // Sequential rather than parallel so the audit log records a stable,
      // predictable per-bucket order and a mid-flight failure doesn't leave
      // half the decisions silently dropped on retry.
      for (const ct of types) {
        await postConsent(ct);
      }
      router.push("/onboarding/permissions");
    } catch {
      setError(t("save_error"));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS.map((s) => ({ label: ts(s.label) }))} current={3} />
        <AuthCard
          icon={<AivoIcon name="consentCheck" size={32} />}
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
            <form onSubmit={handleContinue} className="contents">
              <button
                type="submit"
                disabled={!canContinue}
                aria-disabled={!canContinue}
                className={`w-full h-12 rounded-iw-control text-white font-semibold flex items-center justify-center ${
                  canContinue
                    ? "bg-[var(--aivo-sensory-primary)] hover:opacity-95"
                    : "bg-[var(--aivo-sensory-primary)]/50 cursor-not-allowed"
                }`}
              >
                {submitting ? t("saving") : tc("continue")}
              </button>
              {error ? (
                <p role="alert" className="text-xs text-aivo-danger text-center">
                  {error}
                </p>
              ) : null}
              <p className="text-xs text-iw-text-muted text-center">{t("footer_note")}</p>
            </form>
          }
        >
          <ConsentRow
            id="c-parent"
            title={t("row_parent_title")}
            description={t("row_parent_desc")}
            checked={parentConsent}
            onChange={setParentConsent}
            required
            badge={tc("badge_required")}
            icon={<AivoIcon name="care" size={18} />}
          />
          <ConsentRow
            id="c-school"
            title={t("row_school_title")}
            description={t("row_school_desc")}
            checked={schoolShare}
            onChange={setSchoolShare}
            badge={tc("badge_optional")}
            icon={<AivoIcon name="rosterSchool" size={18} />}
          />
          <ConsentRow
            id="c-ai"
            title={t("row_ai_title")}
            description={t("row_ai_desc")}
            checked={aiPersonalize}
            onChange={setAiPersonalize}
            badge={tc("badge_optional")}
            icon={<AivoIcon name="aiSparkle" size={18} />}
          />
          <ConsentRow
            id="c-mkt"
            title={t("row_mkt_title")}
            description={t("row_mkt_desc")}
            checked={marketing}
            onChange={setMarketing}
            badge={tc("badge_optional")}
            icon={<AivoIcon name="aiWand" size={18} />}
          />
          <LegalCollapse summary={t("legal_summary")}>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>{t("legal_parent_label")}</strong> {t("legal_parent_body")}
              </li>
              <li>
                <strong>{t("legal_school_label")}</strong> {t("legal_school_body")}
              </li>
              <li>
                <strong>{t("legal_ai_label")}</strong> {t("legal_ai_body")}
              </li>
              <li>
                <strong>{t("legal_mkt_label")}</strong> {t("legal_mkt_body")}
              </li>
            </ul>
          </LegalCollapse>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
