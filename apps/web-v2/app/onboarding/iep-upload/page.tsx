"use client";
import * as React from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthCard,
  ReassuranceCard,
  ConsentRow,
  LegalCollapse,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/iep-upload
 *
 * Sprint-3 verbatim acceptance criterion:
 *   "Explicit IEP upload consent."
 *
 * IEP / 504 documents are sensitive. The upload field is gated behind
 * its own ConsentRow that the user must opt in to before the file
 * input becomes interactive. Skipping is always allowed.
 */
export default function IepUploadPage() {
  const [explicitConsent, setExplicitConsent] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="iep" size={32} />}
        eyebrow="IEP / 504 supports"
        title="Add your child's plan — only if you want to."
        subtitle="If you have an IEP or 504, AIVO can extract accommodations (extra time, read-aloud, etc.) so lessons match it from day one. You can do this later, or never."
        reassurance={
          <ReassuranceCard
            tone="privacy"
            title="This is a sensitive document."
            body="Only you, any co-parent, and teachers at the schools you've opted in to will see it. AI extraction runs in-tenant. The original file is encrypted at rest."
            link={{ href: "/onboarding/privacy", label: "How IEPs are handled" }}
          />
        }
        actions={
          <>
            <Link
              href="/onboarding/parent-verify"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {file ? "Upload and continue" : "Skip for now"}
            </Link>
            <p className="text-xs text-iw-text-muted text-center">
              You can upload later from your learner's profile.
            </p>
          </>
        }
      >
        <ConsentRow
          id="iep-consent"
          title="I explicitly consent to upload an IEP / 504 plan"
          description="AIVO will store the document, extract listed accommodations, and apply them to lessons. You can delete it any time."
          checked={explicitConsent}
          onChange={setExplicitConsent}
          badge="Explicit"
          icon={<AivoIcon name="consentLock" size={18} />}
        />
        <div
          className={`rounded-iw-card border border-dashed border-iw-border p-5 text-center transition-opacity ${
            explicitConsent ? "opacity-100" : "opacity-50 pointer-events-none"
          }`}
        >
          <input
            id="iep-file"
            type="file"
            accept=".pdf,.doc,.docx"
            disabled={!explicitConsent}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <label
            htmlFor="iep-file"
            className={`inline-flex items-center gap-2 px-4 h-10 rounded-iw-control font-semibold text-sm ${
              explicitConsent
                ? "bg-white border border-iw-border text-iw-text-strong cursor-pointer hover:border-iw-text-muted"
                : "bg-[var(--aivo-color-surface-canvas)] text-iw-text-muted cursor-not-allowed"
            }`}
          >
            <AivoIcon name="curriculum" size={18} />
            {file ? file.name : "Choose a PDF or Word file"}
          </label>
          <p className="text-xs text-iw-text-muted mt-3">
            Files up to 20 MB. We&apos;ll show a preview of what we extracted
            before applying anything.
          </p>
        </div>
        <LegalCollapse summary="What gets extracted, and what doesn't.">
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Extracted:</strong> accommodation list (extra time, read
              aloud, breaks), goal categories, support service hours.
            </li>
            <li>
              <strong>Never extracted:</strong> medical diagnoses,
              psychological evaluations, parent statements, signatures.
            </li>
            <li>
              <strong>Visible to teachers:</strong> only the accommodations
              list, only at schools you've opted in to.
            </li>
          </ul>
        </LegalCollapse>
      </AuthCard>
    </AuthShell>
  );
}
