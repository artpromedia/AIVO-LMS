"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, LegalCollapse, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/privacy
 *
 * Privacy explanation page — the "what does AIVO actually do with my
 * data?" summary that the consent screen links to. Uses progressive
 * disclosure (LegalCollapse) so the dense legal text is one click
 * away, not the default reading experience.
 */
export default function PrivacyExplanationPage() {
  const t = useTranslations("onboarding.privacy");
  const tc = useTranslations("onboarding.common");
  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentDoc" size={32} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        reassurance={
          <ReassuranceCard tone="privacy" title={t("reassure_title")} body={t("reassure_body")} />
        }
        actions={
          <Link
            href="/onboarding/consent"
            className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
          >
            {tc("back_to_consent")}
          </Link>
        }
      >
        <LegalCollapse summary={t("collect_summary")} defaultOpen>
          <ul className="list-disc list-inside space-y-1">
            <li>{t("collect_account")}</li>
            <li>{t("collect_learner")}</li>
            <li>{t("collect_device")}</li>
          </ul>
        </LegalCollapse>
        <LegalCollapse summary={t("ai_summary")}>
          <p>{t("ai_body")}</p>
        </LegalCollapse>
        <LegalCollapse summary={t("who_summary")}>
          <ul className="list-disc list-inside space-y-1">
            <li>{t("who_you")}</li>
            <li>{t("who_teachers")}</li>
            <li>{t("who_staff")}</li>
            <li>{t("who_advertisers")}</li>
          </ul>
        </LegalCollapse>
        <LegalCollapse summary={t("rights_summary")}>
          <p>{t("rights_body")}</p>
        </LegalCollapse>
      </AuthCard>
    </AuthShell>
  );
}
