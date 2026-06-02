"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

export default function WelcomePage() {
  const t = useTranslations("onboarding.welcome");
  const tc = useTranslations("onboarding.common");
  return (
    <AuthShell
      brand={
        <div className="flex flex-col gap-6 max-w-sm">
          <AivoIcon name="aiSparkle" size={48} />
          <h2 className="text-3xl font-semibold text-iw-text-strong leading-tight">
            {t("brand_title")}
          </h2>
          <p className="text-sm text-iw-text-muted leading-relaxed">{t("brand_body")}</p>
        </div>
      }
      footer={
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <span>{tc("copyright")}</span>
          <span className="flex gap-3">
            <Link href="/onboarding/terms" className="hover:underline">
              {tc("terms")}
            </Link>
            <Link href="/onboarding/privacy" className="hover:underline">
              {tc("privacy")}
            </Link>
          </span>
        </div>
      }
    >
      <AuthCard
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link
              href="/onboarding/signin"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95 transition-opacity"
            >
              {t("sign_in")}
            </Link>
            <Link
              href="/onboarding/signup"
              className="w-full h-12 rounded-iw-control bg-white border border-iw-border text-iw-text-strong font-semibold flex items-center justify-center hover:bg-[var(--aivo-color-surface-canvas)] transition-colors"
            >
              {t("create_account")}
            </Link>
            <p className="text-xs text-iw-text-muted text-center mt-1">
              {t("invite_lead")}{" "}
              <Link
                href="/onboarding/signup?via=invite"
                className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
              >
                {t("invite_link")}
              </Link>
            </p>
          </>
        }
      >
        <p className="text-sm text-iw-text-muted">{t("body")}</p>
      </AuthCard>
    </AuthShell>
  );
}
