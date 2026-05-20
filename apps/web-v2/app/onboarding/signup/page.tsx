"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  { label: "Consent" },
] as const;

export default function SignUpPage() {
  const search = useSearchParams();
  const viaInvite = search.get("via") === "invite";
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [invite, setInvite] = React.useState("");

  return (
    <AuthShell
      footer={
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/onboarding/terms" className="hover:underline">
            Terms
          </Link>
          <Link href="/onboarding/privacy" className="hover:underline">
            Privacy
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={0} />
        <AuthCard
          icon={<AivoIcon name="aiSparkle" size={32} />}
          eyebrow="Create your account"
          title={viaInvite ? "Accept your invite" : "Tell us a little about you"}
          subtitle={
            viaInvite
              ? "Paste the code from your school or district invitation. You can finish setting up your role next."
              : "We'll personalize the next steps based on who you are setting up AIVO for."
          }
          reassurance={
            <ReassuranceCard
              tone="safety"
              title="Adults set up accounts, not children."
              body="If you are creating an account for a child, you'll add them on the next step. AIVO never asks a child to create their own account."
            />
          }
          actions={
            <>
              <Link
                href="/onboarding/role"
                className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
              >
                Continue
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                Already have an account?{" "}
                <Link
                  href="/onboarding/signin"
                  className="font-semibold text-[var(--aivo-sensory-primary)] hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          }
        >
          {viaInvite ? (
            <AuthInput
              id="invite"
              label="Invite code"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="e.g. SCHOOL-7Q4M-2025"
              helper="Your school or district sent this in the welcome email."
              autoComplete="one-time-code"
            />
          ) : null}
          <AuthInput
            id="name"
            label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First and last name"
            autoComplete="name"
          />
          <AuthInput
            id="email"
            label="Email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <AuthInput
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper="At least 12 characters. We'll check it isn't in any known leak before saving it."
            autoComplete="new-password"
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
