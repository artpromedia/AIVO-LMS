"use client";
import * as React from "react";
import Link from "next/link";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";

export default function RecoveryPage() {
  const [email, setEmail] = React.useState("");

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentLock" size={32} />}
        eyebrow="Account recovery"
        title="Trouble signing in? We'll send a link."
        subtitle="Enter the email on your AIVO account. We'll email a one-time link that lets you reset your password."
        reassurance={
          <ReassuranceCard
            tone="info"
            title="We don't say whether the email exists."
            body="Either way, we'll show the same confirmation. This stops bad actors from learning which addresses have accounts."
          />
        }
        actions={
          <>
            <Button type="button" size="lg" className="w-full">
              Send recovery link
            </Button>
            <p className="text-xs text-iw-text-muted text-center">
              <Link href="/onboarding/signin" className="hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        }
      >
        <AuthInput
          id="rec-email"
          label="Email"
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
