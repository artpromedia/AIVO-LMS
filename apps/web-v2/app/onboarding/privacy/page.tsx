"use client";
import Link from "next/link";
import { AuthShell, AuthCard, LegalCollapse, ReassuranceCard } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/privacy
 *
 * Privacy explanation page — the "what does AIVO actually do with my
 * data?" summary that the consent screen links to. Uses progressive
 * disclosure (LegalCollapse) so the dense legal text is one click
 * away, not the default reading experience.
 */
export default function PrivacyExplanationPage() {
  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentDoc" size={32} />}
        eyebrow="Privacy"
        title="What AIVO does — in plain English."
        subtitle="Below is the short version. Each section opens to the full legal text. You can re-read this any time from Settings."
        reassurance={
          <ReassuranceCard
            tone="privacy"
            title="One promise above everything else."
            body="We never sell student data. Not to advertisers, not to vendors, not to AI training partners."
          />
        }
        actions={
          <Link
            href="/onboarding/consent"
            className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold flex items-center justify-center hover:opacity-95"
          >
            Back to consent
          </Link>
        }
      >
        <LegalCollapse
          summary="What we collect — only what's needed to teach."
          defaultOpen
        >
          <ul className="list-disc list-inside space-y-1">
            <li>Account: parent / staff name, email.</li>
            <li>
              Learner: first name or nickname, grade band, optional
              accommodations (IEP / 504), responses to lessons.
            </li>
            <li>Device: browser, OS, app version — for debugging only.</li>
          </ul>
        </LegalCollapse>
        <LegalCollapse summary="How AI is used.">
          <p>
            When AI personalization is on, your child's responses adjust their
            next lesson — pacing, examples, hints. We do not use these
            responses to identify your child. We do not train foundation
            models on identifiable student work. Model providers are bound by
            contract to delete prompt and completion data within 30 days.
          </p>
        </LegalCollapse>
        <LegalCollapse summary="Who sees what.">
          <ul className="list-disc list-inside space-y-1">
            <li>You and any co-parent you added: full progress.</li>
            <li>
              Teachers at the school you opted in to: lesson mastery and IEP
              supports for their classes only.
            </li>
            <li>
              AIVO staff: encrypted access for support, with audit logs. We
              never browse student work casually.
            </li>
            <li>Advertisers: never.</li>
          </ul>
        </LegalCollapse>
        <LegalCollapse summary="Your rights and how to delete.">
          <p>
            You can export every record AIVO holds about your account or your
            child from Settings → Privacy → Export. You can delete the
            account the same way. Deletion is permanent within 30 days; you
            can cancel during the grace period.
          </p>
        </LegalCollapse>
      </AuthCard>
    </AuthShell>
  );
}
