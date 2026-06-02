"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, ReassuranceCard, ConsentRow, LegalCollapse } from "@aivo/ui/auth";
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
  const t = useTranslations("onboarding.iep_upload");
  const tc = useTranslations("onboarding.common");
  const [explicitConsent, setExplicitConsent] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="iep" size={32} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        reassurance={
          <ReassuranceCard
            tone="privacy"
            title={t("reassure_title")}
            body={t("reassure_body")}
            link={{ href: "/onboarding/privacy", label: t("reassure_link") }}
          />
        }
        actions={
          <>
            <Link
              href="/onboarding/parent-verify"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {file ? t("upload_continue") : t("skip")}
            </Link>
            <p className="text-xs text-iw-text-muted text-center">{t("footer_note")}</p>
          </>
        }
      >
        <ConsentRow
          id="iep-consent"
          title={t("consent_title")}
          description={t("consent_desc")}
          checked={explicitConsent}
          onChange={setExplicitConsent}
          badge={tc("badge_explicit")}
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
            {file ? file.name : t("choose_file")}
          </label>
          <p className="text-xs text-iw-text-muted mt-3">{t("file_help")}</p>
        </div>
        <LegalCollapse summary={t("legal_summary")}>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>{t("legal_extracted_label")}</strong> {t("legal_extracted_body")}
            </li>
            <li>
              <strong>{t("legal_never_label")}</strong> {t("legal_never_body")}
            </li>
            <li>
              <strong>{t("legal_teachers_label")}</strong> {t("legal_teachers_body")}
            </li>
          </ul>
        </LegalCollapse>
      </AuthCard>
    </AuthShell>
  );
}
