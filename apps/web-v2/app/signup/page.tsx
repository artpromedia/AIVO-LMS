"use client";

import * as React from "react";
import Link from "next/link";
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
              eyebrow="Start your family trial"
              title="A warmer way to learn — for every child in the family."
              subtitle="Set up learners in minutes. Adaptive AI tutors, sensory-friendly modes, and progress every parent can see."
            >
              <ul className="flex flex-col gap-3 text-sm text-iw-ink">
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)]"
                  >
                    <AivoIcon name="aiSparkle" size={16} />
                  </span>
                  <span>Adaptive AI tutors that meet every learner where they are.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-aivoTeal-100)] text-[var(--aivo-aivoTeal-700)]"
                  >
                    <AivoIcon name="safetyOk" size={16} />
                  </span>
                  <span>Sensory-friendly modes: Standard, Calm, High Contrast.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)]"
                  >
                    <AivoIcon name="curriculum" size={16} />
                  </span>
                  <span>Progress every parent can see — IEP-aware and quietly honest.</span>
                </li>
              </ul>
            </AuthCard>
            <ReassuranceCard
              tone="safety"
              title="Adults set up accounts, not children."
              body="You'll add learners on the next step. AIVO never asks a child to create their own account, and COPPA / FERPA / SOC 2 protections apply to everything from day one."
            />
          </aside>

          <AuthCard
            icon={<AivoIcon name="aiSparkle" size={32} />}
            eyebrow="Create your account"
            title="Tell us a little about you"
            subtitle={
              <>
                Already have one?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                >
                  Sign in
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
                  {submitting ? "Creating your account…" : "Create account"}
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
                label="Your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Riley Parent"
                autoComplete="name"
                required
              />
              <AuthInput
                id="email"
                label="Email"
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
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                helper="At least 8 characters with a number and a symbol."
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
