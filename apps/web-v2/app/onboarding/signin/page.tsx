"use client";
import * as React from "react";
import Link from "next/link";
import { AuthShell, AuthCard, AuthInput, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

export default function SignInPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);

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
          <Link href="/onboarding/recovery" className="hover:underline">
            Trouble signing in?
          </Link>
        </div>
      }
    >
      <AuthCard
        icon={<AivoIcon name="aiSparkle" size={32} />}
        eyebrow="Welcome back"
        title="Sign in"
        subtitle="Use the email you set up with your family, school, or district."
        reassurance={
          <ReassuranceCard
            tone="privacy"
            title="We never sell your data."
            body="Your email is used only to identify your account. Read the privacy notice for more."
            link={{ href: "/onboarding/privacy", label: "Read the privacy notice" }}
          />
        }
        actions={
          <>
            <button
              type="submit"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold hover:opacity-95"
            >
              Sign in
            </button>
            <div className="flex justify-between text-sm">
              <Link
                href="/onboarding/recovery"
                className="text-iw-text-muted hover:underline"
              >
                Forgot password?
              </Link>
              <Link
                href="/onboarding/signup"
                className="font-semibold text-[var(--aivo-sensory-primary,#7c3aed)] hover:underline"
              >
                Create an account
              </Link>
            </div>
          </>
        }
      >
        <AuthInput
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <AuthInput
          id="password"
          label="Password"
          type={showPw ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="text-xs font-semibold text-[var(--aivo-sensory-primary,#7c3aed)] hover:underline"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          }
        />
      </AuthCard>
    </AuthShell>
  );
}
