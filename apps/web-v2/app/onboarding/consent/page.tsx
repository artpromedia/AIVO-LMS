"use client";
import * as React from "react";
import Link from "next/link";
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
  const [parentConsent, setParentConsent] = React.useState(true);
  const [schoolShare, setSchoolShare] = React.useState(false);
  const [aiPersonalize, setAiPersonalize] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader
          steps={STEPS.map((s) => ({ label: ts(s.label) }))}
          current={3}
        />
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
            <>
              <Link
                href="/onboarding/permissions"
                aria-disabled={!parentConsent}
                className={`w-full h-12 rounded-iw-control text-white font-semibold flex items-center justify-center ${
                  parentConsent
                    ? "bg-[var(--aivo-sensory-primary)] hover:opacity-95"
                    : "bg-[var(--aivo-sensory-primary)]/50 pointer-events-none"
                }`}
              >
                {tc("continue")}
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                {t("footer_note")}
              </p>
            </>
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
