"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard, StepperHeader } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { joinOrganizationAction } from "../actions";

export default function DistrictInvitePage() {
  const t = useTranslations("onboarding.invite_district");
  const tc = useTranslations("onboarding.common");
  const ts = useTranslations("onboarding.steps");
  const router = useRouter();
  const STEPS = [
    { label: ts("about_you") },
    { label: ts("role") },
    { label: ts("join_district") },
    { label: ts("consent") },
  ] as const;
  const [code, setCode] = React.useState("");
  const [adminEmail, setAdminEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinOrganizationAction({ code, email: adminEmail });
      if (result.ok) {
        router.push(result.redirectTo);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={2} />
        <AuthCard
          icon={<AivoIcon name="rosterDistrict" size={32} />}
          eyebrow={t("eyebrow")}
          title={t("title")}
          subtitle={t("subtitle")}
          reassurance={
            <ReassuranceCard tone="safety" title={t("reassure_title")} body={t("reassure_body")} />
          }
          actions={
            <>
              <button
                type="button"
                onClick={handleJoin}
                disabled={pending}
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95 disabled:opacity-60"
              >
                {tc("continue")}
              </button>
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/role" className="hover:underline">
                  {tc("back")}
                </Link>
              </p>
            </>
          }
        >
          <AuthInput
            id="dcode"
            label={t("code_label")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("code_placeholder")}
            autoComplete="one-time-code"
            error={error ?? undefined}
          />
          <AuthInput
            id="admin-email"
            label={t("email_label")}
            type="email"
            inputMode="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="you@yourdistrict.org"
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
