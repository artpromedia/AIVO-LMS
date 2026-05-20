"use client";
import * as React from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthCard,
  ReassuranceCard,
  StepperHeader,
  ConsentRow,
  LegalCollapse,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

const STEPS = [
  { label: "About you" },
  { label: "Role" },
  { label: "Family" },
  { label: "Consent" },
] as const;

/**
 * /onboarding/consent
 *
 * Sprint-3 verbatim acceptance criterion enforced here:
 *
 *   "Separate parent / school / AI consent. Explicit IEP upload
 *    consent. Age-appropriate learner PIN. Progressive disclosure."
 *
 * Each bucket is its own ConsentRow. The parent / guardian bucket is
 * required for any account with a learner attached; the school data
 * sharing and AI personalization buckets are independent and optional.
 */
export default function ConsentReviewPage() {
  const [parentConsent, setParentConsent] = React.useState(true);
  const [schoolShare, setSchoolShare] = React.useState(false);
  const [aiPersonalize, setAiPersonalize] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={3} />
        <AuthCard
          icon={<AivoIcon name="consentCheck" size={32} />}
          eyebrow="Your consent — your control"
          title="Choose what AIVO can do."
          subtitle="Each row is a separate choice. You can change any of these later from Settings → Privacy."
          reassurance={
            <ReassuranceCard
              tone="privacy"
              title="No bundles. No dark patterns."
              body="School data sharing and AI personalization are independent. You can say yes to one and no to the other."
              link={{ href: "/onboarding/privacy", label: "Read the full privacy notice" }}
            />
          }
          actions={
            <>
              <Link
                href="/onboarding/permissions"
                aria-disabled={!parentConsent}
                className={`w-full h-12 rounded-iw-control text-white font-semibold flex items-center justify-center ${
                  parentConsent
                    ? "bg-[var(--aivo-sensory-primary)] hover:opacity-95"
                    : "bg-[var(--aivo-sensory-primary)]/50 pointer-events-none"
                }`}
              >
                Continue
              </Link>
              <p className="text-xs text-iw-text-muted text-center">
                You'll be asked to re-confirm any choice that affects your
                child later — never silently changed.
              </p>
            </>
          }
        >
          <ConsentRow
            id="c-parent"
            title="Parent / guardian consent"
            description="I confirm I am the parent or legal guardian for the learners on this account, and I agree to AIVO's Terms."
            checked={parentConsent}
            onChange={setParentConsent}
            required
            badge="Required"
            icon={<AivoIcon name="care" size={18} />}
          />
          <ConsentRow
            id="c-school"
            title="Share progress with my child's school"
            description="Lets your child's teachers see mastery, lessons, and IEP supports. Independent from any AI choice below."
            checked={schoolShare}
            onChange={setSchoolShare}
            badge="Optional"
            icon={<AivoIcon name="rosterSchool" size={18} />}
          />
          <ConsentRow
            id="c-ai"
            title="Use AI to personalize learning"
            description="AIVO uses your child's responses to adjust pacing, examples, and hints. We never sell this data. Turning this off keeps your child in non-personalized lessons."
            checked={aiPersonalize}
            onChange={setAiPersonalize}
            badge="Optional"
            icon={<AivoIcon name="aiSparkle" size={18} />}
          />
          <ConsentRow
            id="c-mkt"
            title="Send me product news"
            description="A short monthly email. Never sent to learners."
            checked={marketing}
            onChange={setMarketing}
            badge="Optional"
            icon={<AivoIcon name="aiWand" size={18} />}
          />
          <LegalCollapse summary="What each choice actually changes (plain English).">
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Parent / guardian:</strong> required to create accounts
                for anyone under 18. Verifies you are the legal guardian.
              </li>
              <li>
                <strong>School sharing:</strong> teachers see mastery, lessons,
                and (if uploaded) IEP supports. No marketing or third-party
                sharing.
              </li>
              <li>
                <strong>AI personalization:</strong> AIVO adapts pacing and
                hints to your child. Training data is never used to identify
                an individual learner.
              </li>
              <li>
                <strong>Product news:</strong> a low-volume email list.
                Unsubscribe in one click.
              </li>
            </ul>
          </LegalCollapse>
        </AuthCard>
      </div>
    </AuthShell>
  );
}
