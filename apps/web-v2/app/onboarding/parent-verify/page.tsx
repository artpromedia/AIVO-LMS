"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
 *
 * Slice 4 (gap #7, overlapping SMS gap #22): the step now actually verifies.
 * "Send code" POSTs the phone to `/api/bff/onboarding/parent-verify`, which
 * mints + stores a hashed one-time code and texts it via comms-svc (dev path
 * issues the code without a real text). "Verify and continue" PUTs the typed
 * code; only a server-confirmed match advances the funnel.
 */

// Parent verification is the last gate before the per-learner approval step:
// pin / iep-upload funnel here, and a child profile only goes active after the
// adult is verified (see `/parent/home-v2` setup checklist: verify → … → approve).
const NEXT_STEP = "/onboarding/child-approval";

async function requestCode(phone: string): Promise<void> {
  const res = await fetch("/api/bff/onboarding/parent-verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) throw new Error("send_failed");
}

async function confirmCode(code: string): Promise<void> {
  const res = await fetch("/api/bff/onboarding/parent-verify", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) throw new Error("verify_failed");
}

export default function ParentVerifyPage() {
  const t = useTranslations("onboarding.parent_verify");
  const tc = useTranslations("onboarding.common");
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [stage, setStage] = React.useState<"phone" | "code">("phone");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const phoneReady = phone.replace(/\D/g, "").length >= 8;
  const codeReady = code.length === 6;

  async function handlePrimary() {
    setError(null);
    if (stage === "phone") {
      if (!phoneReady || submitting) return;
      setSubmitting(true);
      try {
        await requestCode(phone);
        setCode("");
        setStage("code");
      } catch {
        setError(t("send_error"));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (!codeReady || submitting) return;
    setSubmitting(true);
    try {
      await confirmCode(code);
      router.push(NEXT_STEP);
    } catch {
      setError(t("verify_error"));
      setSubmitting(false);
    }
  }

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
              disabled={submitting || (stage === "phone" ? !phoneReady : !codeReady)}
              onClick={handlePrimary}
            >
              {submitting
                ? stage === "phone"
                  ? t("sending")
                  : t("verifying")
                : stage === "phone"
                  ? t("send_code")
                  : t("verify_continue")}
            </Button>
            {error ? (
              <p role="alert" className="text-xs text-[var(--aivo-status-error)] text-center">
                {error}
              </p>
            ) : null}
            {stage === "code" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  setStage("phone");
                }}
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
