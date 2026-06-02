"use client";
import * as React from "react";
import Link from "next/link";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard, StepperHeader } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { useTranslations } from "next-intl";

const STEPS = [
  { label: "about_you" },
  { label: "role" },
  { label: "family" },
  { label: "consent" },
] as const;

export default function ParentSetupPage() {
  const t = useTranslations("onboarding.parent_setup");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const [household, setHousehold] = React.useState("");
  const [coParentEmail, setCoParentEmail] = React.useState("");

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS.map((s) => ({ label: ts(s.label) }))} current={2} />
        <AuthCard
          icon={<AivoIcon name="care" size={32} />}
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
              <Link
                href="/onboarding/learner/new"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                {t("continue")}
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
            id="household"
            label={t("household_label")}
            value={household}
            onChange={(e) => setHousehold(e.target.value)}
            placeholder={t("household_placeholder")}
            helper={t("household_helper")}
          />
          <AuthInput
            id="coparent"
            label={t("coparent_label")}
            type="email"
            inputMode="email"
            value={coParentEmail}
            onChange={(e) => setCoParentEmail(e.target.value)}
            placeholder="coparent@example.com"
            helper={t("coparent_helper")}
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
