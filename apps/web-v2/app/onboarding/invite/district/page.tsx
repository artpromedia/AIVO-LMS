"use client";
import * as React from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthCard,
  AuthInput,
  ReassuranceCard,
  StepperHeader,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

const STEPS = [
  { label: "About you" },
  { label: "Role" },
  { label: "Join district" },
  { label: "Consent" },
] as const;

export default function DistrictInvitePage() {
  const [code, setCode] = React.useState("");
  const [adminEmail, setAdminEmail] = React.useState("");

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={2} />
        <AuthCard
          icon={<AivoIcon name="rosterDistrict" size={32} />}
          eyebrow="District invite"
          title="Join your district on AIVO."
          subtitle="District admin invites are issued by AIVO during onboarding. Your district success manager will send you a one-time code."
          reassurance={
            <ReassuranceCard
              tone="safety"
              title="District admin step-up is enforced."
              body="Every sign-in for this role requires a fresh biometric or PIN check. AIVO never lets a single password unlock district data."
            />
          }
          actions={
            <>
              <Link
                href="/onboarding/consent"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                Continue
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                <Link href="/onboarding/role" className="hover:underline">
                  Back
                </Link>
              </p>
            </>
          }
        >
          <AuthInput
            id="dcode"
            label="District invite code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. DISTRICT-9F2L-2025"
            autoComplete="one-time-code"
          />
          <AuthInput
            id="admin-email"
            label="Your district email"
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
