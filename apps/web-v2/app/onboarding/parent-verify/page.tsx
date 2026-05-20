"use client";
import * as React from "react";
import Link from "next/link";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/parent-verify
 *
 * Verifies the adult on the account before learners can be added or
 * the family can leave first-run. We ask for the parent's phone (SMS
 * code) because email already verified — this is a step-up, not a
 * duplicate check.
 */
export default function ParentVerifyPage() {
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [stage, setStage] = React.useState<"phone" | "code">("phone");

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="safetyOk" size={32} />}
        eyebrow="Parent verification"
        title={stage === "phone" ? "Verify it's really you." : "Enter the 6-digit code."}
        subtitle={
          stage === "phone"
            ? "We'll text a one-time code to confirm you're the adult on this account. We never use this number for marketing."
            : "We sent a code to your phone. It expires in 10 minutes."
        }
        reassurance={
          <ReassuranceCard
            tone="safety"
            title="Children can't bypass this step."
            body="A child profile becomes active only after a parent has verified. This is how AIVO enforces parental approval."
          />
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setStage(stage === "phone" ? "code" : "phone")}
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold hover:opacity-95"
            >
              {stage === "phone" ? "Send code" : "Verify and continue"}
            </button>
            {stage === "code" ? (
              <button
                type="button"
                onClick={() => setStage("phone")}
                className="text-xs text-iw-text-muted text-center hover:underline"
              >
                Use a different phone number
              </button>
            ) : (
              <Link
                href="/onboarding/consent"
                className="text-xs text-iw-text-muted text-center hover:underline"
              >
                Back
              </Link>
            )}
          </>
        }
      >
        {stage === "phone" ? (
          <AuthInput
            id="phone"
            label="Mobile phone"
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 0123"
            autoComplete="tel"
            helper="We use this only for verification and account recovery."
          />
        ) : (
          <AuthInput
            id="code"
            label="6-digit code"
            inputMode="numeric"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            autoComplete="one-time-code"
          />
        )}
      </AuthCard>
    </AuthShell>
  );
}
