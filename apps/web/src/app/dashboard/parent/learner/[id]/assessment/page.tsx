"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Heart,
  HelpCircle,
  Sparkles,
  Compass,
  CheckCircle2,
  Save,
  Cloud,
  CloudOff,
  GripVertical,
  ShieldCheck,
  ListChecks,
} from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";
import SectionJourneyGraphic from "@/components/SectionJourneyGraphic";
import ConfettiBurst from "@/components/ConfettiBurst";
import {
  PARENT_ASSESSMENT_SECTIONS,
  REAL_SECTIONS,
  LIKERT5_LABELS,
  // NOT_SURE_LABEL is intentionally not imported — label now comes from i18n.
  NOT_SURE_VALUE,
  COMPAT_IDS,
  bandFromDob,
  isQuestionVisible,
  type AgeBand,
  type AssessmentQuestion,
  type AssessmentSection,
} from "@/lib/assessment-questions";

/**
 * Parent Assessment — page UI.
 *
 * Implements the framework from
 * `attached_assets/Pasted--Aivo-Parent-Assessment-Design-Framework-...txt`:
 *  • Section 0 (Welcome) and 7 (Wrap-up) render as their own screens.
 *  • Sections 1–6 render as grouped question lists with a "why this section"
 *    rationale at the top — much friendlier on mobile than one-q-per-screen.
 *  • Every Likert ships a "Not sure / Haven't observed" escape hatch
 *    (framework §4: "Forcing parents to guess degrades data more than missing
 *    values do").
 *  • Optional sections show a Skip button.
 *  • Autosaves to localStorage on every change (debounced) so parents can
 *    drop and resume across sittings (framework §6).
 *  • Section chips at the top show progress by name, not just %.
 *  • Submission shape stays compatible with the existing `level-router`
 *    heuristic — see `mapCompat*` helpers and COMPAT_IDS in the question bank.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type AnswerValue = string | string[] | number | boolean | null;
interface Answers {
  [questionId: string]: AnswerValue;
  __other?: any;
}

const WELCOME = PARENT_ASSESSMENT_SECTIONS.find((s) => s.key === "welcome")!;
const WRAP_UP = PARENT_ASSESSMENT_SECTIONS.find((s) => s.key === "wrap_up")!;

/** Filter a section's question list down to those visible for the given age band.
 *  Used everywhere we count or render — keeps progress numerator/denominator
 *  in sync, and keeps age-targeted items hidden until DOB is collected. */
function visibleQuestions(s: AssessmentSection, band: AgeBand | null): AssessmentQuestion[] {
  return s.questions.filter((q) => isQuestionVisible(q, band));
}

function draftKey(learnerId: string) {
  return `aivo:parent-assessment:draft:${learnerId}`;
}

function isAnswered(q: AssessmentQuestion, value: AnswerValue): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function countAnswered(section: AssessmentSection, answers: Answers, band: AgeBand | null): number {
  return visibleQuestions(section, band).reduce(
    (n, q) => n + (isAnswered(q, answers[q.id] ?? null) ? 1 : 0),
    0,
  );
}

function countTotal(section: AssessmentSection, band: AgeBand | null): number {
  return visibleQuestions(section, band).length;
}

/** All currently visible required questions, in section/visible order.
 *  Used for submit-time validation — only consent and DOB are truly required
 *  per framework §7 Validation, but the model is generic. */
