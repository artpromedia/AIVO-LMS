"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { TUTORS, type TutorKey } from "@aivo/brand";
import BrainSphere from "@/components/brain/BrainSphere";
import BrainBuildingSequence from "@/components/brain/BrainBuildingSequence";
import BrainPersonalizationAnimation from "@/components/brain/BrainPersonalizationAnimation";
import { hasSeenClone, markSeenClone } from "@/lib/clone-flags";
import { useTranslations } from "next-intl";
import {
  Brain,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Compass,
  Search,
  BarChart3,
  Shield,
  GraduationCap,
  ClipboardList,
  Lock,
  Users2,
  BookOpen,
  Microscope,
  Landmark,
  Code2,
  MessageCircle,
  Heart,
  Puzzle,
  Home,
  Target,
  Palette,
  Wrench,
  Dna,
  Plus,
  Check,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import { subjectIcon, subjectBarClass, subjectWellClass } from "@/lib/subject-icons";
import { IconWell } from "@/components/discovery/_vi";

interface MasteryDecision {
  domain: string;
  score: number;
  display_label: string;
  reasoning: string;
  source: string;
  raw_score?: string;
  difficulty?: string;
}

interface AccommodationDecision {
  accommodation: string;
  display_label: string;
  reasoning: string;
  source: string;
  removable: boolean;
}

interface TutorDecision {
  tutor_key: string;
  reasoning: string;
  source: string;
}

interface SignalDecision {
  signal: string;
  value: string;
  display_label: string;
  reasoning: string;
  source: string;
}

interface XaiExplanation {
  summary: string;
  rai_compliance: {
    data_sources: string[];
    bias_mitigations: string[];
    transparency: string;
    human_oversight: string;
  };
  mastery_decisions: MasteryDecision[];
  accommodation_decisions: AccommodationDecision[];
  tutor_decisions: TutorDecision[];
  signal_decisions: SignalDecision[];
}

interface VisualIdentity {
  primaryHue: string;
  secondaryHues: string[];
  pulseRate: number;
  growthParticles: { domain: string; color: string; intensity: number }[];
  memoryBank: { domain: string; type: string; score: number }[];
}

interface BrainReview {
  id: string;
  learner_name: string;
  grade_level?: string;
  functioning_level?: string;
  approval_status: string;
  mastery_levels: Record<string, number>;
  disability_signals: Record<string, any>;
  active_accommodations: string[];
  active_tutors: string[];
  xai_explanation: XaiExplanation;
  visual_identity?: VisualIdentity;
  parent_notes?: string;
}

interface PreCloneData {
  learner: {
    id: string;
    name: string;
    grade_level?: string;
    functioning_level?: string;
    communication_mode?: string;
    diagnoses?: string[];
  };
  parent_assessment: any;
  baseline_assessment: any;
  brain_exists: boolean;
  brain_status: string | null;
  template_preview: {
    functioning_level: string;
    accommodations: string[];
    tutors: string[];
    domains: string[];
  };
}

interface ParentModification {
  field: string;
  original_value: number | string | boolean | null;
  parent_value: number | string | boolean | null;
  parent_note: string;
}

function MasteryIcon({ domain, className }: { domain: string; className?: string }) {
  const Icon: LucideIcon = subjectIcon(domain);
  return <Icon className={className || "w-5 h-5"} strokeWidth={2} aria-hidden />;
}

function MasteryWell({
  domain,
  size = "sm",
  iconClassName,
}: {
  domain: string;
  size?: "xs" | "sm" | "md";
  iconClassName?: string;
}) {
  const sz =
    size === "md"
      ? "w-9 h-9 rounded-xl"
      : size === "sm"
        ? "w-8 h-8 rounded-lg"
        : "w-7 h-7 rounded-lg";
  return (
    <span className={`${sz} flex items-center justify-center ${subjectWellClass(domain)}`}>
      <MasteryIcon domain={domain} className={iconClassName || "w-4 h-4"} />
    </span>
  );
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  discovery_adventure: {
    label: "From Assessment",
    color: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  },
  template_default: { label: "Template Default", color: "vi-surface-soft vi-text-muted" },
  functioning_level_template: {
    label: "Evidence-Based",
    color: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  },
  parent_assessment: {
    label: "Parent Reported",
    color: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  },
  iep: {
    label: "From IEP",
    color: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  },
};

const AVAILABLE_ACCOMMODATIONS = [
  "visual_supports",
  "audio_supports",
  "simplified_language",
  "extended_time",
  "reduced_choices",
  "high_contrast",
  "text_to_speech",
  "large_text",
  "break_reminders",
  "movement_breaks",
  "fidget_supports",
  "quiet_environment",
  "predictable_routines",
  "social_stories",
  "visual_schedules",
  "token_economy",
];

type PageMode = "loading" | "pre-clone" | "cloning" | "building" | "review";

export default function BrainReviewPage() {
  const { user, accessToken, loading, refreshToken } = useAuth();
  const router = useRouter();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");
  const tBrain = useTranslations("brain");
  const tCommon = useTranslations("common");

  const [pageMode, setPageMode] = useState<PageMode>("loading");
  const [preCloneData, setPreCloneData] = useState<PreCloneData | null>(null);
  const [review, setReview] = useState<BrainReview | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "mastery" | "accommodations" | "tutors" | "signals" | "rai"
  >("overview");
  const [submitting, setSubmitting] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: string; message: string } | null>(null);

  const [consentChecked, setConsentChecked] = useState(false);

  const [masteryOverrides, setMasteryOverrides] = useState<Record<string, number>>({});
  const [accommodationToggles, setAccommodationToggles] = useState<Record<string, boolean>>({});
  const [tutorToggles, setTutorToggles] = useState<Record<string, boolean>>({});
  const [modNotes, setModNotes] = useState<Record<string, string>>({});

  const [showContextForm, setShowContextForm] = useState(false);
  const [learningContext, setLearningContext] = useState("");
  const [clinicalContext, setClinicalContext] = useState("");
  const [assessmentConcerns, setAssessmentConcerns] = useState("");
  const [missingInfo, setMissingInfo] = useState("");

  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false);
  const [startOverReason, setStartOverReason] = useState("");

  // Replay-clone overlay state. When true, the cloning animation is rendered
  // on top of the review UI without re-calling the clone API; on completion
  // we just dismiss it. Independent from `pageMode === "cloning"` which is
  // reserved for the live first-time clone-and-build flow.
  const [replayingClone, setReplayingClone] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!accessToken || !learnerId) return;

    const load = async () => {
      const reviewRes = await fetch(`/api/brain/${learnerId}/review`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (reviewRes.ok) {
        const data = await reviewRes.json();
        setReview(data);

        if (data.mastery_levels) {
          setMasteryOverrides({ ...data.mastery_levels });
        }
        const accMap: Record<string, boolean> = {};
        (data.active_accommodations || []).forEach((a: string) => {
          accMap[a] = true;
        });
        setAccommodationToggles(accMap);
        const tutMap: Record<string, boolean> = {};
        (data.active_tutors || []).forEach((t: string) => {
          tutMap[t] = true;
        });
        setTutorToggles(tutMap);

        if (data.approval_status === "pending_parent_review") {
          setPageMode("review");
        } else {
          setPageMode("review");
        }
        return;
      }

      const preRes = await fetch(`/api/brain/${learnerId}/pre-clone-data`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (preRes.ok) {
        const preData = await preRes.json();
        setPreCloneData(preData);
        if (preData.brain_exists) {
          setPageMode("review");
        } else {
          setPageMode("pre-clone");
        }
      } else {
        setPageMode("pre-clone");
      }
    };

    load().catch(() => setPageMode("pre-clone"));
  }, [accessToken, learnerId]);

  const buildModificationsArray = useCallback((): ParentModification[] => {
    const mods: ParentModification[] = [];

    if (review) {
      for (const [domain, val] of Object.entries(masteryOverrides)) {
        const orig = review.mastery_levels[domain];
        if (orig !== undefined && Math.abs(val - orig) > 0.01) {
          mods.push({
            field: `mastery_levels.${domain}`,
            original_value: orig,
            parent_value: val,
            parent_note: modNotes[`mastery.${domain}`] || "",
          });
        }
      }

      for (const [acc, enabled] of Object.entries(accommodationToggles)) {
        const wasEnabled = (review.active_accommodations || []).includes(acc);
        if (enabled !== wasEnabled) {
          mods.push({
            field: `accommodation.${acc}`,
            original_value: wasEnabled,
            parent_value: enabled,
            parent_note: modNotes[`acc.${acc}`] || "",
          });
        }
      }

      for (const [tutor, enabled] of Object.entries(tutorToggles)) {
        const wasEnabled = (review.active_tutors || []).includes(tutor);
        if (enabled !== wasEnabled) {
          mods.push({
            field: `tutor.${tutor}`,
            original_value: wasEnabled,
            parent_value: enabled,
            parent_note: modNotes[`tutor.${tutor}`] || "",
          });
        }
      }
    }

    return mods;
  }, [review, masteryOverrides, accommodationToggles, tutorToggles, modNotes]);

  const authedFetch = useCallback(
    async (input: RequestInfo, init: RequestInit = {}): Promise<Response> => {
      const tokenToUse = accessToken;
      const doFetch = (tok: string | null) => {
        const headers = new Headers(init.headers as HeadersInit | undefined);
        if (tok) headers.set("Authorization", `Bearer ${tok}`);
        return fetch(input, { ...init, headers });
      };
      let res = await doFetch(tokenToUse);
      if (res.status === 401) {
        let isExpired = true;
        try {
          const clone = res.clone();
          const body = await clone.text();
          if (body && !/expired|expire/i.test(body)) isExpired = false;
        } catch {}
        if (isExpired) {
          const newToken = await refreshToken();
          if (newToken) {
            res = await doFetch(newToken);
          } else {
            router.push("/login");
          }
        }
      }
      return res;
    },
    [accessToken, refreshToken, router],
  );

  const handleCloneAndBuild = async () => {
    if (!accessToken || !consentChecked) return;
    setSubmitting(true);
    setPageMode("cloning");

    try {
      const cloneRes = await authedFetch(`/api/brain/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learner_id: learnerId,
          consent_given: true,
          consent_version: "1.0",
        }),
      });

      if (!cloneRes.ok) {
        const err = await cloneRes.text();
        setSubmitting(false);
        setPageMode("pre-clone");
        let msg = err;
        try {
          const parsed = JSON.parse(err);
          msg = parsed.detail || parsed.error || err;
        } catch {}
        if (cloneRes.status === 401) {
          router.push("/login");
          return;
        }
        alert(`Failed to build brain: ${msg}`);
        return;
      }

      const reviewRes = await authedFetch(`/api/brain/${learnerId}/review`);

      if (reviewRes.ok) {
        const data = await reviewRes.json();
        setReview(data);
        if (data.mastery_levels) setMasteryOverrides({ ...data.mastery_levels });
        const accMap: Record<string, boolean> = {};
        (data.active_accommodations || []).forEach((a: string) => {
          accMap[a] = true;
        });
        setAccommodationToggles(accMap);
        const tutMap: Record<string, boolean> = {};
        (data.active_tutors || []).forEach((t: string) => {
          tutMap[t] = true;
        });
        setTutorToggles(tutMap);
        setPageMode("building");
      } else {
        setPageMode("review");
      }
    } catch (e: any) {
      setPageMode("pre-clone");
      alert(`Error: ${e.message}`);
    }
    setSubmitting(false);
  };

  const handleApprove = async () => {
    if (!accessToken || !consentChecked) return;
    setSubmitting(true);
    try {
      const mods = buildModificationsArray();
      const res = await authedFetch(`/api/brain/${learnerId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_notes: null,
          consent_given: true,
          consent_version: "1.0",
          parent_modifications: mods,
        }),
      });
      if (res.ok) {
        setActionResult({
          type: "approved",
          message: `${review?.learner_name || "Your child"}'s personalized Brain has been approved and activated. They can now start learning!`,
        });
        setReview((prev) => (prev ? { ...prev, approval_status: "approved" } : prev));
      } else {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const err = await res.text();
        let msg = err;
        try {
          const parsed = JSON.parse(err);
          msg = parsed.detail || parsed.error || err;
        } catch {}
        alert(`Approval failed: ${msg}`);
      }
    } catch {}
    setSubmitting(false);
  };

  const handleAddContext = async () => {
    if (!accessToken) return;
    const contextParts = [];
    if (learningContext.trim()) contextParts.push(`Learning Context: ${learningContext.trim()}`);
    if (clinicalContext.trim()) contextParts.push(`Clinical Context: ${clinicalContext.trim()}`);
    if (assessmentConcerns.trim())
      contextParts.push(`Assessment Concerns: ${assessmentConcerns.trim()}`);
    if (missingInfo.trim()) contextParts.push(`Missing Information: ${missingInfo.trim()}`);
    if (contextParts.length === 0) return;

    setSubmitting(true);
    try {
      const res = await authedFetch(`/api/brain/${learnerId}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_notes: contextParts.join("\n\n") }),
      });
      if (res.ok) {
        setActionResult({
          type: "rebuilt",
          message: `${review?.learner_name || "Your child"}'s Brain is being rebuilt with your additional context.`,
        });
        setReview((prev) => (prev ? { ...prev, approval_status: "amended" } : prev));
        setShowContextForm(false);
      }
    } catch {}
    setSubmitting(false);
  };

  const handleStartOver = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const res = await authedFetch(`/api/brain/${learnerId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: startOverReason || "Parent requested reassessment" }),
      });
      if (res.ok) {
        setActionResult({
          type: "start_over",
          message: `The assessment will be reset. ${review?.learner_name || "Your child"} can take the Discovery Adventure again.`,
        });
      }
    } catch {}
    setSubmitting(false);
  };

  if (loading || !user) return null;

  if (pageMode === "loading") {
    return (
      <div className="min-h-screen vi-bg flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4 animate-pulse">
            <IconWell color="primary" size="lg">
              <Brain className="w-10 h-10" />
            </IconWell>
          </div>
          <p className="vi-text-muted font-heading font-bold">{t("loading_brain_review")}</p>
        </div>
      </div>
    );
  }

  if (actionResult) {
    return (
      <div className="min-h-screen vi-bg flex items-center justify-center px-4">
        <div className="vi-card p-8 max-w-lg text-center shadow-xl">
          <div className="flex justify-center mb-4">
            <IconWell
              color={
                actionResult.type === "approved"
                  ? "science"
                  : actionResult.type === "rebuilt"
                    ? "reading"
                    : "primary"
              }
              size="lg"
            >
              {actionResult.type === "approved" ? (
                <CheckCircle2 className="w-10 h-10" />
              ) : actionResult.type === "rebuilt" ? (
                <RefreshCw className="w-10 h-10" />
              ) : (
                <RotateCcw className="w-10 h-10" />
              )}
            </IconWell>
          </div>
          <h2 className="text-2xl font-heading font-bold vi-text mb-3">
            {actionResult.type === "approved"
              ? "Brain Approved!"
              : actionResult.type === "rebuilt"
                ? "Brain Rebuilding"
                : "Starting Over"}
          </h2>
          <p className="vi-text-muted font-body mb-6">{actionResult.message}</p>
          <Link
            href={
              actionResult.type === "start_over"
                ? `/dashboard/learner/assessment?learnerId=${learnerId}`
                : `/dashboard/parent/learner/${learnerId}`
            }
            style={{ minHeight: 44 }}
            className="inline-block px-6 py-3 bg-[hsl(var(--visual-primary))] text-white font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-primary)/0.9)] transition"
          >
            {actionResult.type === "start_over" ? "Start New Assessment" : "View Learner Dashboard"}
          </Link>
        </div>
      </div>
    );
  }

  if (pageMode === "pre-clone") {
    if (preCloneData && !preCloneData.baseline_assessment) {
      const learnerName = preCloneData.learner?.name || "your child";
      return (
        <div className="min-h-screen vi-bg flex items-center justify-center px-4">
          <div className="vi-card p-10 shadow-xl text-center max-w-lg space-y-6">
            <div className="flex justify-center">
              <IconWell color="sel" size="lg">
                <Compass className="w-10 h-10" />
              </IconWell>
            </div>
            <h1 className="text-2xl font-heading font-bold vi-text">Baseline Adventure Needed</h1>
            <p className="vi-text-muted">
              Before we can build {learnerName}&apos;s personalized Brain, they need to complete the
              Discovery Adventure so we can learn how they learn best.
            </p>
            <div className="p-4 rounded-2xl bg-[hsl(var(--visual-sel)/0.12)] border border-[hsl(var(--visual-sel)/0.3)] text-left">
              <p className="text-sm font-bold text-[hsl(var(--visual-sel))] mb-1">
                Why this is required
              </p>
              <p className="text-xs text-[hsl(var(--visual-sel))]">
                The Brain is built from real interaction data — reading, math, pattern recognition,
                and response timing — gathered during the adventure. Without it, there&apos;s
                nothing to personalize.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push(`/dashboard/learner/assessment?learnerId=${learnerId}`)}
                style={{ minHeight: 44 }}
                className="px-8 py-3 rounded-full bg-[hsl(var(--visual-sel))] text-white font-bold hover:bg-[hsl(var(--visual-sel)/0.9)] transition shadow-lg"
              >
                Start Discovery Adventure
              </button>
              <button
                onClick={() => router.push(`/dashboard/parent/learner/${learnerId}`)}
                style={{ minHeight: 44 }}
                className="px-8 py-3 rounded-full vi-surface-soft border vi-border vi-text-muted font-bold hover:bg-[hsl(var(--visual-surface))] transition"
              >
                Back to Profile
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <PreCloneReview
        preCloneData={preCloneData}
        learnerId={learnerId}
        consentChecked={consentChecked}
        setConsentChecked={setConsentChecked}
        submitting={submitting}
        onCloneAndBuild={handleCloneAndBuild}
        userName={user.name}
      />
    );
  }

  if (pageMode === "cloning") {
    const cloningName = preCloneData?.learner?.name || review?.learner_name || "your child";
    // The API call drives the transition to "building" once the clone
    // returns; the animation just runs ambiently in the meantime.
    // Once-per-child: if the parent has already watched the cloning moment
    // for this learner, render a much shorter (~1.5s) version so re-builds
    // don't feel padded — the deliberate "Replay clone" button on the
    // review screen is how they revisit the full animation.
    const seen = hasSeenClone(learnerId);
    return (
      <BrainPersonalizationAnimation
        learnerName={cloningName}
        durationMs={seen ? 1500 : 9000}
        onComplete={() => markSeenClone(learnerId)}
        onSkip={() => markSeenClone(learnerId)}
      />
    );
  }

  if (pageMode === "building" && review) {
    return (
      <BrainBuildingSequence
        learnerName={review.learner_name}
        gradeLevel={review.grade_level || "6"}
        functioningLevel={review.functioning_level || "STANDARD"}
        masteryLevels={review.mastery_levels}
        xaiExplanation={review.xai_explanation}
        activeTutors={review.active_tutors}
        activeAccommodations={review.active_accommodations}
        onSequenceComplete={() => setPageMode("review")}
      />
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen vi-bg flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <IconWell color="primary">
              <Search className="w-7 h-7" />
            </IconWell>
          </div>
          <p className="vi-text-muted font-heading font-bold">{t("no_brain_found")}</p>
          <Link
            href={`/dashboard/parent/learner/${learnerId}`}
            className="text-[hsl(var(--visual-primary))] font-semibold hover:underline mt-4 inline-block"
          >
            {t("back_to_profile")}
          </Link>
        </div>
      </div>
    );
  }

  const xai = review.xai_explanation;
  const isAlreadyResolved = review.approval_status !== "pending_parent_review";
  const modCount = buildModificationsArray().length;

  const TABS = [
    { key: "overview" as const, label: tBrain("overview"), icon: <Brain className="w-4 h-4" /> },
    {
      key: "mastery" as const,
      label: tBrain("learning_levels"),
      icon: <BarChart3 className="w-4 h-4" />,
    },
    {
      key: "accommodations" as const,
      label: tBrain("supports"),
      icon: <Shield className="w-4 h-4" />,
    },
    {
      key: "tutors" as const,
      label: tBrain("ai_tutors"),
      icon: <GraduationCap className="w-4 h-4" />,
    },
    {
      key: "signals" as const,
      label: tBrain("learner_profile"),
      icon: <ClipboardList className="w-4 h-4" />,
    },
    { key: "rai" as const, label: tBrain("ai_safety"), icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen vi-bg">
      {replayingClone && (
        <div className="fixed inset-0 z-50">
          <BrainPersonalizationAnimation
            learnerName={review.learner_name}
            durationMs={9000}
            onComplete={() => {
              markSeenClone(learnerId);
              setReplayingClone(false);
            }}
            onSkip={() => {
              markSeenClone(learnerId);
              setReplayingClone(false);
            }}
          />
        </div>
      )}
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-6 py-4 flex items-center justify-between">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={120}
          height={36}
          style={{ height: "auto" }}
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setReplayingClone(true)}
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--visual-primary))] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-primary))] rounded-full px-2 py-1"
            aria-label="Replay the cloning animation for this learner"
          >
            <PlayCircle className="w-4 h-4" aria-hidden="true" />
            Replay clone
          </button>
          <Link
            href={`/dashboard/parent/learner/${learnerId}`}
            className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline"
          >
            {t("back_to_profile")}
          </Link>
          <span className="text-sm font-semibold vi-text-muted">{user.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="vi-card p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <BrainSphere visualIdentity={review.visual_identity} size={64} />
            <div className="flex-1">
              <h1 className="text-2xl font-heading font-bold vi-text">
                {review.learner_name}&apos;s {tBrain("title")}
              </h1>
              <p className="vi-text-muted font-body">
                {isAlreadyResolved
                  ? "Review your child's personalized learning Brain."
                  : "Review the AI's recommendations. Adjust anything, then approve to activate learning."}
              </p>
            </div>
            {isAlreadyResolved && review.approval_status && (
              <span
                className={`px-4 py-2 rounded-full text-sm font-bold ${
                  review.approval_status === "approved"
                    ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"
                    : review.approval_status === "amended"
                      ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]"
                      : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                }`}
              >
                {review.approval_status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            )}
          </div>

          {!isAlreadyResolved && modCount > 0 && (
            <div className="bg-[hsl(var(--visual-sel)/0.12)] border border-[hsl(var(--visual-sel)/0.3)] rounded-xl p-3 mb-4">
              <p className="text-sm text-[hsl(var(--visual-sel))] font-semibold">
                You have {modCount} modification{modCount !== 1 ? "s" : ""} pending. These will be
                applied when you approve.
              </p>
            </div>
          )}

          {(() => {
            const strengths =
              xai?.mastery_decisions
                ?.filter((m) => m.score >= 0.6)
                .sort((a, b) => b.score - a.score) || [];
            const growth =
              xai?.mastery_decisions?.filter(
                (m) => m.score < 0.6 && m.source === "discovery_adventure",
              ) || [];
            return (
              <div className="space-y-3">
                {strengths.length > 0 && (
                  <div className="bg-[hsl(var(--visual-science)/0.12)] border border-[hsl(var(--visual-science)/0.3)] rounded-xl p-4">
                    <p className="text-sm font-semibold text-[hsl(var(--visual-science))] mb-1">
                      Strong engagement in{" "}
                      {strengths.map((s) => s.display_label.toLowerCase()).join(" and ")}!
                    </p>
                  </div>
                )}
                {growth.length > 0 && (
                  <div className="bg-[hsl(var(--visual-sel)/0.12)] border border-[hsl(var(--visual-sel)/0.3)] rounded-xl p-4">
                    <p className="text-sm text-[hsl(var(--visual-sel))]">
                      Growth opportunities in{" "}
                      {growth.map((g) => g.display_label.toLowerCase()).join(" and ")} — content
                      will start at their current level and build up.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{ minHeight: 44 }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-heading font-bold whitespace-nowrap transition ${
                activeTab === tab.key
                  ? "bg-[hsl(var(--visual-primary))] text-white shadow-md"
                  : "bg-[hsl(var(--visual-surface))] vi-text-muted border vi-border hover:border-[hsl(var(--visual-primary)/0.3)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 mb-8">
          {activeTab === "overview" && (
            <>
              <div className="vi-card p-6">
                <h2 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-3">
                  <IconWell color="primary" size="sm">
                    <BarChart3 className="w-5 h-5" />
                  </IconWell>{" "}
                  Mastery Snapshot
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {xai?.mastery_decisions?.map((m) => {
                    const overridden =
                      masteryOverrides[m.domain] !== undefined &&
                      Math.abs(masteryOverrides[m.domain] - m.score) > 0.01;
                    const displayScore = masteryOverrides[m.domain] ?? m.score;
                    return (
                      <div
                        key={m.domain}
                        className={`relative overflow-hidden rounded-xl vi-surface-soft border p-4 ${overridden ? "border-[hsl(var(--visual-sel)/0.5)] ring-1 ring-[hsl(var(--visual-sel)/0.3)]" : "vi-border"}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MasteryWell domain={m.domain} size="xs" />
                          <span className="font-heading font-bold text-sm text-slate-800">
                            {m.display_label}
                          </span>
                        </div>
                        <div className="text-2xl font-heading font-bold vi-text mb-1">
                          {Math.round(displayScore * 100)}%
                          {overridden && (
                            <span className="text-xs text-[hsl(var(--visual-sel))] ml-1">
                              (modified)
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-[hsl(var(--visual-surface-soft))] rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${subjectBarClass(m.domain)} transition-all duration-1000`}
                            style={{ width: `${Math.max(4, displayScore * 100)}%` }}
                          />
                        </div>
                        {m.source && (
                          <span
                            className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${SOURCE_BADGES[m.source]?.color || "vi-surface-soft vi-text-muted"}`}
                          >
                            {SOURCE_BADGES[m.source]?.label || m.source}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="vi-card p-6">
                  <h3 className="font-heading font-bold vi-text mb-3 flex items-center gap-3">
                    <IconWell color="primary" size="sm">
                      <GraduationCap className="w-5 h-5" />
                    </IconWell>{" "}
                    Active Tutors
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(tutorToggles)
                      .filter(([, v]) => v)
                      .map(([key]) => {
                        const tutor = TUTORS[key as TutorKey];
                        if (!tutor) return null;
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-2 vi-surface-soft rounded-xl px-3 py-2"
                          >
                            <div
                              className="w-8 h-8 rounded-full overflow-hidden border-2"
                              style={{ borderColor: tutor.color }}
                            >
                              <Image
                                src={tutor.avatar}
                                alt={tutor.name}
                                width={32}
                                height={32}
                                className="object-cover"
                              />
                            </div>
                            <span className="text-sm font-heading font-bold text-slate-800">
                              {tutor.name}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="vi-card p-6">
                  <h3 className="font-heading font-bold vi-text mb-3 flex items-center gap-3">
                    <IconWell color="science" size="sm">
                      <Shield className="w-5 h-5" />
                    </IconWell>{" "}
                    Active Supports
                  </h3>
                  {Object.entries(accommodationToggles).filter(([, v]) => v).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(accommodationToggles)
                        .filter(([, v]) => v)
                        .map(([acc]) => (
                          <span
                            key={acc}
                            className="px-3 py-1.5 bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] rounded-lg text-sm font-semibold border border-[hsl(var(--visual-science)/0.3)]"
                          >
                            {acc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm vi-text-muted">No accommodations active</p>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "mastery" && (
            <div className="vi-card p-6">
              <h2 className="font-heading font-bold text-lg vi-text mb-2 flex items-center gap-3">
                <IconWell color="primary" size="sm">
                  <BarChart3 className="w-5 h-5" />
                </IconWell>{" "}
                Learning Levels
              </h2>
              <p className="text-sm vi-text-muted mb-6">
                {isAlreadyResolved
                  ? "These are the current mastery levels for each learning domain."
                  : "Review and adjust mastery levels. Drag the slider to change the starting level for any domain."}
              </p>
              <div className="space-y-4">
                {xai?.mastery_decisions?.map((m) => {
                  const currentVal = masteryOverrides[m.domain] ?? m.score;
                  const isModified = Math.abs(currentVal - m.score) > 0.01;
                  return (
                    <div
                      key={m.domain}
                      className={`border rounded-xl p-4 transition ${isModified ? "border-[hsl(var(--visual-sel)/0.5)] bg-[hsl(var(--visual-sel)/0.06)]" : "vi-border hover:bg-[hsl(var(--visual-surface-soft))]"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <MasteryWell domain={m.domain} size="md" iconClassName="w-5 h-5" />
                          <div>
                            <p className="font-heading font-bold vi-text">{m.display_label}</p>
                            {m.raw_score && (
                              <p className="text-xs vi-text-muted">
                                Raw: {m.raw_score}
                                {m.difficulty ? ` (${m.difficulty})` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-heading font-bold vi-text">
                            {Math.round(currentVal * 100)}%
                          </p>
                          {isModified && (
                            <p className="text-xs text-[hsl(var(--visual-sel))] font-semibold">
                              was {Math.round(m.score * 100)}%
                            </p>
                          )}
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SOURCE_BADGES[m.source]?.color || "vi-surface-soft vi-text-muted"}`}
                          >
                            {SOURCE_BADGES[m.source]?.label || m.source}
                          </span>
                        </div>
                      </div>

                      {!isAlreadyResolved && (
                        <div className="mt-3">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={Math.round(currentVal * 100)}
                            onChange={(e) => {
                              setMasteryOverrides((prev) => ({
                                ...prev,
                                [m.domain]: parseInt(e.target.value) / 100,
                              }));
                            }}
                            className="w-full h-2 bg-[hsl(var(--visual-surface-soft))] rounded-full appearance-none cursor-pointer accent-[hsl(var(--visual-primary))]"
                          />
                          <div className="flex justify-between text-[10px] vi-text-muted mt-1">
                            <span>0%</span>
                            <span>50%</span>
                            <span>100%</span>
                          </div>
                        </div>
                      )}

                      <div className="w-full bg-[hsl(var(--visual-surface-soft))] rounded-full h-3 overflow-hidden mt-2 mb-2">
                        <div
                          className={`h-full rounded-full ${subjectBarClass(m.domain)}`}
                          style={{ width: `${Math.max(4, currentVal * 100)}%` }}
                        />
                      </div>

                      <p className="text-sm vi-text-muted vi-surface-soft rounded-lg p-3 leading-relaxed">
                        <span className="font-semibold text-slate-800">Why this score: </span>
                        {m.reasoning}
                      </p>

                      {!isAlreadyResolved && isModified && (
                        <div className="mt-3">
                          <input
                            type="text"
                            placeholder="Add a note about this change (optional)"
                            value={modNotes[`mastery.${m.domain}`] || ""}
                            onChange={(e) =>
                              setModNotes((prev) => ({
                                ...prev,
                                [`mastery.${m.domain}`]: e.target.value,
                              }))
                            }
                            className="w-full border border-[hsl(var(--visual-sel)/0.3)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-sel)/0.3)] bg-[hsl(var(--visual-sel)/0.06)] font-body"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "accommodations" && (
            <div className="vi-card p-6">
              <h2 className="font-heading font-bold text-lg vi-text mb-2 flex items-center gap-3">
                <IconWell color="science" size="sm">
                  <Shield className="w-5 h-5" />
                </IconWell>{" "}
                Learning Supports
              </h2>
              <p className="text-sm vi-text-muted mb-6">
                {isAlreadyResolved
                  ? "These supports are currently active for every lesson and activity."
                  : "Toggle supports on or off. These will be applied to every lesson automatically."}
              </p>

              {xai?.accommodation_decisions?.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="text-sm font-heading font-bold text-slate-800">
                    AI-Recommended Supports
                  </h3>
                  {xai.accommodation_decisions.map((a) => {
                    const isOn = accommodationToggles[a.accommodation] ?? true;
                    const wasOn = (review.active_accommodations || []).includes(a.accommodation);
                    const isModified = isOn !== wasOn;
                    return (
                      <div
                        key={a.accommodation}
                        className={`border rounded-xl p-4 transition ${isModified ? "border-[hsl(var(--visual-sel)/0.5)] bg-[hsl(var(--visual-sel)/0.06)]" : "vi-border hover:bg-[hsl(var(--visual-science)/0.06)]"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-heading font-bold vi-text">{a.display_label}</p>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SOURCE_BADGES[a.source]?.color || "vi-surface-soft vi-text-muted"}`}
                            >
                              {SOURCE_BADGES[a.source]?.label || a.source}
                            </span>
                            {!isAlreadyResolved && (
                              <button
                                onClick={() =>
                                  setAccommodationToggles((prev) => ({
                                    ...prev,
                                    [a.accommodation]: !isOn,
                                  }))
                                }
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isOn ? "bg-[hsl(var(--visual-science))]" : "bg-[hsl(var(--visual-border))]"}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? "translate-x-6" : "translate-x-1"}`}
                                />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm vi-text-muted leading-relaxed">{a.reasoning}</p>
                        {!isAlreadyResolved && isModified && (
                          <input
                            type="text"
                            placeholder="Add a note (optional)"
                            value={modNotes[`acc.${a.accommodation}`] || ""}
                            onChange={(e) =>
                              setModNotes((prev) => ({
                                ...prev,
                                [`acc.${a.accommodation}`]: e.target.value,
                              }))
                            }
                            className="mt-2 w-full border border-[hsl(var(--visual-sel)/0.3)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-sel)/0.3)] bg-[hsl(var(--visual-sel)/0.06)] font-body"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!isAlreadyResolved && (
                <div>
                  <h3 className="text-sm font-heading font-bold text-slate-800 mb-3">
                    Add More Supports
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ACCOMMODATIONS.filter(
                      (acc) => !xai?.accommodation_decisions?.find((a) => a.accommodation === acc),
                    ).map((acc) => {
                      const isOn = accommodationToggles[acc] || false;
                      return (
                        <button
                          key={acc}
                          onClick={() =>
                            setAccommodationToggles((prev) => ({ ...prev, [acc]: !isOn }))
                          }
                          className={`text-left px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                            isOn
                              ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] border-[hsl(var(--visual-science)/0.3)]"
                              : "bg-[hsl(var(--visual-surface))] vi-text-muted vi-border hover:border-[hsl(var(--visual-science)/0.3)]"
                          }`}
                        >
                          <span className="mr-1 inline-flex">
                            {isOn ? (
                              <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                            ) : (
                              <Plus className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                            )}
                          </span>
                          {acc.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "tutors" && (
            <div className="vi-card p-6">
              <h2 className="font-heading font-bold text-lg vi-text mb-2 flex items-center gap-3">
                <IconWell color="primary" size="sm">
                  <GraduationCap className="w-5 h-5" />
                </IconWell>{" "}
                AI Tutors
              </h2>
              <p className="text-sm vi-text-muted mb-6">
                {isAlreadyResolved
                  ? "These tutors are assigned to your child."
                  : "Toggle tutors on or off. Each tutor specializes in a different subject area."}
              </p>
              <div className="space-y-3">
                {(xai?.tutor_decisions || []).map((td) => {
                  const tutor = TUTORS[td.tutor_key as TutorKey];
                  const isOn = tutorToggles[td.tutor_key] ?? true;
                  const wasOn = (review.active_tutors || []).includes(td.tutor_key);
                  const isModified = isOn !== wasOn;
                  return (
                    <div
                      key={td.tutor_key}
                      className={`border rounded-xl p-4 transition flex items-center gap-4 ${isModified ? "border-[hsl(var(--visual-sel)/0.5)] bg-[hsl(var(--visual-sel)/0.06)]" : "vi-border hover:bg-[hsl(var(--visual-primary)/0.06)]"}`}
                    >
                      {tutor ? (
                        <div
                          className="w-14 h-14 rounded-full overflow-hidden border-3 shadow-md flex-shrink-0"
                          style={{ borderColor: tutor.color }}
                        >
                          <Image
                            src={tutor.avatar}
                            alt={tutor.name}
                            width={56}
                            height={56}
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-7 h-7" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-heading font-bold vi-text">
                            {tutor?.name || td.tutor_key}
                          </p>
                          {tutor?.domain && (
                            <span className="text-xs bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] px-2 py-0.5 rounded-full font-semibold">
                              {tutor.domain}
                            </span>
                          )}
                        </div>
                        <p className="text-sm vi-text-muted">{td.reasoning}</p>
                        {!isAlreadyResolved && isModified && (
                          <input
                            type="text"
                            placeholder="Add a note (optional)"
                            value={modNotes[`tutor.${td.tutor_key}`] || ""}
                            onChange={(e) =>
                              setModNotes((prev) => ({
                                ...prev,
                                [`tutor.${td.tutor_key}`]: e.target.value,
                              }))
                            }
                            className="mt-2 w-full border border-[hsl(var(--visual-sel)/0.3)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-sel)/0.3)] bg-[hsl(var(--visual-sel)/0.06)] font-body"
                          />
                        )}
                      </div>
                      {!isAlreadyResolved && (
                        <button
                          onClick={() =>
                            setTutorToggles((prev) => ({ ...prev, [td.tutor_key]: !isOn }))
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isOn ? "bg-[hsl(var(--visual-primary))]" : "bg-[hsl(var(--visual-border))]"}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isOn ? "translate-x-6" : "translate-x-1"}`}
                          />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "signals" && (
            <div className="vi-card p-6">
              <h2 className="font-heading font-bold text-lg vi-text mb-2 flex items-center gap-3">
                <IconWell color="reading" size="sm">
                  <ClipboardList className="w-5 h-5" />
                </IconWell>{" "}
                Learner Profile
              </h2>
              <p className="text-sm vi-text-muted mb-6">
                Signals detected from assessments that inform the Brain&apos;s decisions.
              </p>
              {xai?.signal_decisions?.length > 0 ? (
                <div className="space-y-3">
                  {xai.signal_decisions.map((s) => (
                    <div key={s.signal} className="border vi-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-heading font-bold vi-text">{s.display_label}</p>
                        <span className="text-sm font-semibold text-[hsl(var(--visual-primary))] bg-[hsl(var(--visual-primary)/0.12)] px-3 py-1 rounded-full">
                          {s.value}
                        </span>
                      </div>
                      <p className="text-sm vi-text-muted leading-relaxed">{s.reasoning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="flex justify-center mb-3">
                    <IconWell color="science">
                      <CheckCircle2 className="w-7 h-7" />
                    </IconWell>
                  </div>
                  <p className="vi-text-muted font-semibold">Standard learner profile</p>
                  <p className="text-xs vi-text-muted mt-1">No additional signals detected.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "rai" && (
            <div className="space-y-4">
              <div className="vi-card p-6">
                <h2 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-3">
                  <IconWell color="primary" size="sm">
                    <Lock className="w-5 h-5" />
                  </IconWell>{" "}
                  AI Safety & Transparency
                </h2>
                <div className="bg-[hsl(var(--visual-science)/0.12)] border border-[hsl(var(--visual-science)/0.3)] rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-[hsl(var(--visual-science))] mb-1">
                    Transparency
                  </p>
                  <p className="text-sm text-[hsl(var(--visual-science))]">
                    {xai?.rai_compliance?.transparency}
                  </p>
                </div>
                <div className="bg-[hsl(var(--visual-reading)/0.12)] border border-[hsl(var(--visual-reading)/0.3)] rounded-xl p-4">
                  <p className="text-sm font-semibold text-[hsl(var(--visual-reading))] mb-1">
                    Human Oversight
                  </p>
                  <p className="text-sm text-[hsl(var(--visual-reading))]">
                    {xai?.rai_compliance?.human_oversight}
                  </p>
                </div>
              </div>

              <div className="vi-card p-6">
                <h3 className="font-heading font-bold vi-text mb-3">Data Sources</h3>
                <div className="space-y-2">
                  {xai?.rai_compliance?.data_sources?.map((src, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 vi-surface-soft rounded-xl px-4 py-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-[hsl(var(--visual-reading)/0.12)] flex items-center justify-center text-[hsl(var(--visual-reading))] text-sm font-bold">
                        {i + 1}
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{src}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="vi-card p-6">
                <h3 className="font-heading font-bold vi-text mb-3">Bias Mitigations</h3>
                <div className="space-y-2">
                  {xai?.rai_compliance?.bias_mitigations?.map((mit, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 bg-[hsl(var(--visual-science)/0.12)] rounded-xl px-4 py-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[hsl(var(--visual-science))] mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-[hsl(var(--visual-science))]">{mit}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {!isAlreadyResolved && (
          <div className="vi-card p-6 sticky bottom-4 shadow-xl">
            <h3 className="font-heading font-bold text-lg vi-text mb-2">Your Decision</h3>
            <p className="text-sm vi-text-muted font-body mb-4">
              You have final authority over {review.learner_name}&apos;s learning Brain. No learning
              happens until you approve.
            </p>

            <div className="mb-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
                />
                <span className="text-sm text-slate-800 leading-relaxed">
                  I consent to AIVO creating a personalized learning profile (Brain) for{" "}
                  {review.learner_name} based on the assessment data shown above. I understand this
                  data will be used to personalize their learning experience and can be deleted at
                  any time.
                  <span className="vi-text-muted text-xs block mt-1">COPPA Consent v1.0</span>
                </span>
              </label>
            </div>

            {showContextForm ? (
              <div className="space-y-4">
                <div className="bg-[hsl(var(--visual-reading)/0.12)] border border-[hsl(var(--visual-reading)/0.3)] rounded-xl p-4 mb-2">
                  <p className="text-sm font-semibold text-[hsl(var(--visual-reading))] mb-1">
                    Add Context & Rebuild
                  </p>
                  <p className="text-xs text-[hsl(var(--visual-reading))]">
                    Provide additional information and the Brain will be rebuilt with your context.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="learning-context"
                    className="block text-sm font-semibold text-slate-800 mb-1"
                  >
                    Learning Context
                  </label>
                  <textarea
                    id="learning-context"
                    value={learningContext}
                    onChange={(e) => setLearningContext(e.target.value)}
                    placeholder="e.g., 'He is really interested in dinosaurs.' 'She does better in the morning.'"
                    className="w-full border vi-border rounded-xl p-3 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-reading)/0.5)] font-body"
                  />
                </div>

                <div>
                  <label
                    htmlFor="clinical-context"
                    className="block text-sm font-semibold text-slate-800 mb-1"
                  >
                    Clinical Context
                  </label>
                  <textarea
                    id="clinical-context"
                    value={clinicalContext}
                    onChange={(e) => setClinicalContext(e.target.value)}
                    placeholder="e.g., 'He has been making progress with his speech therapist on the /r/ sound.'"
                    className="w-full border vi-border rounded-xl p-3 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-reading)/0.5)] font-body"
                  />
                </div>

                <div>
                  <label
                    htmlFor="assessment-concerns"
                    className="block text-sm font-semibold text-slate-800 mb-1"
                  >
                    Assessment Concerns
                  </label>
                  <textarea
                    id="assessment-concerns"
                    value={assessmentConcerns}
                    onChange={(e) => setAssessmentConcerns(e.target.value)}
                    placeholder="e.g., 'I think the reading score is too low, she was tired during that part.'"
                    className="w-full border vi-border rounded-xl p-3 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-reading)/0.5)] font-body"
                  />
                </div>

                <div>
                  <label
                    htmlFor="missing-info"
                    className="block text-sm font-semibold text-slate-800 mb-1"
                  >
                    Missing Information
                  </label>
                  <textarea
                    id="missing-info"
                    value={missingInfo}
                    onChange={(e) => setMissingInfo(e.target.value)}
                    placeholder="e.g., 'She also speaks Spanish at home.' 'He uses a communication device.'"
                    className="w-full border vi-border rounded-xl p-3 text-sm min-h-[70px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-reading)/0.5)] font-body"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddContext}
                    disabled={
                      submitting ||
                      (!learningContext.trim() &&
                        !clinicalContext.trim() &&
                        !assessmentConcerns.trim() &&
                        !missingInfo.trim())
                    }
                    style={{ minHeight: 44 }}
                    className="flex-1 px-6 py-3 bg-[hsl(var(--visual-reading))] text-white font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-reading)/0.9)] transition disabled:opacity-50"
                  >
                    {submitting ? "Rebuilding..." : "Submit & Rebuild"}
                  </button>
                  <button
                    onClick={() => {
                      setShowContextForm(false);
                      setLearningContext("");
                      setClinicalContext("");
                      setAssessmentConcerns("");
                      setMissingInfo("");
                    }}
                    style={{ minHeight: 44 }}
                    className="px-6 py-3 border vi-border vi-text-muted font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-surface-soft))] transition"
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              </div>
            ) : showStartOverConfirm ? (
              <div className="space-y-4">
                <div className="vi-surface-soft border vi-border rounded-xl p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-1">Start Over</p>
                  <p className="text-sm vi-text-muted">
                    This will reset the assessment. {review.learner_name} will need to take the
                    Discovery Adventure again.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="start-over-reason"
                    className="block text-sm font-semibold text-slate-800 mb-1"
                  >
                    Reason (optional)
                  </label>
                  <textarea
                    id="start-over-reason"
                    value={startOverReason}
                    onChange={(e) => setStartOverReason(e.target.value)}
                    placeholder="e.g., 'She was having a bad day.' 'The environment was too distracting.'"
                    className="w-full border vi-border rounded-xl p-3 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--visual-primary)/0.4)] font-body"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleStartOver}
                    disabled={submitting}
                    style={{ minHeight: 44 }}
                    className="flex-1 px-6 py-3 bg-[hsl(var(--visual-math))] text-white font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-math)/0.9)] transition disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "Confirm Start Over"}
                  </button>
                  <button
                    onClick={() => {
                      setShowStartOverConfirm(false);
                      setStartOverReason("");
                    }}
                    style={{ minHeight: 44 }}
                    className="px-6 py-3 border vi-border vi-text-muted font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-surface-soft))] transition"
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={submitting || !consentChecked}
                  style={{ minHeight: 44 }}
                  className="flex-1 px-6 py-3 bg-[hsl(var(--visual-science))] text-white font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-science)/0.9)] transition disabled:opacity-50"
                >
                  {submitting
                    ? "Approving..."
                    : `Approve${modCount > 0 ? ` (${modCount} changes)` : ""}`}
                </button>
                <button
                  onClick={() => setShowContextForm(true)}
                  disabled={submitting}
                  style={{ minHeight: 44 }}
                  className="flex-1 px-6 py-3 bg-[hsl(var(--visual-reading))] text-white font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-reading)/0.9)] transition disabled:opacity-50"
                >
                  Add Context & Rebuild
                </button>
                <button
                  onClick={() => setShowStartOverConfirm(true)}
                  disabled={submitting}
                  style={{ minHeight: 44 }}
                  className="px-6 py-3 vi-surface-soft vi-text-muted font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-border))] transition disabled:opacity-50 border vi-border"
                >
                  Start Over
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PreCloneReview({
  preCloneData,
  learnerId,
  consentChecked,
  setConsentChecked,
  submitting,
  onCloneAndBuild,
  userName,
}: {
  preCloneData: PreCloneData | null;
  learnerId: string;
  consentChecked: boolean;
  setConsentChecked: (v: boolean) => void;
  submitting: boolean;
  onCloneAndBuild: () => void;
  userName: string;
}) {
  const learnerName = preCloneData?.learner?.name || "Your child";
  const fl = preCloneData?.template_preview?.functioning_level || "STANDARD";
  const baselineScores = preCloneData?.baseline_assessment?.domain_scores;
  const parentAssessment = preCloneData?.parent_assessment;

  const steps: Array<{ icon: React.ReactNode; title: string; desc: string }> = [
    {
      icon: <ClipboardList className="w-5 h-5" />,
      title: "Load Assessment Data",
      desc: `Pull ${learnerName}'s baseline and parent assessment results`,
    },
    {
      icon: <Dna className="w-5 h-5" />,
      title: "Select Brain Template",
      desc: `Use the ${fl.replace(/_/g, " ")} template as a starting point`,
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Set Learning Levels",
      desc: "Calculate mastery percentages for each subject from assessment scores",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Configure Supports",
      desc: "Activate accommodations based on parent-reported needs and assessment signals",
    },
    {
      icon: <GraduationCap className="w-5 h-5" />,
      title: "Assign AI Tutors",
      desc: "Match each subject with a specialized AI tutor character",
    },
    {
      icon: <Target className="w-5 h-5" />,
      title: "Map Learning Paths",
      desc: "Plot step-by-step goals from current level toward grade-level objectives",
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: "Save & Encrypt",
      desc: "Store the Brain securely with full versioning and rollback capability",
    },
  ];

  return (
    <div className="min-h-screen vi-bg">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-6 py-4 flex items-center justify-between">
        <Image
          src="/images/aivo-logo-purple.png"
          alt="AIVO"
          width={120}
          height={36}
          style={{ height: "auto" }}
        />
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/parent/learner/${learnerId}`}
            className="text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline"
          >
            Back to Profile
          </Link>
          <span className="text-sm font-semibold vi-text-muted">{userName}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <IconWell color="primary">
              <Brain className="w-8 h-8" />
            </IconWell>
          </div>
          <h1 className="text-3xl font-heading font-bold vi-text mb-2">
            Build {learnerName}&apos;s Learning Brain
          </h1>
          <p className="vi-text-muted font-body max-w-xl mx-auto">
            Review the assessment data below. When you approve, we&apos;ll build a personalized
            learning profile (Brain) that powers everything {learnerName} experiences on AIVO.
          </p>
        </div>

        {parentAssessment && (
          <div className="vi-card p-6 mb-6">
            <h2 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-3">
              <IconWell color="primary" size="sm">
                <Users2 className="w-5 h-5" />
              </IconWell>{" "}
              Your Parent Assessment
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {parentAssessment.communication_mode && (
                <div className="bg-[hsl(var(--visual-primary)/0.08)] rounded-xl p-3">
                  <p className="text-xs font-bold text-[hsl(var(--visual-primary))] uppercase">
                    Communication
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {parentAssessment.communication_mode.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {parentAssessment.device_interaction && (
                <div className="bg-[hsl(var(--visual-primary)/0.08)] rounded-xl p-3">
                  <p className="text-xs font-bold text-[hsl(var(--visual-primary))] uppercase">
                    Device Interaction
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {parentAssessment.device_interaction.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {parentAssessment.attention_span && (
                <div className="bg-[hsl(var(--visual-primary)/0.08)] rounded-xl p-3">
                  <p className="text-xs font-bold text-[hsl(var(--visual-primary))] uppercase">
                    Attention Span
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {parentAssessment.attention_span.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {parentAssessment.response_method && (
                <div className="bg-[hsl(var(--visual-primary)/0.08)] rounded-xl p-3">
                  <p className="text-xs font-bold text-[hsl(var(--visual-primary))] uppercase">
                    Response Method
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {parentAssessment.response_method.replace(/_/g, " ")}
                  </p>
                </div>
              )}
              {parentAssessment.diagnoses?.length > 0 && (
                <div className="bg-[hsl(var(--visual-primary)/0.08)] rounded-xl p-3 col-span-2">
                  <p className="text-xs font-bold text-[hsl(var(--visual-primary))] uppercase mb-1">
                    Diagnoses
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {parentAssessment.diagnoses.map((d: string) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] rounded text-xs font-semibold"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {baselineScores && Object.keys(baselineScores).length > 0 && (
          <div className="vi-card p-6 mb-6">
            <h2 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-3">
              <IconWell color="reading" size="sm">
                <BarChart3 className="w-5 h-5" />
              </IconWell>{" "}
              Baseline Assessment Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(baselineScores).map(([domain, score]) => (
                <div
                  key={domain}
                  className="bg-[hsl(var(--visual-reading)/0.08)] rounded-xl p-3 text-center"
                >
                  <span className="mx-auto mb-1 inline-flex">
                    <MasteryWell domain={domain} size="sm" iconClassName="w-5 h-5" />
                  </span>
                  <p className="text-xs font-bold vi-text-muted uppercase">
                    {domain.replace(/_/g, " ")}
                  </p>
                  <p className="text-lg font-heading font-bold vi-text">
                    {Math.round(Number(score) * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="vi-card p-6 mb-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-3">
            <IconWell color="primary" size="sm">
              <Wrench className="w-5 h-5" />
            </IconWell>{" "}
            What the Brain Builder Will Do
          </h2>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4 vi-surface-soft rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center flex-shrink-0">
                  {step.icon}
                </div>
                <div>
                  <p className="font-heading font-bold text-sm vi-text">
                    Step {i + 1}: {step.title}
                  </p>
                  <p className="text-xs vi-text-muted font-body">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {preCloneData?.template_preview && (
          <div className="vi-card p-6 mb-6">
            <h2 className="font-heading font-bold text-lg vi-text mb-4 flex items-center gap-3">
              <IconWell color="primary" size="sm">
                <Dna className="w-5 h-5" />
              </IconWell>{" "}
              Template Preview
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="vi-surface-soft rounded-xl p-3">
                <p className="text-xs font-bold vi-text-muted uppercase">Functioning Level</p>
                <p className="text-sm font-semibold text-slate-800">
                  {fl.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
              </div>
              <div className="vi-surface-soft rounded-xl p-3">
                <p className="text-xs font-bold vi-text-muted uppercase">Domains</p>
                <p className="text-sm font-semibold text-slate-800">
                  {preCloneData.template_preview.domains.length} subjects
                </p>
              </div>
              <div className="vi-surface-soft rounded-xl p-3">
                <p className="text-xs font-bold vi-text-muted uppercase">Accommodations</p>
                <p className="text-sm font-semibold text-slate-800">
                  {preCloneData.template_preview.accommodations.length} supports
                </p>
              </div>
              <div className="vi-surface-soft rounded-xl p-3">
                <p className="text-xs font-bold vi-text-muted uppercase">AI Tutors</p>
                <p className="text-sm font-semibold text-slate-800">
                  {preCloneData.template_preview.tutors.length} tutors
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="vi-card p-6 shadow-xl">
          <div className="mb-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded vi-border text-[hsl(var(--visual-primary))] focus:ring-[hsl(var(--visual-primary))]"
              />
              <span className="text-sm text-slate-800 leading-relaxed">
                I consent to AIVO creating a personalized learning profile (Brain) for {learnerName}{" "}
                based on the assessment data shown above. I understand this data will be used to
                personalize their learning experience and can be deleted at any time.
                <span className="vi-text-muted text-xs block mt-1">
                  COPPA Parental Consent v1.0
                </span>
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCloneAndBuild}
              disabled={submitting || !consentChecked}
              style={{ minHeight: 44 }}
              className="flex-1 px-6 py-4 bg-[hsl(var(--visual-primary))] text-white font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50 text-lg"
            >
              {submitting ? "Building..." : "Approve & Build Brain"}
            </button>
            <Link
              href={`/dashboard/parent/learner/${learnerId}`}
              style={{ minHeight: 44 }}
              className="px-6 py-4 vi-surface-soft vi-text-muted font-heading font-bold rounded-xl hover:bg-[hsl(var(--visual-border))] transition border vi-border text-center"
            >
              Not Yet
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
