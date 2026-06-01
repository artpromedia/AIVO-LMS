"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AuthCard,
  AuthInput,
  ReassuranceCard,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { registerAction } from "@/lib/auth/auth-actions";

/**
 * Inclusive-Warm / Playful Calm signup surface. Rebuilt on the
 * @aivo/ui/auth primitives (AuthCard + AuthInput + ReassuranceCard).
 *
 * The form posts to the `registerAction` server action, which creates a
 * real PARENT account via identity-svc and establishes the session before
 * handing off to onboarding. Under AUTH_MODE=mock (dev default) the action
 * keeps the legacy behavior of dropping into the demo login.
 */

// Failure copy keyed by the `?error=` code the server action redirects
// with. English-only for now; these move into the auth.signup catalog
// when the auth surfaces get their next i18n pass.
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

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const search = useSearchParams();
  const errorCode = search.get("error");
  const errorMessage = errorCode
    ? SIGNUP_ERRORS[errorCode] ?? SIGNUP_ERRORS.signup_failed
    : null;

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const canSubmit =
    name.trim().length > 1 && /.+@.+\..+/.test(email) && password.length >= 8;

  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16 lg:py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <aside className="flex flex-col gap-5">
            <AuthCard
              icon={<AivoIcon name="aiSparkle" size={32} />}
              eyebrow={t("promo_eyebrow")}
              title={t("promo_title")}
              subtitle={t("promo_subtitle")}
            >
              <ul className="flex flex-col gap-3 text-sm text-iw-ink">
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)]"
                  >
                    <AivoIcon name="aiSparkle" size={16} />
                  </span>
                  <span>{t("benefit_tutors")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-aivoTeal-100)] text-[var(--aivo-aivoTeal-700)]"
                  >
                    <AivoIcon name="safetyOk" size={16} />
                  </span>
                  <span>{t("benefit_sensory")}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)]"
                  >
                    <AivoIcon name="curriculum" size={16} />
                  </span>
                  <span>{t("benefit_progress")}</span>
                </li>
              </ul>
            </AuthCard>
            <ReassuranceCard
              tone="safety"
              title={t("reassurance_title")}
              body={t("reassurance_body")}
            />
          </aside>

          <AuthCard
            icon={<AivoIcon name="aiSparkle" size={32} />}
            eyebrow={t("card_eyebrow")}
            title={t("card_title")}
            subtitle={
              <>
                {t("already_have")}{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                >
                  {t("sign_in")}
                </Link>
                .
              </>
            }
            actions={
              <Button
                type="submit"
                form="signup-form"
                size="lg"
                disabled={!canSubmit}
                className="w-full"
              >
                {t("submit")}
              </Button>
            }
          >
            {errorMessage ? (
              <div className="mb-3">
                <Banner tone="danger" description={errorMessage} />
              </div>
            ) : null}
            <form
              id="signup-form"
              action={registerAction}
              className="flex flex-col gap-4"
              noValidate
            >
              <input type="hidden" name="next" value="/onboarding/parent-setup" />
              <input type="hidden" name="errorReturn" value="/signup" />
              <AuthInput
                id="name"
                name="name"
                label={t("name_label")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("name_placeholder")}
                autoComplete="name"
                required
              />
              <AuthInput
                id="email"
                name="email"
                label={t("email_label")}
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              <AuthInput
                id="password"
                name="password"
                label={t("password_label")}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                helper={t("password_helper")}
                autoComplete="new-password"
                required
              />
            </form>
          </AuthCard>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
