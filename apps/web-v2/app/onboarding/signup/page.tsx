"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AuthShell,
  AuthCard,
  AuthInput,
  ReassuranceCard,
  StepperHeader,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { registerAction } from "@/lib/auth/auth-actions";

// Failure copy keyed by the `?error=` code the register action redirects
// with. English-only for now; folded into the onboarding catalog on the
// next i18n pass.
const SIGNUP_ERRORS: Record<string, string> = {
  invalid_input:
    "Please enter your name, a valid email, and a password of at least 8 characters.",
  email_taken: "That email is already registered. Try signing in instead.",
  weak_password:
    "That password doesn't meet our security policy. Use at least 8 characters with a number and a symbol.",
  service_unavailable:
    "We couldn't reach our sign-up service. Please try again in a moment.",
  unsupported_role: "This account type can't be created here.",
  signup_failed: "We couldn't create your account. Please try again.",
};

export default function SignUpPage() {
  const t = useTranslations("onboarding.signup");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const STEPS = [
    { label: ts("about_you") },
    { label: ts("role") },
    { label: ts("consent") },
  ] as const;
  const search = useSearchParams();
  const viaInvite = search.get("via") === "invite";
  const errorCode = search.get("error");
  const errorMessage = errorCode
    ? SIGNUP_ERRORS[errorCode] ?? SIGNUP_ERRORS.signup_failed
    : null;
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [invite, setInvite] = React.useState("");

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
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={0} />
        <AuthCard
          icon={<AivoIcon name="aiSparkle" size={32} />}
          eyebrow={t("eyebrow")}
          title={viaInvite ? t("title_invite") : t("title_default")}
          subtitle={viaInvite ? t("subtitle_invite") : t("subtitle_default")}
          reassurance={
            <ReassuranceCard
              tone="safety"
              title={t("reassure_title")}
              body={t("reassure_body")}
            />
          }
          actions={
            <>
              {viaInvite ? (
                // Invite acceptance has its own credential flow on
                // /accept-invite; the wizard just forwards there.
                <Link
                  href="/onboarding/role"
                  className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
                >
                  {tc("continue")}
                </Link>
              ) : (
                <Button
                  type="submit"
                  form="onboarding-signup-form"
                  size="lg"
                  className="w-full"
                >
                  {tc("continue")}
                </Button>
              )}
              <p className="text-xs text-iw-text-muted text-center">
                {t("already_have")}{" "}
                <Link
                  href="/onboarding/signin"
                  className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                >
                  {t("sign_in")}
                </Link>
              </p>
            </>
          }
        >
          {errorMessage ? (
            <div className="mb-3">
              <Banner tone="danger" description={errorMessage} />
            </div>
          ) : null}
          <form id="onboarding-signup-form" action={registerAction} noValidate>
            <input type="hidden" name="next" value="/onboarding/parent-setup" />
            <input type="hidden" name="errorReturn" value="/onboarding/signup" />
            <div className="flex flex-col gap-4">
              {viaInvite ? (
                <AuthInput
                  id="invite"
                  name="invite"
                  label={t("invite_label")}
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder={t("code_placeholder")}
                  helper={t("invite_helper")}
                  autoComplete="one-time-code"
                />
              ) : null}
              <AuthInput
                id="name"
                name="name"
                label={t("name_label")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("name_placeholder")}
                autoComplete="name"
                required
              />
              <AuthInput
                id="email"
                name="email"
                label={tc("email")}
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <AuthInput
                id="password"
                name="password"
                label={tc("password")}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helper={t("password_helper")}
                autoComplete="new-password"
                required
              />
            </div>
          </form>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
