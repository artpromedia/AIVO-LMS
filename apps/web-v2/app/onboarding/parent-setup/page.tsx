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
  { label: "Family" },
  { label: "Consent" },
] as const;

export default function ParentSetupPage() {
  const [household, setHousehold] = React.useState("");
  const [coParentEmail, setCoParentEmail] = React.useState("");

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={2} />
        <AuthCard
          icon={<AivoIcon name="care" size={32} />}
          eyebrow="Family setup"
          title="Tell us about your household."
          subtitle="You'll add your children on the next step. This information helps us route invitations and share progress with the right grown-ups."
          reassurance={
            <ReassuranceCard
              tone="privacy"
              title="Household details stay private."
              body="We never sell household information. Co-parents only see learners they are added to."
              link={{ href: "/onboarding/privacy", label: "What we collect" }}
            />
          }
          actions={
            <>
              <Link
                href="/onboarding/learner/new"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                Continue — add a learner
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
            id="household"
            label="Household name (optional)"
            value={household}
            onChange={(e) => setHousehold(e.target.value)}
            placeholder="e.g. The Okafor family"
            helper="Shown to teachers when they message you. You can change it later."
          />
          <AuthInput
            id="coparent"
            label="Invite a co-parent or caregiver (optional)"
            type="email"
            inputMode="email"
            value={coParentEmail}
            onChange={(e) => setCoParentEmail(e.target.value)}
            placeholder="coparent@example.com"
            helper="They'll get an email with their own sign-in. You can both approve consents and view progress."
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
