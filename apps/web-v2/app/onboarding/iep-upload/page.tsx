"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, ReassuranceCard, ConsentRow, LegalCollapse } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/iep-upload
 *
 * Sprint-3 verbatim acceptance criterion:
 *   "Explicit IEP upload consent."
 *
 * IEP / 504 documents are sensitive. The upload field is gated behind its
 * own ConsentRow that the user must opt in to before the file input becomes
 * interactive. Skipping is always allowed.
 *
 * Slice 3 (gap #7): the step now persists. It requires a `learnerId` — IEP
 * documents are learner-scoped — so the page reads one from the query string
 * and, when absent, gates behind learner selection (fetching the parent's
 * learners). On submit it records explicit `iep_document_storage` consent and
 * POSTs the file to `/api/bff/learners/[learnerId]/iep-upload`; the skip path
 * calls the matching `/skip` route so a deliberate "no IEP" is also recorded.
 */

type LearnerOption = { id: string; firstName: string };

const NEXT_STEP = "/onboarding/parent-verify";

async function recordIepConsent(learnerId: string): Promise<void> {
  const res = await fetch(`/api/bff/learners/${learnerId}/consent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consentType: "iep_document_storage" }),
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) {
    throw new Error("iep_consent_persist_failed");
  }
}

async function postIepFile(learnerId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/bff/learners/${learnerId}/iep-upload`, {
    method: "POST",
    body: form,
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) {
    throw new Error("iep_upload_failed");
  }
}

async function postIepSkip(learnerId: string): Promise<void> {
  const res = await fetch(`/api/bff/learners/${learnerId}/iep-upload/skip`, {
    method: "POST",
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) {
    throw new Error("iep_skip_failed");
  }
}

export default function IepUploadPage() {
  const t = useTranslations("onboarding.iep_upload");
  const tc = useTranslations("onboarding.common");
  const router = useRouter();
  const search = useSearchParams();
  const queryLearnerId = search?.get("learnerId");

  const [explicitConsent, setExplicitConsent] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [learners, setLearners] = React.useState<LearnerOption[] | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = React.useState<string>(queryLearnerId ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Resolve which learner this IEP belongs to. A query param wins; otherwise
  // fetch the parent's learners so the step can gate behind a selection rather
  // than silently dropping the upload when no learner is in scope.
  React.useEffect(() => {
    if (queryLearnerId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/bff/learners");
        const json = (await res.json()) as {
          ok?: boolean;
          data?: { learners?: LearnerOption[] };
        };
        if (cancelled) return;
        const list = json.ok ? (json.data?.learners ?? []) : [];
        setLearners(list);
        // Auto-select when there's exactly one learner — the common funnel case.
        if (list.length === 1 && list[0]) setSelectedLearnerId(list[0].id);
      } catch {
        if (!cancelled) setLearners([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryLearnerId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !selectedLearnerId) return;
    setSubmitting(true);
    setError(null);
    try {
      if (file) {
        if (!explicitConsent) {
          setError(t("consent_required"));
          setSubmitting(false);
          return;
        }
        // Record explicit IEP-storage consent before the bytes are sent so the
        // upload route's consent guard is satisfied and the audit trail shows
        // the parent opted in immediately prior to the upload.
        await recordIepConsent(selectedLearnerId);
        await postIepFile(selectedLearnerId, file);
      } else {
        // No file chosen: record an explicit skip rather than just navigating,
        // so "no IEP" is a deliberate, audited decision.
        await postIepSkip(selectedLearnerId);
      }
      router.push(NEXT_STEP);
    } catch {
      setError(t("save_error"));
      setSubmitting(false);
    }
  }

  // Gate: no learner in scope and none to select — point the parent at learner
  // creation instead of pretending the upload can proceed.
  const needsLearner = !selectedLearnerId;
  const noLearnersAvailable = !queryLearnerId && learners !== null && learners.length === 0;

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
          noLearnersAvailable ? (
            <Link
              href="/onboarding/learner/new"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              {t("no_learner_cta")}
            </Link>
          ) : (
            <form onSubmit={handleSubmit} className="contents">
              <button
                type="submit"
                disabled={submitting || needsLearner}
                aria-disabled={submitting || needsLearner}
                className={`w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95 ${
                  submitting || needsLearner ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {submitting ? t("saving") : file ? t("upload_continue") : t("skip")}
              </button>
              {error ? (
                <p role="alert" className="text-xs text-aivo-danger text-center">
                  {error}
                </p>
              ) : null}
              <p className="text-xs text-iw-text-muted text-center">{t("footer_note")}</p>
            </form>
          )
        }
      >
        {noLearnersAvailable ? (
          <div className="rounded-iw-card border border-iw-border p-5 text-center">
            <p className="text-sm font-semibold text-iw-text-strong">{t("no_learner_title")}</p>
            <p className="text-xs text-iw-text-muted mt-2">{t("no_learner_body")}</p>
          </div>
        ) : (
          <>
            {/* Learner picker only when the funnel arrives without a learnerId
                and the parent has more than one learner to choose from. */}
            {!queryLearnerId && learners && learners.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="iep-learner" className="text-sm font-medium text-iw-text-strong">
                  {t("select_learner_label")}
                </label>
                <select
                  id="iep-learner"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  className="h-12 px-3 rounded-iw-control bg-white border border-iw-border text-base text-iw-text-strong focus:border-[var(--aivo-sensory-primary)] focus:ring-2 focus:ring-[var(--aivo-sensory-primary)]/20 outline-none"
                >
                  <option value="" disabled>
                    {t("select_learner_placeholder")}
                  </option>
                  {learners.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.firstName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}

