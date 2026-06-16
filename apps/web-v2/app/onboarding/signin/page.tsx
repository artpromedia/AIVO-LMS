"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { onboardingSignInAction } from "@/lib/auth/auth-actions";

// Recognised `?error=` codes; anything else falls back to the generic
// failure message.
const SIGNIN_ERROR_CODES = new Set([
  "missing_credentials",
  "invalid_credentials",
  "wrong_surface",
  "unsupported_role",
  "login_failed",
  "service_unavailable",
]);

export default function SignInPage() {
  const t = useTranslations("onboarding.signin");
  const tc = useTranslations("onboarding.common");
  const search = useSearchParams();
  const errorCode = search?.get("error");
  const errorMessage = errorCode
    ? t(`errors.${SIGNIN_ERROR_CODES.has(errorCode) ? errorCode : "login_failed"}`)
    : null;
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);

  return (
    <AuthShell
      footer={
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/onboarding/terms" className="hover:underline">
            {tc("terms")}
          </Link>
          <Link href="/onboarding/privacy" className="hover:underline">
            {tc("privacy")}
          </Link>
          <Link href="/onboarding/recovery" className="hover:underline">
            {t("trouble")}
          </Link>
        </div>
      }
    >
      <AuthCard
        icon={<AivoIcon name="aiSparkle" size={32} />}
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
            <Button type="submit" form="onboarding-signin-form" size="lg" className="w-full">
              {t("submit")}
            </Button>
            <div className="flex justify-between text-sm">
              <Link href="/onboarding/recovery" className="text-iw-text-muted hover:underline">
                {t("forgot")}
              </Link>
              <Link
                href="/onboarding/signup"
                className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
              >
                {t("create_account")}
              </Link>
            </div>
          </>
        }
      >
        {errorMessage ? (
          <div className="mb-3">
            <Banner tone="danger" description={errorMessage} />
          </div>
        ) : null}
        <form id="onboarding-signin-form" action={onboardingSignInAction} noValidate>
          <input type="hidden" name="errorReturn" value="/onboarding/signin" />
          <div className="flex flex-col gap-4">
            <AuthInput
              id="email"
              name="email"
              label={tc("email")}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <AuthInput
              id="password"
              name="password"
              label={tc("password")}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-xs font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                  aria-label={showPw ? tc("hide_password") : tc("show_password")}
                >
                  {showPw ? tc("hide") : tc("show")}
                </button>
              }
            />
          </div>
        </form>
      </AuthCard>
    </AuthShell>
  );
}

