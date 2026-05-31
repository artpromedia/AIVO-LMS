"use client";

import * as React from "react";
import Link from "next/link";
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

/**
 * Inclusive-Warm / Playful Calm signup surface. Rebuilt on the
 * @aivo/ui/auth primitives (AuthCard + AuthInput + ReassuranceCard) so
 * the field treatment, CTA, and reassurance copy match the other
 * onboarding screens. The submit is mocked locally — backend auth is
 * intentionally deferred until a real identity provider is wired.
 */
export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const canSubmit =
    name.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    password.length >= 8 &&
    !submitting;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    // Mock signup — backend wiring deferred. Send the operator to /login
    // so they can drop into any demo role.
    globalThis.setTimeout(() => {
      globalThis.location.assign("/login?signup=mock");
    }, 600);
  }

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
              <>
                <Button
                  type="submit"
                  form="signup-form"
                  size="lg"
                  disabled={!canSubmit}
                  className="w-full"
                >
                  {submitting ? t("submitting") : t("submit")}
                </Button>
              </>
            }
          >
            <form
              id="signup-form"
              onSubmit={onSubmit}
              className="flex flex-col gap-4"
              noValidate
            >
              <AuthInput
                id="name"
                label={t("name_label")}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Riley Parent"
                autoComplete="name"
                required
              />
              <AuthInput
                id="email"
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
