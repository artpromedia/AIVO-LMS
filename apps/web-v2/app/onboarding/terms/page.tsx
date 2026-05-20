"use client";
import Link from "next/link";
import { AuthShell, AuthCard, LegalCollapse } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

export default function TermsPage() {
  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="consentDoc" size={32} />}
        eyebrow="Terms"
        title="AIVO Terms of Use."
        subtitle="Summary first. Tap any section for the full legal text. Last updated: this page is a placeholder for the final legal-reviewed copy."
        actions={
          <Link
            href="/onboarding/consent"
            className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
          >
            Back to consent
          </Link>
        }
      >
        <LegalCollapse summary="What you agree to." defaultOpen>
          <p>
            You agree to use AIVO for the purpose of educating yourself, your
            child, or your students. You won't try to bypass safety filters,
            re-sell access, or use AIVO output to train competing models.
          </p>
        </LegalCollapse>
        <LegalCollapse summary="What AIVO agrees to.">
          <p>
            We will keep your data private as described in our privacy notice,
            give you 30 days' notice of any material change to these terms,
            and let you export everything we hold at any time.
          </p>
        </LegalCollapse>
        <LegalCollapse summary="Children and families.">
          <p>
            For accounts that include learners under 13, a verified parent or
            guardian must consent. We do not knowingly create child-controlled
            accounts. Schools acting in loco parentis must have a signed data
            processing agreement on file.
          </p>
        </LegalCollapse>
        <LegalCollapse summary="If something goes wrong.">
          <p>
            Either of us can end this agreement. Your data export remains
            available for 90 days after closure. Disputes are governed by the
            laws of the jurisdiction in your billing address.
          </p>
        </LegalCollapse>
      </AuthCard>
    </AuthShell>
  );
}