function collectMissingRequired(
  answers: Answers,
  band: AgeBand | null,
): { sectionIdx: number; questionId: string }[] {
  const missing: { sectionIdx: number; questionId: string }[] = [];
  for (let i = 0; i < REAL_SECTIONS.length; i++) {
    for (const q of visibleQuestions(REAL_SECTIONS[i], band)) {
      if (!q.required) continue;
      if (!isAnswered(q, answers[q.id] ?? null)) {
        missing.push({ sectionIdx: i, questionId: q.id });
      }
    }
  }
  return missing;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compat mappers — translate new question IDs into the legacy submission shape
// expected by services/assessment-svc/src/services/level-router.ts
// ─────────────────────────────────────────────────────────────────────────────

function mapCommunicationMode(answers: Answers): string {
  const v = answers[COMPAT_IDS.communicationMode] as string | undefined;
  if (!v) return "verbal";
  if (v.includes("speaks clearly")) return "verbal";
  if (v.includes("limited vocabulary")) return "limited_verbal";
  if (v.includes("Sign language")) return "sign_language";
  if (v.includes("Communication device") || v.includes("AAC")) return "aac_device";
  if (v.includes("Picture symbols")) return "aac_device";
  if (v.includes("Non-verbal")) return "non_verbal";
  if (v.includes("Gestures")) return "non_verbal";
  return "verbal";
}

function mapDeviceInteraction(answers: Answers): string {
  const v = answers[COMPAT_IDS.deviceInteraction] as string | undefined;
  if (!v) return "independent";
  if (v.startsWith("Standard")) return "independent";
  if (v.includes("larger touch")) return "guided";
  if (v.includes("occasional guidance")) return "guided";
  if (v.includes("Switch access")) return "switch_access";
  if (v.includes("Eye gaze")) return "eye_gaze";
  if (v.includes("Head tracking")) return "eye_gaze";
  if (v.includes("Voice control")) return "guided";
  if (v.startsWith("An adult")) return "partner_assisted";
  return "independent";
}

function mapResponseMethod(answers: Answers): string {
  const v = answers[COMPAT_IDS.responseMethod] as string | undefined;
  if (!v) return "touch_select";
  if (v.includes("Speaks")) return "voice";
  if (v.includes("short words")) return "voice";
  if (v.includes("Points") || v.includes("touches")) return "touch_select";
  if (v.includes("communication device") || v.includes("pictures")) return "switch_scan";
  if (v.includes("Looks") || v.includes("gazes")) return "partner_response";
  if (v.includes("interprets") || v.includes("Doesn't consistently")) return "partner_response";
  return "touch_select";
}

function mapAttentionSpan(answers: Answers): string {
  const v = answers[COMPAT_IDS.attentionSpan] as string | undefined;
  if (!v) return "typical";
  if (v.startsWith("Under 5")) return "very_short";
  if (v.startsWith("5–10")) return "short";
  if (v.startsWith("10–20")) return "variable";
  if (v.startsWith("20–30")) return "typical";
  if (v.startsWith("30+")) return "typical";
  return "variable";
}

function mapDiagnoses(answers: Answers): string[] {
  const v = answers[COMPAT_IDS.diagnoses];
  if (!Array.isArray(v) || v.length === 0) return [];
  const out = new Set<string>();
  for (const d of v) {
    if (typeof d !== "string") continue;
    if (d.startsWith("None") || d.startsWith("Prefer")) continue;
    if (d.startsWith("ADHD")) out.add("adhd");
    else if (d.startsWith("Autism")) out.add("asd");
    else if (d.startsWith("Dyslexia")) out.add("dyslexia");
    else if (d.startsWith("Dyscalculia")) out.add("dyscalculia");
    else if (d.startsWith("Speech")) out.add("speech_language");
    else if (d.startsWith("Hearing")) out.add("hearing");
    else if (d.startsWith("Vision")) out.add("vision");
    else if (d.startsWith("Anxiety")) out.add("anxiety");
    else if (d.startsWith("Depression")) out.add("depression");
    else if (d.startsWith("Currently")) out.add("under_evaluation");
    else out.add("other");
  }
  return Array.from(out);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Screen = "welcome" | "section" | "wrap_up";

export default function ParentAssessmentPage() {
  const { user, accessToken, loading, refreshToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("assessment");
  const tc = useTranslations("common");
  const learnerId = params.id as string;

  const [screen, setScreen] = useState<Screen>("welcome");
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0); // index into REAL_SECTIONS
  const [answers, setAnswers] = useState<Answers>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [baselineCompleted, setBaselineCompleted] = useState(false);
  const [learnerName, setLearnerName] = useState("");
  const [learnerFunctioningLevel, setLearnerFunctioningLevel] = useState("");
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confetti is fired when transitioning forward to a brand-new section
  // (not on initial load, not on skipping back). The trigger value bumps
  // each time so successive completions all play.
  const [confettiTrigger, setConfettiTrigger] = useState<number | null>(null);
  const previousSectionIdx = useRef<number>(0);

  // ── Auth gating ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user && user.role !== "PARENT") router.push("/");
  }, [user, loading, router]);

  // ── Load learner + completion status + any saved draft ──────────────────
  useEffect(() => {
    if (!accessToken || !user) return;
    (async () => {
      try {
        const [learnersRes, statusRes, baselineRes] = await Promise.all([
          fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } }),
          fetch(`/api/assessments/parent/${learnerId}/status`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          // Also probe the learner's baseline (discovery) status so the
          // already-completed screen can hide the "Start Baseline" CTA
          // when both intake and baseline are already done (e.g. when a
          // newly-invited caregiver lands here for an existing learner).
          fetch(`/api/assessments/learner/discovery/${learnerId}/status`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);
        if (learnersRes.ok) {
          const learners: any[] = await learnersRes.json();
          const found = learners.find((l: any) => l.id === learnerId);
          if (found) {
            setLearnerName(found.name || "");
            if (found.functioningLevel) setLearnerFunctioningLevel(found.functioningLevel);
          }
        }
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status?.completed) setAlreadyCompleted(true);
        }
        if (baselineRes.ok) {
          const bs = await baselineRes.json();
          if (bs?.baselineCompleted) setBaselineCompleted(true);
        }
      } catch {
        /* swallow — status check is best-effort */
      }

      // Restore draft from localStorage (framework §6: resumable across sittings)
      try {
        const raw =
          typeof window !== "undefined" ? localStorage.getItem(draftKey(learnerId)) : null;
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft?.answers) setAnswers(draft.answers);
          if (draft?.otherText) setOtherText(draft.otherText);
          if (typeof draft?.currentSectionIdx === "number")
            setCurrentSectionIdx(draft.currentSectionIdx);
          if (draft?.consentGiven) setScreen("section");
          setDraftRestored(true);
        }
      } catch {
        /* ignore corrupt drafts */
      }

      setCheckingStatus(false);
    })();
  }, [accessToken, user, learnerId]);

  // ── Autosave (debounced, 600ms after last change) ───────────────────────
  useEffect(() => {
    if (checkingStatus || alreadyCompleted || submitted) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(learnerId),
          JSON.stringify({
            answers,
            otherText,
            currentSectionIdx,
            consentGiven: !!answers["consent-1"],
            savedAt: Date.now(),
          }),
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    answers,
    otherText,
    currentSectionIdx,
    learnerId,
    checkingStatus,
    alreadyCompleted,
    submitted,
  ]);

  // ── Answer setters ──────────────────────────────────────────────────────
  const setAnswer = useCallback((id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);
  const toggleMulti = useCallback((id: string, opt: string) => {
    setAnswers((prev) => {
      const cur = (prev[id] as string[]) || [];
      return { ...prev, [id]: cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt] };
    });
  }, []);
  const setOther = useCallback((id: string, text: string) => {
    setOtherText((prev) => ({ ...prev, [id]: text }));
  }, []);

  const consentGiven = !!answers["consent-1"];
  // Derive the child's age band from DOB so age-targeted items appear/hide.
  // Falls back to null (= show everything) until DOB is provided.
  const currentBand = useMemo(
    () => bandFromDob(answers["ba-dob"] as string | undefined),
    [answers["ba-dob"]],
  );
  const visibleTotal = useMemo(
    () => REAL_SECTIONS.reduce((n, s) => n + countTotal(s, currentBand), 0),
    [currentBand],
  );
  const totalAnswered = useMemo(
    () => REAL_SECTIONS.reduce((n, s) => n + countAnswered(s, answers, currentBand), 0),
    [answers, currentBand],
  );
  const overallPct = visibleTotal > 0 ? Math.round((totalAnswered / visibleTotal) * 100) : 0;

  // ── Navigation ──────────────────────────────────────────────────────────
  const beginAssessment = () => {
    if (!consentGiven) return;
    setScreen("section");
    setCurrentSectionIdx(0);
  };

  const goToSection = (idx: number) => {
    setCurrentSectionIdx(idx);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNextSection = () => {
    if (currentSectionIdx < REAL_SECTIONS.length - 1) {
      // Celebrate completing this section — but only if the parent actually
      // engaged with it (any answer recorded). Skipped sections shouldn't
      // trigger fireworks.
      const finishedSection = REAL_SECTIONS[currentSectionIdx];
      const answered = countAnswered(finishedSection, answers, currentBand);
      if (answered > 0) {
        setConfettiTrigger(Date.now());
      }
      previousSectionIdx.current = currentSectionIdx + 1;
      goToSection(currentSectionIdx + 1);
    } else {
      // Final section → wrap-up. Always celebrate; this is a real milestone.
      setConfettiTrigger(Date.now());
      setScreen("wrap_up");
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goPrevSection = () => {
    if (currentSectionIdx > 0) goToSection(currentSectionIdx - 1);
    else setScreen("welcome");
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const submit = async () => {
    // Framework §7 Validation: only DOB and consent are hard-required, but
    // we surface any required-flagged item the parent missed and route them
    // back to the first one rather than silently submitting a partial form.
    if (!consentGiven) {
      setScreen("welcome");
      setSubmitError(t("error_consent_required"));
      return;
    }
    const missing = collectMissingRequired(answers, currentBand);
    if (missing.length > 0) {
      const first = missing[0];
      setScreen("section");
      setCurrentSectionIdx(first.sectionIdx);
      setSubmitError(
        missing.length === 1
          ? t("error_missing_required_one")
          : t("error_missing_required_many", { count: missing.length }),
      );
      // Scroll the missing field into view on next paint.
      setTimeout(() => {
        const el =
          typeof document !== "undefined" ? document.getElementById(`q-${first.questionId}`) : null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Merge any "Other" text fields back into the multi-select arrays under
      // a consistent suffix, so backend gets the final list with custom values.
      const enriched: Answers = { ...answers };
      for (const [id, txt] of Object.entries(otherText)) {
        if (txt && Array.isArray(enriched[id])) {
          enriched[id] = [...(enriched[id] as string[]), `Other: ${txt}`];
        } else if (txt) {
          enriched[`${id}__other`] = txt;
        }
      }

      // Long-form completion can outlive the access token. If the POST
      // fails 401 (token expired), refresh once via the auth-provider's
      // refresh-cookie hop and retry before surfacing an error to the parent.
      const doSubmit = async (token: string | null) =>
        fetch("/api/assessments/parent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            learnerId,
            communicationMode: mapCommunicationMode(enriched),
            deviceInteraction: mapDeviceInteraction(enriched),
            responseMethod: mapResponseMethod(enriched),
            attentionSpan: mapAttentionSpan(enriched),
            diagnoses: mapDiagnoses(enriched),
            additionalResponses: enriched,
          }),
        });

      let res = await doSubmit(accessToken);
      if (res.status === 401) {
        const fresh = await refreshToken();
        if (fresh) {
          res = await doSubmit(fresh);
        }
      }
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setSubmitted(true);
        try {
          localStorage.removeItem(draftKey(learnerId));
        } catch {
          /* ignore */
        }
      } else if (res.status === 401) {
        setSubmitError(t("session_expired_retry"));
      } else {
        const err = await res.json().catch(() => null);
        setSubmitError(err?.message || t("submission_failed"));
      }
    } catch {
      setSubmitError(t("network_error_retry"));
    }
    setSubmitting(false);
  };

  // ── Render guards ───────────────────────────────────────────────────────
  if (loading || !user || checkingStatus) return null;

  if (alreadyCompleted && !submitted)
    return (
      <AlreadyCompletedScreen
        learnerName={learnerName}
        learnerFunctioningLevel={learnerFunctioningLevel}
        baselineCompleted={baselineCompleted}
        onStartBaseline={() => router.push(`/dashboard/learner/assessment?learnerId=${learnerId}`)}
        onViewBrain={() => router.push(`/dashboard/parent/learner/${learnerId}/brain`)}
        onBackToProfile={() => router.push(`/dashboard/parent/learner/${learnerId}`)}
        onBackToDashboard={() => router.push("/dashboard/parent")}
        t={t}
      />
    );

  if (submitted && result)
    return (
      <SubmittedScreen
        result={result}
        onContinue={() => router.push(`/dashboard/parent`)}
        onContinueToBrain={() => router.push(`/dashboard/parent/learner/${learnerId}/brain-review`)}
        t={t}
      />
    );

  // ── Welcome screen (Section 0) ──────────────────────────────────────────
  if (screen === "welcome") {
    return (
      <div className="min-h-screen vi-bg">
        <Header
          learnerName={learnerName}
          totalAnswered={totalAnswered}
          totalVisible={visibleTotal}
          overallPct={overallPct}
          saveStatus={saveStatus}
          onBack={() => router.push("/dashboard/parent")}
          tc={tc}
          t={t}
        />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <WelcomeScreen
            learnerName={learnerName}
            consentGiven={consentGiven}
            draftRestored={draftRestored}
            onConsentChange={(v) => setAnswer("consent-1", v)}
            onBegin={beginAssessment}
            t={t}
          />
        </main>
      </div>
    );
  }

  // ── Wrap-up screen (Section 7) ──────────────────────────────────────────
  if (screen === "wrap_up") {
    return (
      <div className="min-h-screen vi-bg">
        <ConfettiBurst triggerKey={confettiTrigger} />
        <Header
          learnerName={learnerName}
          totalAnswered={totalAnswered}
          totalVisible={visibleTotal}
          overallPct={overallPct}
          saveStatus={saveStatus}
          onBack={() => router.push("/dashboard/parent")}
          tc={tc}
          t={t}
        />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
          <SectionJourneyGraphic
            sections={REAL_SECTIONS.map((s) => ({
              key: s.key,
              label: s.label,
              shortLabel: s.shortLabel,
              icon: s.icon,
            }))}
            currentIdx={REAL_SECTIONS.length}
            completed={REAL_SECTIONS.map(
              (s) => countAnswered(s, answers, currentBand) === countTotal(s, currentBand),
            )}
            onJump={(i) => {
              setScreen("section");
              goToSection(i);
            }}
          />
          <SectionProgressChips
            currentIdx={REAL_SECTIONS.length}
            answers={answers}
            band={currentBand}
            onJump={(i) => {
              setScreen("section");
              goToSection(i);
            }}
          />
          <WrapUpScreen
            section={WRAP_UP}
            answers={answers}
            learnerName={learnerName}
            learnerId={learnerId}
            accessToken={accessToken}
            onAnswer={setAnswer}
            onBack={() => {
              setScreen("section");
              goToSection(REAL_SECTIONS.length - 1);
            }}
            onSubmit={submit}
            submitting={submitting}
            submitError={submitError}
            sectionsAnsweredSummary={REAL_SECTIONS.map((s) => ({
              label: s.label,
              answered: countAnswered(s, answers, currentBand),
              total: countTotal(s, currentBand),
            }))}
            t={t}
          />
        </main>
      </div>
    );
  }

  // ── Section flow (Sections 1–6) ─────────────────────────────────────────
  const section = REAL_SECTIONS[currentSectionIdx];
  return (
    <div className="min-h-screen vi-bg">
      <ConfettiBurst triggerKey={confettiTrigger} />
      <Header
        learnerName={learnerName}
        totalAnswered={totalAnswered}
        totalVisible={visibleTotal}
        overallPct={overallPct}
        saveStatus={saveStatus}
        onBack={() => router.push("/dashboard/parent")}
        tc={tc}
        t={t}
      />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <SectionJourneyGraphic
          sections={REAL_SECTIONS.map((s) => ({
            key: s.key,
            label: s.label,
            shortLabel: s.shortLabel,
            icon: s.icon,
          }))}
          currentIdx={currentSectionIdx}
          completed={REAL_SECTIONS.map(
            (s) => countAnswered(s, answers, currentBand) === countTotal(s, currentBand),
          )}
          onJump={goToSection}
        />
        <SectionProgressChips
          currentIdx={currentSectionIdx}
          answers={answers}
          band={currentBand}
          onJump={goToSection}
        />

        <SectionView
          section={section}
          answers={answers}
          band={currentBand}
          otherText={otherText}
          onAnswer={setAnswer}
          onToggleMulti={toggleMulti}
          onOtherChange={setOther}
        />

        {submitError && (
          <div
            className="vi-card p-3 text-sm font-semibold text-center"
            style={{
              background: "hsl(0 72% 51% / 0.06)",
              borderColor: "hsl(0 72% 51% / 0.3)",
              color: "hsl(0 72% 51%)",
            }}
          >
            {submitError}
          </div>
        )}

        <SectionFooterNav
          isFirst={currentSectionIdx === 0}
          isLast={currentSectionIdx === REAL_SECTIONS.length - 1}
          isOptional={!!section.optional}
          onPrev={goPrevSection}
          onNext={goNextSection}
          onSkip={goNextSection}
          t={t}
        />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function Header({
  learnerName,
  totalAnswered,
  totalVisible,
  overallPct,
  saveStatus,
  onBack,
  tc,
  t,
}: {
  learnerName: string;
  totalAnswered: number;
  totalVisible: number;
  overallPct: number;
  saveStatus: "idle" | "saving" | "saved";
  onBack: () => void;
  tc: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <header className="bg-[hsl(var(--visual-surface))] border-b vi-border sticky top-0 z-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold vi-text-muted hover:vi-surface-soft transition-colors"
          style={{ minHeight: "40px" }}
        >
          <ArrowLeft className="w-4 h-4" /> {tc("back")}
        </button>
        <div className="hidden sm:flex items-center gap-2 min-w-0">
          <IconWell color="primary" size="sm">
            <Sparkles className="w-4 h-4" strokeWidth={2.5} />
          </IconWell>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider vi-text-muted opacity-70 truncate">
              {t("header_eyebrow")}
            </p>
            <p className="text-sm font-extrabold vi-text truncate">
              {learnerName
                ? t("header_title_with_name", { name: learnerName })
                : t("header_title_default")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <SaveIndicator status={saveStatus} t={t} />
          <div className="text-xs font-bold vi-text-muted vi-surface-soft px-3 py-1.5 rounded-full whitespace-nowrap tabular-nums">
            {totalAnswered}/{totalVisible}
          </div>
        </div>
      </div>
      <div className="h-1.5 vi-surface-soft">
        <div
          className="h-full bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(43_100%_50%)] rounded-r-full transition-all duration-300"
          style={{ width: `${overallPct}%` }}
        />
      </div>
    </header>
  );
}

function SaveIndicator({
  status,
  t,
}: {
  status: "idle" | "saving" | "saved";
  t: ReturnType<typeof useTranslations>;
}) {
  if (status === "idle") return null;
  const isSaving = status === "saving";
  return (
    <span
      className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold vi-text-muted whitespace-nowrap"
      aria-live="polite"
    >
      {isSaving ? (
        <Cloud className="w-3.5 h-3.5 animate-pulse" />
      ) : (
        <CloudOff className="w-3.5 h-3.5 opacity-60" />
      )}
      {isSaving ? t("save_saving") : t("save_saved")}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Welcome screen
// ─────────────────────────────────────────────────────────────────────────────

function WelcomeScreen({
  learnerName,
  consentGiven,
  draftRestored,
  onConsentChange,
  onBegin,
  t,
}: {
  learnerName: string;
  consentGiven: boolean;
  draftRestored: boolean;
  onConsentChange: (v: boolean) => void;
  onBegin: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <section className="vi-card p-6 sm:p-8 relative overflow-hidden">
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl"
        aria-hidden
      />
      <div className="relative space-y-5">
        <div className="flex items-start gap-3">
          <IconWell color="primary" size="lg">
            <Heart className="w-7 h-7" strokeWidth={2.5} />
          </IconWell>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(262_83%_58%)] mb-1">
              {t("welcome_eyebrow")}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold vi-text leading-tight">
              {learnerName
                ? t("header_title_with_name", { name: learnerName })
                : t("header_title_default")}
            </h1>
            <p className="vi-text-muted mt-2 text-sm sm:text-base leading-relaxed">
              {t("welcome_intro")}
            </p>
          </div>
        </div>

        {draftRestored && (
          <div
            className="vi-card p-3 flex items-center gap-2 text-sm"
            style={{ background: "hsl(142 71% 45% / 0.08)", borderColor: "hsl(142 71% 45% / 0.3)" }}
          >
            <Save className="w-4 h-4 text-[hsl(142_71%_45%)] flex-shrink-0" />
            <span className="vi-text">{t("welcome_draft_restored")}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Stat icon="⏱" label={t("welcome_stat_minutes")} />
          <Stat icon="📑" label={t("welcome_stat_sections")} />
          <Stat icon="💾" label={t("welcome_stat_autosave")} />
        </div>

        <div className="vi-card p-4 vi-surface-soft text-left">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[hsl(262_83%_58%)] mb-2">
            {t("welcome_what_we_ask")}
          </p>
          <ul className="text-sm vi-text space-y-1.5">
            <li>• {t("welcome_bullet_strengths")}</li>
            <li>• {t("welcome_bullet_communicate")}</li>
            <li>• {t("welcome_bullet_learn")}</li>
            <li>• {t("welcome_bullet_help")}</li>
          </ul>
        </div>

        <label
          className="vi-card p-4 flex items-start gap-3 cursor-pointer transition-all"
          style={{ borderColor: consentGiven ? "hsl(262 83% 58% / 0.5)" : undefined }}
        >
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[hsl(262_83%_58%)] flex-shrink-0"
          />
          <span className="text-sm vi-text flex-1">
            <ShieldCheck className="inline w-4 h-4 mr-1 text-[hsl(262_83%_58%)]" />
            <span className="font-bold">{t("welcome_consent_understand")}</span>
            {t("welcome_consent_text")}
          </span>
        </label>

        <button
          onClick={onBegin}
          disabled={!consentGiven}
          className="w-full inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold shadow-xl shadow-[hsl(262_83%_58%/0.3)] hover:scale-[1.01] active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          style={{ minHeight: "52px" }}
        >
          {draftRestored ? t("welcome_continue") : t("welcome_begin")}{" "}
          <ChevronRight className="w-5 h-5" />
        </button>
        <p className="text-xs vi-text-muted text-center opacity-70">{t("welcome_skip_note")}</p>
      </div>
    </section>
  );
}

function Stat({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="vi-card p-3 vi-surface-soft text-center">
      <div className="text-xl mb-0.5">{icon}</div>
      <div className="text-xs font-bold vi-text">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section progress chips (top of every section/wrap-up screen)
// ─────────────────────────────────────────────────────────────────────────────

function SectionProgressChips({
  currentIdx,
  answers,
  band,
  onJump,
}: {
  currentIdx: number;
  answers: Answers;
  band: AgeBand | null;
  onJump: (i: number) => void;
}) {
  const t = useTranslations("assessment");
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {REAL_SECTIONS.map((s, idx) => {
        const answered = countAnswered(s, answers, band);
        const total = countTotal(s, band);
        const isComplete = answered === total;
        const isCurrent = idx === currentIdx;
        return (
          <button
            key={s.key}
            onClick={() => onJump(idx)}
            aria-pressed={isCurrent}
            aria-label={t("chip_aria", { number: s.number, label: s.label, answered, total })}
            className={[
              "flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-full border-2 text-xs font-bold transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%/0.4)]",
              isCurrent
                ? "bg-[hsl(262_83%_58%/0.12)] border-[hsl(262_83%_58%)] text-[hsl(262_83%_58%)]"
                : isComplete
                  ? "bg-[hsl(142_71%_45%/0.10)] border-[hsl(142_71%_45%/0.30)] text-[hsl(142_71%_45%)]"
                  : "bg-[hsl(var(--visual-surface))] vi-border vi-text-muted",
            ].join(" ")}
          >
            <span className="text-base leading-none" aria-hidden>
              {s.icon}
            </span>
            <span className="whitespace-nowrap">{s.shortLabel}</span>
            {isComplete ? (
              <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
            ) : (
              <span className="text-[10px] tabular-nums opacity-70">
                {answered}/{total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionView — renders all questions of one section grouped on one screen
// ─────────────────────────────────────────────────────────────────────────────

function SectionView({
  section,
  answers,
  band,
  otherText,
  onAnswer,
  onToggleMulti,
  onOtherChange,
}: {
  section: AssessmentSection;
  answers: Answers;
  band: AgeBand | null;
  otherText: Record<string, string>;
  onAnswer: (id: string, value: AnswerValue) => void;
  onToggleMulti: (id: string, opt: string) => void;
  onOtherChange: (id: string, text: string) => void;
}) {
  const visible = visibleQuestions(section, band);
  const t = useTranslations("assessment");
  return (
    <section className="vi-card p-6 sm:p-7 space-y-6">
      <div className="flex items-start gap-3 pb-5 border-b vi-border">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ backgroundColor: "hsl(262 83% 58% / 0.12)" }}
          aria-hidden
        >
          {section.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(262_83%_58%)] mb-1">
            {t("section_header", { number: section.number, minutes: section.estimatedMinutes })}
            {section.optional && (
              <span className="ml-2 text-[hsl(43_100%_50%)]">· {t("question_optional")}</span>
            )}
          </p>
          <h2 className="text-xl sm:text-2xl font-extrabold vi-text leading-tight">
            {section.label}
          </h2>
          <p className="vi-text-muted text-sm mt-1.5 leading-relaxed">{section.rationale}</p>
        </div>
      </div>

      <ol className="space-y-7 list-none">
        {visible.map((q, idx) => (
          <li key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
            <QuestionBlock
              question={q}
              questionNumber={idx + 1}
              value={answers[q.id] ?? null}
              otherValue={otherText[q.id] ?? ""}
              onAnswer={(v) => onAnswer(q.id, v)}
              onToggleMulti={(opt) => onToggleMulti(q.id, opt)}
              onOtherChange={(t) => onOtherChange(q.id, t)}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

function QuestionBlock({
  question: q,
  questionNumber,
  value,
  otherValue,
  onAnswer,
  onToggleMulti,
  onOtherChange,
}: {
  question: AssessmentQuestion;
  questionNumber: number;
  value: AnswerValue;
  otherValue: string;
  onAnswer: (v: AnswerValue) => void;
  onToggleMulti: (opt: string) => void;
  onOtherChange: (t: string) => void;
}) {
  const labelId = `q-${q.id}-label`;
  const t = useTranslations("assessment");
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-xs font-extrabold tabular-nums vi-text-muted opacity-70 w-5 flex-shrink-0"
          aria-hidden
        >
          {questionNumber}.
        </span>
        <h3
          id={labelId}
          className="text-base sm:text-lg font-extrabold vi-text leading-snug flex-1"
        >
          {q.text}
          {q.required && (
            <span className="ml-1.5 text-[hsl(0_72%_51%)]" aria-label={t("question_required_aria")}>
              *
            </span>
          )}
          {!q.required && (
            <span className="ml-2 text-[10px] font-bold uppercase tracking-wider vi-text-muted opacity-60">
              {t("question_optional")}
            </span>
          )}
        </h3>
      </div>
      {q.helpText && (
        <p className="ml-7 mb-3 text-xs vi-text-muted italic flex items-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-70" />
          <span>{q.helpText}</span>
        </p>
      )}
      <div className="ml-0 sm:ml-7 mt-3">
        <QuestionInput
          q={q}
          labelId={labelId}
          value={value}
          otherValue={otherValue}
          onAnswer={onAnswer}
          onToggleMulti={onToggleMulti}
          onOtherChange={onOtherChange}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionInput — switch on question type
// ─────────────────────────────────────────────────────────────────────────────

function QuestionInput({
  q,
  labelId,
  value,
  otherValue,
  onAnswer,
  onToggleMulti,
  onOtherChange,
}: {
  q: AssessmentQuestion;
  labelId: string;
  value: AnswerValue;
  otherValue: string;
  onAnswer: (v: AnswerValue) => void;
  onToggleMulti: (opt: string) => void;
  onOtherChange: (t: string) => void;
}) {
  const t = useTranslations("assessment");
  switch (q.type) {
    case "consent_checkbox":
      return null; // Handled inline on the Welcome screen.

    case "date":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full sm:w-auto rounded-2xl border-2 vi-border px-4 py-3 text-base vi-text font-semibold focus:outline-none focus:border-[hsl(262_83%_58%)] transition-colors"
          style={{ minHeight: "44px" }}
        />
      );

    case "open_short":
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder={t("input_placeholder_default")}
          className="w-full rounded-2xl border-2 vi-border px-4 py-3 text-base vi-text placeholder-[hsl(var(--visual-text-muted))] focus:outline-none focus:border-[hsl(262_83%_58%)] transition-colors"
          style={{ minHeight: "44px" }}
        />
      );

    case "open_long":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onAnswer(e.target.value)}
          placeholder={t("input_placeholder_long")}
          rows={3}
          className="w-full rounded-2xl border-2 vi-border p-4 text-sm vi-text placeholder-[hsl(var(--visual-text-muted))] focus:outline-none focus:border-[hsl(262_83%_58%)] resize-y transition-colors"
        />
      );

    case "yes_no": {
      // Stable internal values keep backend payload language-agnostic;
      // labels are translated for the UI only.
      const yesNoOpts: { value: string; label: string }[] = [
        { value: "Yes", label: t("yes_no_yes") },
        { value: "No", label: t("yes_no_no") },
        { value: "Prefer not to say", label: t("yes_no_prefer_not") },
      ];
      return (
        <div className="flex gap-2 flex-wrap">
          {yesNoOpts.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onAnswer(opt.value)}
                aria-pressed={selected}
                className={[
                  "px-5 py-2.5 rounded-full border-2 text-sm font-extrabold transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%/0.4)]",
                  selected
                    ? "bg-[hsl(262_83%_58%)] border-[hsl(262_83%_58%)] text-white"
                    : "bg-[hsl(var(--visual-surface))] vi-border vi-text-muted hover:border-[hsl(262_83%_58%/0.4)]",
                ].join(" ")}
                style={{ minHeight: "44px" }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }

    case "single_select":
      return (
        <SingleSelect
          options={q.options || []}
          value={(value as string) ?? null}
          onChange={onAnswer}
          allowOther={!!q.allowOther}
          otherValue={otherValue}
          onOtherChange={onOtherChange}
        />
      );

    case "multi_select":
      return (
        <MultiSelect
          options={q.options || []}
          values={(value as string[]) || []}
          onToggle={onToggleMulti}
          allowOther={!!q.allowOther}
          otherValue={otherValue}
          onOtherChange={onOtherChange}
        />
      );

    case "likert5_with_unsure":
      return (
        <LikertFiveWithUnsure
          labelledBy={labelId}
          value={(value as string) ?? null}
          onChange={onAnswer}
        />
      );

    case "rank_top_three":
      return (
        <RankTopThree
          labelledBy={labelId}
          options={q.options || []}
          value={(value as string[]) || []}
          onChange={onAnswer}
        />
      );

    default:
      return null;
  }
}

// ─── Single-select (radio-style) ────────────────────────────────────────────
function SingleSelect({
  options,
  value,
  onChange,
  allowOther,
  otherValue,
  onOtherChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  allowOther: boolean;
  otherValue: string;
  onOtherChange: (t: string) => void;
}) {
  return (
    <div className="space-y-2" role="radiogroup">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            role="radio"
            aria-checked={selected}
            className={[
              "w-full flex items-center gap-3 text-left px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%/0.4)]",
              selected
                ? "bg-[hsl(262_83%_58%/0.10)] border-[hsl(262_83%_58%)] vi-text"
                : "bg-[hsl(var(--visual-surface))] vi-border vi-text-muted hover:border-[hsl(262_83%_58%/0.4)] hover:vi-text",
            ].join(" ")}
            style={{ minHeight: "48px" }}
          >
            <span
              className={[
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                selected ? "bg-[hsl(262_83%_58%)] border-[hsl(262_83%_58%)]" : "vi-border",
              ].join(" ")}
            >
              {selected && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            <span className="font-bold flex-1">{opt}</span>
          </button>
        );
      })}
      {allowOther && value === "Other" && (
        <OtherInput value={otherValue} onChange={onOtherChange} />
      )}
    </div>
  );
}

// ─── "Other" free-text input (i18n placeholder) ─────────────────────────────
function OtherInput({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const t = useTranslations("assessment");
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("input_placeholder_other_more")}
      className="w-full rounded-2xl border-2 vi-border px-4 py-3 text-sm vi-text placeholder-[hsl(var(--visual-text-muted))] focus:outline-none focus:border-[hsl(262_83%_58%)]"
      style={{ minHeight: "44px" }}
    />
  );
}

// ─── Multi-select (checkbox-style) ──────────────────────────────────────────
function MultiSelect({
  options,
  values,
  onToggle,
  allowOther,
  otherValue,
  onOtherChange,
}: {
  options: string[];
  values: string[];
  onToggle: (opt: string) => void;
  allowOther: boolean;
  otherValue: string;
  onOtherChange: (t: string) => void;
}) {
  const t = useTranslations("assessment");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group">
        {options.map((opt) => {
          const selected = values.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              aria-pressed={selected}
              className={[
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%/0.4)]",
                selected
                  ? "bg-[hsl(262_83%_58%/0.10)] border-[hsl(262_83%_58%)] text-[hsl(262_83%_58%)]"
                  : "bg-[hsl(var(--visual-surface))] vi-border vi-text-muted hover:border-[hsl(262_83%_58%/0.4)]",
              ].join(" ")}
              style={{ minHeight: "44px" }}
            >
              {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {allowOther && (
        <input
          type="text"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder={t("input_placeholder_other_optional")}
          className="w-full rounded-2xl border-2 vi-border px-4 py-3 text-sm vi-text placeholder-[hsl(var(--visual-text-muted))] focus:outline-none focus:border-[hsl(262_83%_58%)]"
          style={{ minHeight: "44px" }}
        />
      )}
    </div>
  );
}

// ─── 5-point frequency Likert with mandatory "Not sure" escape hatch ────────
function LikertFiveWithUnsure({
  labelledBy,
  value,
  onChange,
}: {
  labelledBy: string;
  value: string | null;
  onChange: (v: string) => void;
}) {
  const isUnsure = value === NOT_SURE_VALUE;
  const t = useTranslations("assessment");
  const notSureLabel = t("likert_not_sure");
  // Translate Likert anchors but keep payload values stable (lib constants).
  const likertI18nKeys: Record<string, string> = {
    Never: "likert_never",
    Rarely: "likert_rarely",
    Sometimes: "likert_sometimes",
    Often: "likert_often",
    Always: "likert_always",
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="space-y-2">
      <div className="grid grid-cols-5 gap-1.5">
        {LIKERT5_LABELS.map((label) => {
          const selected = value === label;
          const displayLabel = likertI18nKeys[label] ? t(likertI18nKeys[label]) : label;
          return (
            <button
              key={label}
              onClick={() => onChange(label)}
              role="radio"
              aria-checked={selected}
              aria-label={displayLabel}
              className={[
                "px-2 py-3 rounded-2xl border-2 text-xs font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%/0.4)]",
                selected
                  ? "bg-[hsl(262_83%_58%)] border-[hsl(262_83%_58%)] text-white scale-105"
                  : "bg-[hsl(var(--visual-surface))] vi-border vi-text-muted hover:border-[hsl(262_83%_58%/0.4)]",
              ].join(" ")}
              style={{ minHeight: "52px" }}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onChange(NOT_SURE_VALUE)}
        role="radio"
        aria-checked={isUnsure}
        aria-label={notSureLabel}
        className={[
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(43_100%_50%/0.4)]",
          isUnsure
            ? "bg-[hsl(43_100%_50%/0.15)] border-[hsl(43_100%_50%)] text-[hsl(43_100%_50%)]"
            : "vi-border vi-text-muted opacity-70 hover:opacity-100",
        ].join(" ")}
      >
        <HelpCircle className="w-3 h-3" /> {notSureLabel}
      </button>
    </div>
  );
}

// ─── Rank top three (drag-and-drop with arrow controls as fallback) ─────────
function RankTopThree({
  labelledBy,
  options,
  value,
  onChange,
}: {
  labelledBy: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const picked = value.slice(0, 3);
  const isPicked = (opt: string) => picked.includes(opt);

  const togglePick = (opt: string) => {
    if (isPicked(opt)) onChange(picked.filter((p) => p !== opt));
    else if (picked.length < 3) onChange([...picked, opt]);
  };

  const t = useTranslations("assessment");
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...picked];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs vi-text-muted">
        <ListChecks className="inline w-3.5 h-3.5 mr-1" />
        {t("rank_instructions")}
      </p>

      {picked.length > 0 && (
        <div className="vi-card p-3 vi-surface-soft space-y-2">
          {picked.map((p, i) => (
            <div
              key={p}
              className="flex items-center gap-2 vi-card p-2 bg-[hsl(var(--visual-surface))]"
            >
              <GripVertical className="w-4 h-4 vi-text-muted opacity-40" />
              <span className="w-6 h-6 rounded-full bg-[hsl(262_83%_58%)] text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-bold vi-text">{p}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={t("rank_move_up", { item: p })}
                className="p-1 rounded-full vi-text-muted disabled:opacity-20 hover:vi-text"
              >
                <ChevronLeft className="w-4 h-4 -rotate-90" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === picked.length - 1}
                aria-label={t("rank_move_down", { item: p })}
                className="p-1 rounded-full vi-text-muted disabled:opacity-20 hover:vi-text"
              >
                <ChevronRight className="w-4 h-4 rotate-90" />
              </button>
              <button
                onClick={() => togglePick(p)}
                aria-label={t("rank_remove_aria", { item: p })}
                className="px-2 py-1 rounded-full text-[10px] font-bold vi-text-muted hover:text-[hsl(0_72%_51%)]"
              >
                {t("rank_remove")}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = isPicked(opt);
          const disabled = !selected && picked.length >= 3;
          return (
            <button
              key={opt}
              onClick={() => togglePick(opt)}
              disabled={disabled}
              aria-pressed={selected}
              className={[
                "inline-flex items-center gap-2 px-4 py-2.5 rounded-full border-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%/0.4)]",
                selected
                  ? "bg-[hsl(262_83%_58%)] border-[hsl(262_83%_58%)] text-white"
                  : disabled
                    ? "vi-border vi-text-muted opacity-40 cursor-not-allowed"
                    : "bg-[hsl(var(--visual-surface))] vi-border vi-text-muted hover:border-[hsl(262_83%_58%/0.4)]",
              ].join(" ")}
              style={{ minHeight: "40px" }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section footer nav (prev / next / skip)
// ─────────────────────────────────────────────────────────────────────────────

function SectionFooterNav({
  isFirst,
  isLast,
  isOptional,
  onPrev,
  onNext,
  onSkip,
  t,
}: {
  isFirst: boolean;
  isLast: boolean;
  isOptional: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <button
        onClick={onPrev}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold vi-text-muted hover:vi-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(262_83%_58%/0.4)]"
        style={{ minHeight: "44px" }}
      >
        <ChevronLeft className="w-4 h-4" /> {isFirst ? t("nav_back_to_welcome") : t("nav_previous")}
      </button>
      <div className="flex gap-2">
        {isOptional && (
          <button
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold vi-text-muted hover:vi-surface-soft transition-colors"
            style={{ minHeight: "44px" }}
          >
            {t("nav_skip_for_now")}
          </button>
        )}
        <button
          onClick={onNext}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold text-sm shadow-lg shadow-[hsl(262_83%_58%/0.3)] hover:scale-105 active:scale-95 transition-transform"
          style={{ minHeight: "44px" }}
        >
          {isLast ? t("nav_almost_done") : t("nav_next")} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InviteCoParentWidget — wu-coparent: lets the parent send a real invite
// (email + role) instead of just answering a single-select.
// ─────────────────────────────────────────────────────────────────────────────

function InviteCoParentWidget({
  question,
  questionNumber,
  value,
  onAnswer,
  learnerId,
  accessToken,
  t,
}: {
  question: AssessmentQuestion;
  questionNumber: number;
  value: AnswerValue;
  onAnswer: (v: AnswerValue) => void;
  learnerId: string;
  accessToken: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  const options = question.options ?? [];
  const yesOpt = options[0] ?? "Yes — send me a link";
  const laterOpt = options[1] ?? "Maybe later";
  const noOpt = options[2] ?? "No, just me";

  const [role, setRole] = useState<"coparent" | "teacher">("coparent");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ role: "coparent" | "teacher"; email: string }[]>([]);

  const isYes = value === yesOpt;

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !email.trim()) return;
    setSending(true);
    setError(null);
    try {
      const endpoint = role === "teacher" ? "teacher" : "caregiver";
      const body: Record<string, string> = { email: email.trim() };
      if (role === "coparent") body.relationship = "Co-parent";
      const res = await fetch(`/api/family/collaboration/${learnerId}/invite/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSent((prev) => [...prev, { role, email: email.trim() }]);
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("invite_error_generic"));
      }
    } catch {
      setError(t("invite_error_network"));
    }
    setSending(false);
  };

  return (
    <div
      className="vi-card p-5 space-y-4"
      style={{ background: "hsl(262 83% 58% / 0.04)", borderColor: "hsl(262 83% 58% / 0.25)" }}
    >
      <div className="flex items-start gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(262_83%_58%)] text-white text-xs font-extrabold flex-shrink-0">
          {questionNumber}
        </span>
        <p className="font-bold vi-text leading-snug">{question.text}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[yesOpt, laterOpt, noOpt].map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onAnswer(opt)}
              className={[
                "px-3 py-2.5 rounded-xl text-sm font-bold border transition text-center",
                selected
                  ? "bg-[hsl(262_83%_58%)] text-white border-[hsl(262_83%_58%)] shadow-sm"
                  : "vi-surface-soft vi-text vi-border hover:border-[hsl(262_83%_58%/0.5)]",
              ].join(" ")}
              style={{ minHeight: "44px" }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {isYes && (
        <form onSubmit={sendInvite} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider vi-text-muted mb-1.5">
              {t("invite_role_label")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "coparent" as const, label: t("invite_role_coparent") },
                { key: "teacher" as const, label: t("invite_role_teacher") },
              ].map(({ key, label }) => {
                const selected = role === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRole(key)}
                    className={[
                      "px-3 py-2 rounded-lg text-sm font-bold border transition",
                      selected
                        ? "bg-[hsl(199_89%_48%)] text-white border-[hsl(199_89%_48%)]"
                        : "vi-surface-soft vi-text vi-border hover:border-[hsl(199_89%_48%/0.5)]",
                    ].join(" ")}
                    style={{ minHeight: "40px" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="wu-coparent-email"
              className="block text-xs font-bold uppercase tracking-wider vi-text-muted mb-1.5"
            >
              {t("invite_email_label")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="wu-coparent-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("invite_email_placeholder")}
                className="flex-1 px-4 py-2.5 rounded-xl border vi-border focus:border-[hsl(199_89%_48%)] focus:ring-2 focus:ring-[hsl(199_89%_48%/0.2)] outline-none font-body bg-white"
                style={{ minHeight: "44px" }}
              />
              <button
                type="submit"
                disabled={sending || !email.trim() || !accessToken}
                className="px-5 py-2.5 rounded-xl bg-[hsl(199_89%_48%)] text-white font-bold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ minHeight: "44px" }}
              >
                {sending ? t("invite_sending") : t("invite_send")}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: "hsl(0 72% 51% / 0.08)", color: "hsl(0 72% 51%)" }}
            >
              {error}
            </div>
          )}

          {sent.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {sent.map((s, i) => (
                <li
                  key={`${s.email}-${i}`}
                  className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg"
                  style={{ background: "hsl(142 71% 45% / 0.10)", color: "hsl(142 71% 45%)" }}
                >
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  <span>
                    {t("invite_sent_to", {
                      role:
                        s.role === "teacher" ? t("invite_role_teacher") : t("invite_role_coparent"),
                      email: s.email,
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] vi-text-muted">{t("invite_helper")}</p>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WrapUpScreen (Section 7)
// ─────────────────────────────────────────────────────────────────────────────

function WrapUpScreen({
  section,
  answers,
  learnerName,
  learnerId,
  accessToken,
  onAnswer,
  onBack,
  onSubmit,
  submitting,
  submitError,
  sectionsAnsweredSummary,
  t,
}: {
  section: AssessmentSection;
  answers: Answers;
  learnerName: string;
  learnerId: string;
  accessToken: string | null;
  onAnswer: (id: string, value: AnswerValue) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
  sectionsAnsweredSummary: { label: string; answered: number; total: number }[];
  t: ReturnType<typeof useTranslations>;
}) {
  const totalAnswered = sectionsAnsweredSummary.reduce((n, s) => n + s.answered, 0);
  const totalQs = sectionsAnsweredSummary.reduce((n, s) => n + s.total, 0);
  const pct = Math.round((totalAnswered / totalQs) * 100);

  return (
    <section className="vi-card p-6 sm:p-8 space-y-5 relative overflow-hidden">
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl"
        aria-hidden
      />
      <div className="relative space-y-5">
        <div className="flex items-start gap-3">
          <IconWell color="sel" size="lg">
            <Sparkles className="w-7 h-7" strokeWidth={2.5} />
          </IconWell>
          <div className="flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(43_100%_50%)] mb-1">
              {t("wrap_up_eyebrow")}
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold vi-text leading-tight">
              {section.label}
            </h2>
            <p className="vi-text-muted mt-2 text-sm leading-relaxed">{section.rationale}</p>
          </div>
        </div>

        <div className="vi-card p-4 vi-surface-soft">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(262_83%_58%)] mb-2">
            {t("wrap_up_summary_title")}
          </p>
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl font-extrabold vi-text tabular-nums">{pct}%</div>
            <div className="flex-1">
              <div className="h-2 vi-surface-soft rounded-full overflow-hidden bg-[hsl(var(--visual-border))]">
                <div
                  className="h-full bg-[hsl(142_71%_45%)] transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] vi-text-muted mt-1">
                {t("wrap_up_summary_progress", { answered: totalAnswered, total: totalQs })}
              </p>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-1.5">
            {sectionsAnsweredSummary.map((s) => {
              const complete = s.answered === s.total;
              const partial = s.answered > 0 && !complete;
              return (
                <li
                  key={s.label}
                  className={[
                    "flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-md",
                    complete
                      ? "text-[hsl(142_71%_45%)]"
                      : partial
                        ? "vi-text"
                        : "vi-text-muted opacity-60",
                  ].join(" ")}
                >
                  {complete ? (
                    <Check className="w-3 h-3" strokeWidth={3} />
                  ) : (
                    <span className="w-3 h-3" />
                  )}
                  <span className="truncate">{s.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Final wrap-up questions */}
        <div className="space-y-5">
          {section.questions.map((q, idx) => {
            if (q.id === "wu-coparent") {
              return (
                <InviteCoParentWidget
                  key={q.id}
                  question={q}
                  questionNumber={idx + 1}
                  value={answers[q.id] ?? null}
                  onAnswer={(v) => onAnswer(q.id, v)}
                  learnerId={learnerId}
                  accessToken={accessToken}
                  t={t}
                />
              );
            }
            return (
              <QuestionBlock
                key={q.id}
                question={q}
                questionNumber={idx + 1}
                value={answers[q.id] ?? null}
                otherValue=""
                onAnswer={(v) => onAnswer(q.id, v)}
                onToggleMulti={() => {
                  /* not used in wrap-up */
                }}
                onOtherChange={() => {
                  /* not used in wrap-up */
                }}
              />
            );
          })}
        </div>

        {submitError && (
          <div
            className="vi-card p-3 text-sm font-semibold text-center"
            style={{
              background: "hsl(0 72% 51% / 0.06)",
              borderColor: "hsl(0 72% 51% / 0.3)",
              color: "hsl(0 72% 51%)",
            }}
          >
            {submitError}
          </div>
        )}

        <div
          className="vi-card p-3 flex items-start gap-2 text-xs vi-text"
          style={{ background: "hsl(43 100% 50% / 0.06)", borderColor: "hsl(43 100% 50% / 0.3)" }}
        >
          <ShieldCheck className="w-4 h-4 text-[hsl(43_100%_50%)] flex-shrink-0 mt-0.5" />
          <span>
            {learnerName
              ? t("wrap_up_baseline_note_with_name", { name: learnerName })
              : t("wrap_up_baseline_note_default")}
          </span>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-bold vi-text-muted hover:vi-surface-soft transition-colors"
            style={{ minHeight: "44px" }}
          >
            <ChevronLeft className="w-4 h-4" /> {t("nav_back")}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 px-7 py-3 rounded-full bg-[hsl(142_71%_45%)] text-white font-extrabold text-sm shadow-lg shadow-[hsl(142_71%_45%/0.3)] hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "48px" }}
          >
            {submitting ? (
              t("wrap_up_submitting")
            ) : (
              <>
                {t("wrap_up_submit")} <Check className="w-4 h-4" strokeWidth={3} />
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Already-completed and Submitted screens (preserved from previous design)
// ─────────────────────────────────────────────────────────────────────────────

function AlreadyCompletedScreen({
  learnerName,
  learnerFunctioningLevel,
  baselineCompleted,
  onStartBaseline,
  onViewBrain,
  onBackToProfile,
  onBackToDashboard,
  t,
}: {
  learnerName: string;
  learnerFunctioningLevel: string;
  baselineCompleted: boolean;
  onStartBaseline: () => void;
  onViewBrain: () => void;
  onBackToProfile: () => void;
  onBackToDashboard: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="min-h-screen vi-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        <section className="vi-card p-8 md:p-10 text-center relative overflow-hidden">
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl"
            aria-hidden
          />
          <div className="relative space-y-5">
            <div className="mx-auto inline-flex">
              <IconWell color="science" size="lg">
                <CheckCircle2 className="w-10 h-10" strokeWidth={2.5} />
              </IconWell>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(142_71%_45%)] mb-2">
                {t("already_done_eyebrow")}
              </p>
              <h1 className="text-2xl font-extrabold vi-text">
                {baselineCompleted
                  ? t("all_assessments_complete_title")
                  : t("already_complete_title")}
              </h1>
              <p className="vi-text-muted mt-2">
                {baselineCompleted
                  ? t("all_assessments_complete_desc", { name: learnerName || t("this_learner") })
                  : t("already_complete_desc", { name: learnerName || t("this_learner") })}
              </p>
            </div>
            {learnerFunctioningLevel && (
              <div className="vi-card p-4 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(262_83%_58%)]">
                  {t("functioning_level_label")}
                </p>
                <p className="text-lg font-extrabold vi-text mt-1">
                  {learnerFunctioningLevel
                    .replace(/_/g, " ")
                    .toLowerCase()
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
              </div>
            )}
            {!baselineCompleted && (
              <div
                className="vi-card p-4 text-left"
                style={{
                  background: "hsl(43 100% 50% / 0.06)",
                  borderColor: "hsl(43 100% 50% / 0.3)",
                }}
              >
                <div className="flex items-start gap-3">
                  <IconWell color="sel" size="sm">
                    <Compass className="w-5 h-5" strokeWidth={2.5} />
                  </IconWell>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold text-[hsl(43_100%_50%)]">
                      {t("next_step_baseline")}
                    </p>
                    <p className="text-xs vi-text-muted mt-1">
                      {t("baseline_child_desc", { name: learnerName || t("your_child") })}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3 pt-2">
              {baselineCompleted ? (
                <button
                  onClick={onViewBrain}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[hsl(43_100%_50%)] text-white font-extrabold shadow-xl shadow-[hsl(43_100%_50%/0.3)] hover:scale-105 active:scale-95 transition-transform"
                  style={{ minHeight: "48px" }}
                >
                  <Compass className="w-4 h-4" /> {t("view_brain_profile")}
                </button>
              ) : (
                <button
                  onClick={onStartBaseline}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[hsl(43_100%_50%)] text-white font-extrabold shadow-xl shadow-[hsl(43_100%_50%/0.3)] hover:scale-105 active:scale-95 transition-transform"
                  style={{ minHeight: "48px" }}
                >
                  <Compass className="w-4 h-4" /> {t("start_baseline")}
                </button>
              )}
              <button
                onClick={onBackToProfile}
                className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold shadow-lg hover:scale-105 active:scale-95 transition-transform"
                style={{ minHeight: "48px" }}
              >
                {t("back_to_profile")}
              </button>
              <button
                onClick={onBackToDashboard}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[hsl(var(--visual-surface))] border-2 vi-border vi-text font-extrabold hover:border-[hsl(var(--visual-primary)/0.3)] transition-colors"
                style={{ minHeight: "48px" }}
              >
                {t("back_to_dashboard")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SubmittedScreen({
  result,
  onContinue,
  onContinueToBrain,
  t,
}: {
  result: any;
  onContinue: () => void;
  onContinueToBrain: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="min-h-screen vi-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        <section className="vi-card p-8 md:p-10 text-center relative overflow-hidden">
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[hsl(43_100%_50%/0.18)] blur-2xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[hsl(262_83%_58%/0.18)] blur-2xl"
            aria-hidden
          />
          <div className="relative space-y-5">
            <div className="mx-auto inline-flex">
              <IconWell color="science" size="lg">
                <CheckCircle2 className="w-10 h-10" strokeWidth={2.5} />
              </IconWell>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(142_71%_45%)] mb-2">
                {t("thank_you_eyebrow")}
              </p>
              <h1 className="text-2xl font-extrabold vi-text">{t("assessment_complete_title")}</h1>
              <p className="vi-text-muted mt-2">{t("assessment_thank_you")}</p>
            </div>
            {result.functioningLevel && (
              <div className="vi-card p-4 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(262_83%_58%)]">
                  {t("recommended_level")}
                </p>
                <p className="text-lg font-extrabold vi-text mt-1">
                  {(result.functioningLevel.level || "")
                    .replace(/_/g, " ")
                    .toLowerCase()
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </p>
                <p className="text-xs vi-text-muted mt-1">
                  {t("confidence")}:{" "}
                  {(() => {
                    const c = Number(result.functioningLevel.confidence) || 0;
                    const pct = c <= 1 ? c * 100 : c;
                    return `${Math.round(pct)}%`;
                  })()}
                </p>
              </div>
            )}
            {/* Hand-off card → brain-review. Replaces the older generic
                "next step" copy with an actionable bridge into the very
                next thing the parent should do, since the assessment they
                just completed is the input to the brain-clone flow. */}
            <div
              className="vi-card p-5 text-left"
              style={{
                background: "hsl(262 83% 58% / 0.06)",
                borderColor: "hsl(262 83% 58% / 0.3)",
              }}
            >
              <div className="flex items-start gap-3">
                <IconWell color="primary" size="sm">
                  <Compass className="w-5 h-5" strokeWidth={2.5} />
                </IconWell>
                <div className="flex-1">
                  <p className="text-sm font-extrabold text-[hsl(262_83%_58%)]">
                    Thanks — here&apos;s what we&apos;ll do next
                  </p>
                  <p className="text-xs vi-text-muted mt-1 leading-relaxed">
                    We&apos;ll use what you just shared to clone a starting Brain for your child,
                    then walk you through reviewing and approving it. Should take about a minute.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={onContinueToBrain}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[hsl(262_83%_58%)] text-white font-extrabold shadow-xl shadow-[hsl(262_83%_58%/0.3)] hover:scale-105 active:scale-95 transition-transform"
                style={{ minHeight: "48px" }}
              >
                Build the Brain <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onContinue}
                className="inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full vi-surface-soft border vi-border vi-text-muted font-bold hover:bg-[hsl(var(--visual-surface))] transition"
                style={{ minHeight: "44px" }}
              >
                {t("continue_to_profile")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
