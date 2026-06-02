"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";

/**
 * /onboarding/parent-verify
 *
 * Verifies the adult on the account before learners can be added or
 * the family can leave first-run. We ask for the parent's phone (SMS
 * code) because email already verified — this is a step-up, not a
 * duplicate check.
 */
export default function ParentVerifyPage() {
  const t = useTranslations("onboarding.parent_verify");
  const tc = useTranslations("onboarding.common");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [stage, setStage] = React.useState<"phone" | "code">("phone");

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="safetyOk" size={32} />}
        eyebrow={t("eyebrow")}
        title={stage === "phone" ? t("title_phone") : t("title_code")}
        subtitle={stage === "phone" ? t("subtitle_phone") : t("subtitle_code")}
        reassurance={
          <ReassuranceCard tone="safety" title={t("reassure_title")} body={t("reassure_body")} />
        }
        actions={
          <>
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={() => setStage(stage === "phone" ? "code" : "phone")}
            >
              {stage === "phone" ? t("send_code") : t("verify_continue")}
            </Button>
            {stage === "code" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStage("phone")}
                className="text-xs text-iw-text-muted hover:underline"
              >
                {t("use_diff_phone")}
              </Button>
            ) : (
              <Link
                href="/onboarding/consent"
                className="text-xs text-iw-text-muted text-center hover:underline"
              >
                {tc("back")}
              </Link>
            )}
          </>
        }
      >
        {stage === "phone" ? (
          <AuthInput
            id="phone"
            label={t("phone_label")}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 0123"
            autoComplete="tel"
            helper={t("phone_helper")}
          />
        ) : (
          <AuthInput
            id="code"
            label={t("code_label")}
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            autoComplete="one-time-code"
          />
        )}
      </AuthCard>
    </AuthShell>
  );
}
