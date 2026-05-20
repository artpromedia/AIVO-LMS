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
  { label: "Join school" },
  { label: "Consent" },
] as const;

export default function SchoolInvitePage() {
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
          eyebrow="School invite"
          title="Join your school on AIVO."
          subtitle="Paste the code your school sent you. If you don't have one, ask your school admin — only invited staff can join."
          reassurance={
            <ReassuranceCard
              tone="safety"
              title="School staff cannot self-enroll."
              body="An admin must invite you. This protects rosters and student data."
            />
          }
          actions={
            <>
              <Link
                href="/onboarding/consent"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                Join school
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
            id="code"
            label="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. SCHOOL-7Q4M-2025"
            autoComplete="one-time-code"
            error={error ?? undefined}
          />
          <AuthInput
            id="school-email"
            label="Your school email"
            type="email"
            inputMode="email"
            value={schoolEmail}
            onChange={(e) => setSchoolEmail(e.target.value)}
            placeholder="you@yourschool.edu"
            helper="Must match the email the admin invited."
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
