"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";

export default function RecoveryPage() {
  const t = useTranslations("onboarding.recovery");
  const tc = useTranslations("onboarding.common");
  const [email, setEmail] = React.useState("");

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentLock" size={32} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        reassurance={
          <ReassuranceCard tone="info" title={t("reassure_title")} body={t("reassure_body")} />
        }
        actions={
          <>
            <Button type="button" size="lg" className="w-full">
              {t("submit")}
            </Button>
            <p className="text-xs text-iw-text-muted text-center">
              <Link href="/onboarding/signin" className="hover:underline">
                {t("back_to_sign_in")}
              </Link>
            </p>
          </>
        }
      >
        <AuthInput
          id="rec-email"
          label={tc("email")}
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </AuthCard>
    </AuthShell>
  );
}
