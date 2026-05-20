"use client";
import Link from "next/link";
import { AuthShell, AuthCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

export default function WelcomePage() {
  return (
    <AuthShell
      brand={
        <div className="flex flex-col gap-6 max-w-sm">
          <AivoIcon name="aiSparkle" size={48} />
          <h2 className="text-3xl font-semibold text-iw-text-strong leading-tight">
            Learning that meets every child where they are.
          </h2>
          <p className="text-sm text-iw-text-muted leading-relaxed">
            AIVO is a calm, accessible learning platform built with families,
            teachers, and learners — including children who learn differently.
          </p>
        </div>
      }
      footer={
        <div className="flex flex-wrap gap-4 justify-between items-center">
          <span>© AIVO Learning</span>
          <span className="flex gap-3">
            <Link href="/onboarding/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/onboarding/privacy" className="hover:underline">
              Privacy
            </Link>
          </span>
        </div>
      }
    >
      <AuthCard
        eyebrow="Welcome"
        title="Let's get started."
        subtitle="Sign in to continue, or create a new account for your family, school, or district."
        actions={
          <>
            <Link
              href="/onboarding/signin"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold flex items-center justify-center hover:opacity-95 transition-opacity"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding/signup"
              className="w-full h-12 rounded-iw-control bg-white border border-iw-border text-iw-text-strong font-semibold flex items-center justify-center hover:bg-[var(--aivo-color-surface-canvas,#f4f6f5)] transition-colors"
            >
              Create an account
            </Link>
            <p className="text-xs text-iw-text-muted text-center mt-1">
              Have an invite code from a school or district?{" "}
              <Link
                href="/onboarding/signup?via=invite"
                className="font-semibold text-[var(--aivo-sensory-primary,#7c3aed)] hover:underline"
              >
                Use an invite link
              </Link>
            </p>
          </>
        }
      >
        <p className="text-sm text-iw-text-muted">
          AIVO works on the web, on tablets, and on phones. You can switch
          between devices anytime — your progress comes with you.
        </p>
      </AuthCard>
    </AuthShell>
  );
}
