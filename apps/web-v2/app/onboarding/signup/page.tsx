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
              <Link
                href="/onboarding/role"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                {tc("continue")}
              </Link>
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
          {viaInvite ? (
            <AuthInput
              id="invite"
              label={t("invite_label")}
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="e.g. SCHOOL-7Q4M-2025"
              helper={t("invite_helper")}
              autoComplete="one-time-code"
            />
          ) : null}
          <AuthInput
            id="name"
            label={t("name_label")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First and last name"
            autoComplete="name"
          />
          <AuthInput
            id="email"
            label={tc("email")}
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <AuthInput
            id="password"
            label={tc("password")}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper={t("password_helper")}
            autoComplete="new-password"
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
