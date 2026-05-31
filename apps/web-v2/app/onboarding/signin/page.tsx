"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const t = useTranslations("onboarding.signin");
  const tc = useTranslations("onboarding.common");
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
            <Button type="submit" size="lg" className="w-full">
              {t("submit")}
            </Button>
            <div className="flex justify-between text-sm">
              <Link
                href="/onboarding/recovery"
                className="text-iw-text-muted hover:underline"
              >
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
        <AuthInput
          id="email"
          label={tc("email")}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <AuthInput
          id="password"
          label={tc("password")}
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
      </AuthCard>
    </AuthShell>
  );
}
