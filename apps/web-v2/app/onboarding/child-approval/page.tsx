"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthShell, AuthCard, ReassuranceCard, ConsentRow } from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/child-approval
 *
 * Final parent approval step. The parent reviews what their child
 * will be able to do on AIVO and presses "Approve". Until this step
 * is completed, the learner profile is in a holding state and the
 * learner cannot sign in.
 *
 * Sprint-3 acceptance criterion enforced here:
 *   "Child cannot bypass parent approval."
 *
 * Slice 4 (gap #7): the step now persists. Approval is recorded against a
 * specific learner, so the page resolves a `learnerId` from the query string
 * and, when absent, gates behind learner selection (fetching the parent's
 * learners) rather than silently dropping the approval. On Approve it records
 * the per-learner consents the toggles describe via the existing, tested
 * `POST /api/bff/learners/[learnerId]/consent` endpoint:
 *   - `child_data_collection` — always, the core approval that lifts the
 *     profile out of its holding state so the child can sign in;
 *   - `teacher_access` — when "Messages with teachers" is on;
 *   - `ai_personalization` — when "AI tutor" is on.
 * Voice mode stays an honest browser-level device-capability (the mic grant is
 * the browser's own prompt at point of use) and is intentionally not persisted
 * as a server consent. Only after every record persists do we navigate to the
 * parent home.
 */

type LearnerOption = { id: string; firstName: string };

type ConsentType = "child_data_collection" | "teacher_access" | "ai_personalization";

const NEXT_STEP = "/parent/home";

async function recordConsent(learnerId: string, consentType: ConsentType): Promise<void> {
  const res = await fetch(`/api/bff/learners/${learnerId}/consent`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ consentType }),
  });
  let json: { ok?: boolean } = {};
  try {
    json = (await res.json()) as { ok?: boolean };
  } catch {
    /* ignore — !res.ok branch handles it */
  }
  if (!res.ok || json.ok !== true) {
    throw new Error("child_approval_persist_failed");
  }
}

export default function ChildApprovalPage() {
  const t = useTranslations("onboarding.child_approval");
  const tc = useTranslations("onboarding.common");
  const router = useRouter();
  const search = useSearchParams();
  const queryLearnerId = search?.get("learnerId");

  const [communication, setCommunication] = React.useState(true);
  const [aiTutor, setAiTutor] = React.useState(true);
  const [voiceMode, setVoiceMode] = React.useState(false);
  const [learners, setLearners] = React.useState<LearnerOption[] | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = React.useState<string>(queryLearnerId ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Resolve which learner is being approved. A query param wins; otherwise
  // fetch the parent's learners so the gate can require a selection rather than
  // silently approving the wrong (or no) profile.
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
      // Always record the core approval, then the optional capabilities the
      // parent left enabled. Recorded in sequence so a mid-way failure surfaces
      // an error without navigating, and the audit trail reflects the choices.
      await recordConsent(selectedLearnerId, "child_data_collection");
      if (communication) await recordConsent(selectedLearnerId, "teacher_access");
      if (aiTutor) await recordConsent(selectedLearnerId, "ai_personalization");
      router.push(NEXT_STEP);
    } catch {
      setError(t("save_error"));
      setSubmitting(false);
    }
  }

  // Gate: no learner in scope and none to select — point the parent at learner
  // creation instead of approving a profile that doesn't exist.
  const needsLearner = !selectedLearnerId;
  const noLearnersAvailable = !queryLearnerId && learners !== null && learners.length === 0;

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="care" size={32} />}
        eyebrow={t("eyebrow")}
        title={t("title")}
        subtitle={t("subtitle")}
        reassurance={
          <ReassuranceCard tone="safety" title={t("reassure_title")} body={t("reassure_body")} />
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
                {submitting ? t("saving") : t("approve")}
              </button>
              {error ? (
                <p role="alert" className="text-xs text-iw-error text-center">
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
                <label htmlFor="ca-learner" className="text-sm font-medium text-iw-text-strong">
                  {t("select_learner_label")}
                </label>
                <select
                  id="ca-learner"
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
              id="ca-comm"
              title={t("comm_title")}
              description={t("comm_desc")}
              checked={communication}
              onChange={setCommunication}
              badge={tc("badge_recommended")}
              icon={<AivoIcon name="classroom" size={18} />}
            />
            <ConsentRow
              id="ca-ai"
              title={t("ai_title")}
              description={t("ai_desc")}
              checked={aiTutor}
              onChange={setAiTutor}
              badge={tc("badge_recommended")}
              icon={<AivoIcon name="aiBrain" size={18} />}
            />
            <ConsentRow
              id="ca-voice"
              title={t("voice_title")}
              description={t("voice_desc")}
              checked={voiceMode}
              onChange={setVoiceMode}
              badge={tc("badge_optional")}
              icon={<AivoIcon name="aiWand" size={18} />}
            />
          </>
        )}
      </AuthCard>
    </AuthShell>
  );
}

