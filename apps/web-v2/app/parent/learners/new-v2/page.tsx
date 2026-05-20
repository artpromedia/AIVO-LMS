"use client";
import Link from "next/link";
import * as React from "react";
import { LearningHero, SetupProgressTrack, type SetupStep } from "@aivo/ui/hero";
import {
  StepperHeader,
  AuthCard,
  AuthInput,
  ConsentRow,
  ReassuranceCard,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /parent/learners/new-v2 — REDESIGNED add-learner shell.
 *
 * Non-destructive: the legacy /parent/learners/new (server action +
 * zod + repos) stays in place. This page is the new calmer shell
 * with explicit consent + progressive disclosure. Sprint 4 commit 4
 * wires the form fields directly to addLearnerAction.
 *
 * Verbatim acceptance:
 *   "Parent can add learner, upload IEP, review assessment status,
 *    and approve permissions."
 *   "Explicit IEP upload consent."
 *   "Progressive disclosure."
 */
export default function AddLearnerV2() {
  const [iepConsent, setIepConsent] = React.useState(false);

  const steps: SetupStep[] = [
    { id: "basics", label: "Tell us about them", status: "active" },
    { id: "consent", label: "IEP & data consent", status: "upcoming" },
    { id: "approve", label: "Approve learner access", status: "upcoming" },
  ];

  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas,#f4f6f5)]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10 flex flex-col gap-6">
        <StepperHeader
          steps={[
            { label: "About learner" },
            { label: "Consent" },
            { label: "Approve access" },
          ]}
          current={0}
        />

        <LearningHero
          greeting={<>Let's set up your learner.</>}
          subhead="A few quick details so AIVO can meet them where they are — no pressure to fill everything in today."
          actions={
            <Link
              href="/parent/learners/new"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold shadow-sm hover:opacity-95"
            >
              <AivoIcon name="rosterStudents" size={18} />
              Continue with legacy form
            </Link>
          }
        />

        <SetupProgressTrack steps={steps} />

        <AuthCard
          title="The basics"
          subtitle="You can edit any of this later from the learner profile."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <AuthInput id="firstName" name="firstName" label="First name" placeholder="Emma" required />
            <AuthInput id="preferredName" name="preferredName" label="Preferred name (optional)" placeholder="Em" />
            <AuthInput id="birthYear" name="birthYear" label="Birth year" inputMode="numeric" pattern="\d{4}" placeholder="2016" required />
            <AuthInput id="pronouns" name="pronouns" label="Pronouns (optional)" placeholder="she/her" />
          </div>
        </AuthCard>

        <AuthCard
          title="IEP, 504 plan, or learning support"
          subtitle="Optional — upload now or skip and add it later. Adding it helps AIVO apply the right accommodations from day one."
        >
          <ConsentRow
            id="iep-consent-v2"
            icon={<AivoIcon name="iep" size={18} />}
            title="I consent to upload my learner's IEP / 504 / support plan"
            description="AIVO will extract accommodations and goals to personalize learning. The original file stays encrypted and is never shared outside your tenant."
            checked={iepConsent}
            onChange={setIepConsent}
          />
          <div className="text-xs text-iw-text-muted mt-3">
            You can add or remove the plan at any time from the learner profile.
          </div>
        </AuthCard>

        <ReassuranceCard
          tone="safety"
          icon={<AivoIcon name="consentLock" size={18} />}
          title="Children can't bypass this step."
          body="A learner you add here will not have an active account until you finish the approve-access step and choose their PIN."
        />

        <div className="flex justify-end">
          <Link
            href="/parent/learners/new"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold shadow-sm hover:opacity-95"
          >
            Continue
            <AivoIcon name="goal" size={18} />
          </Link>
        </div>
      </div>
    </main>
  );
}
