"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AuthShell,
  AuthCard,
  AuthInput,
  ReassuranceCard,
  StepperHeader,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

export default function SchoolInvitePage() {
  const t = useTranslations("onboarding.invite_school");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const STEPS = [
    { label: ts("about_you") },
    { label: ts("role") },
    { label: ts("join_school") },
    { label: ts("consent") },
  ] as const;
  const [code, setCode] = React.useState("");
  const [schoolEmail, setSchoolEmail] = React.useState("");
  // Error states demonstrated via a controlled flag — real impl will
  // hit the invite service.
  const [error] = React.useState<string | null>(null);

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={2} />
        <AuthCard
          icon={<AivoIcon name="rosterSchool" size={32} />}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
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
                href="/onboarding/consent"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                {t("join")}
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/role" className="hover:underline">
                  {tc("back")}
                </Link>
              </p>
            </>
          }
        >
          <AuthInput
            id="code"
            label={t("code_label")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. SCHOOL-7Q4M-2025"
            autoComplete="one-time-code"
            error={error ?? undefined}
          />
          <AuthInput
            id="school-email"
            label={t("email_label")}
            type="email"
            inputMode="email"
            value={schoolEmail}
            onChange={(e) => setSchoolEmail(e.target.value)}
            placeholder="you@yourschool.edu"
            helper={t("email_helper")}
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
