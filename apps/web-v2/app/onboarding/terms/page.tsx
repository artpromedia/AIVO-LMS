"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, LegalCollapse } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

export default function TermsPage() {
  const t = useTranslations("onboarding.terms");
  const tc = useTranslations("onboarding.common");
  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentDoc" size={32} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link
            href="/onboarding/consent"
            className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
          >
            {tc("back_to_consent")}
          </Link>
        }
      >
        <LegalCollapse summary={t("agree_summary")} defaultOpen>
          <p>{t("agree_body")}</p>
        </LegalCollapse>
        <LegalCollapse summary={t("aivo_summary")}>
          <p>{t("aivo_body")}</p>
        </LegalCollapse>
        <LegalCollapse summary={t("children_summary")}>
          <p>{t("children_body")}</p>
        </LegalCollapse>
        <LegalCollapse summary={t("wrong_summary")}>
          <p>{t("wrong_body")}</p>
        </LegalCollapse>
      </AuthCard>
    </AuthShell>
  );
}
