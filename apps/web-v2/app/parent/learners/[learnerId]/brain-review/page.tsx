/**
 * BrainReview (BrainReview.dc.html) — the parent's pre-clone review + consent.
 *
 * The handoff is the source of truth: a focused "Setup" surface (no role nav)
 * with the onboarding stepper, a "Meet {name}'s Virtual Brain" hero, and a
 * single column that reviews the AI-built profile (removable Superpowers /
 * Support tags, sensory + pacing + guide), lets the parent add context or
 * request changes, and captures COPPA/FERPA consent to "Approve & Create".
 *
 * Approval + corrections reuse the existing, legally-vetted core
 * (`performBrainApproval`, `stageBrainCorrections`) via `./actions` — this
 * screen relocates the UI, not the trust gate. States: no-profile / pre-clone
 * (redirect to clone-watch, which owns pending/rebuild), already-approved
 * (friendly closed-review card, never a dead end), reviewable (the full
 * handoff). Therapist-pinned supports render locked and are rejected
 * server-side if a forged request removes them.
 */
import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { requirePageRole } from "@/lib/auth/server";
import { getBrainProfile, getLearner, parentCanAccessLearner } from "@/lib/db/repos";
import {
  SUPPORT_DEFAULT_BY_SLUG,
  lockedAccommodationSlugs,
  type CoreSupportSlug,
} from "@/lib/db/brain-corrections";
import type { LearnerBrainProfileState } from "@/lib/db/types";
import { stageReviewAction, approveFromReviewAction } from "./actions";
import {
  BrainReviewClient,
  type TagDTO,
  type SensoryDTO,
  type PacingDTO,
  type GuideDTO,
  type RaiDTO,
} from "./review-client";
import styles from "./brain-review.module.css";

/** Core five supports — label/reason i18n keys under `parent.brain_review`. */
const CORE_SUPPORTS: Array<{ slug: CoreSupportSlug; labelKey: string }> = [
  { slug: "extended_time", labelKey: "support_extended_time" },
  { slug: "read_aloud", labelKey: "support_read_aloud" },
  { slug: "speech_to_text", labelKey: "support_speech_to_text" },
  { slug: "visual_schedules", labelKey: "support_visual_schedules" },
  { slug: "sensory_breaks", labelKey: "support_sensory_breaks" },
];

const EXTRA_SUPPORT_LABEL_KEY: Record<string, string> = {
  aac_communication_support: "support_aac_communication_support",
};

const MODALITY_KEY: Record<string, string> = {
  visual: "superpower_visual",
  auditory: "superpower_auditory",
  kinesthetic: "superpower_kinesthetic",
  reading_writing: "superpower_reading_writing",
};

function humanize(value: string): string {
  const spaced = value.replace(/[-_]/g, " ").trim();
  return spaced.length === 0 ? value : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type T = Awaited<ReturnType<typeof getTranslations>>;

/** Superpowers (green, removable): preferred modalities + strong subjects +
 *  the rewards that motivate. Recorded-not-folded if a parent removes one. */
function buildSuperpowers(state: LearnerBrainProfileState, t: T): TagDTO[] {
  const tags: TagDTO[] = [];
  for (const m of state.preferredModalities) {
    const key = MODALITY_KEY[m];
    if (key) tags.push({ field: `superpower.modality_${m}`, label: t(key) });
  }
  for (const subj of state.masteryOverview) {
    if (subj.estimate === "confident" || subj.estimate === "advanced") {
      tags.push({ field: `superpower.subject_${subj.subjectId}`, label: subj.subjectName });
    }
  }
  for (const reward of state.motivationProfile.rewardsThatHelp.slice(0, 2)) {
    tags.push({ field: `superpower.reward_${reward.replace(/[^a-z0-9]+/gi, "_")}`, label: reward });
  }
  // Keep the card calm — at most five tags.
  return tags.slice(0, 5);
}

/** Support areas (red, removable). Therapist-pinned supports render locked. */
function buildSupports(state: LearnerBrainProfileState, t: T): TagDTO[] {
  const locked = lockedAccommodationSlugs(state);
  const seen = new Set<string>();
  const tags: TagDTO[] = [];
  const push = (slug: string, label: string) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    tags.push({ field: `accommodation.${slug}`, label, locked: locked.has(slug) });
  };
  for (const core of CORE_SUPPORTS) {
    const active =
      state.supportDefaults[SUPPORT_DEFAULT_BY_SLUG[core.slug]] ||
      state.activeAccommodations.includes(core.slug);
    if (active) push(core.slug, t(core.labelKey));
  }
  for (const acc of state.activeAccommodations) {
    if (seen.has(acc)) continue;
    const labelKey = EXTRA_SUPPORT_LABEL_KEY[acc];
    push(acc, labelKey ? t(labelKey) : humanize(acc));
  }
  return tags;
}

function buildSensory(state: LearnerBrainProfileState, t: T): SensoryDTO | null {
  const sp = state.sensoryProfile;
  const tags: string[] = [];
  if (state.accessibilityPreferences.audioFirst) tags.push(t("sensory_tag_audio_first"));
  if (state.supportDefaults.visualSchedules) tags.push(t("sensory_tag_visual_cues"));
  if (sp.seekingOrAvoiding === "avoiding") tags.push(t("sensory_tag_calm_space"));
  const body = sp.notes && sp.notes.trim().length > 0 ? sp.notes : t("sensory_default_body");
  if (tags.length === 0 && (!sp.notes || sp.notes.trim().length === 0)) return null;
  return { body, tags: tags.slice(0, 3) };
}

function buildPacing(state: LearnerBrainProfileState, t: T): PacingDTO {
  const mins = state.attentionProfile.focusWindowMinutes;
  const label = mins > 0 && mins <= 12 ? t("pacing_gentle") : mins <= 25 ? t("pacing_steady") : t("pacing_extended");
  const sub =
    state.attentionProfile.breakStyle === "frequent_short"
      ? t("pacing_sub_short")
      : state.attentionProfile.breakStyle === "long_uninterrupted"
        ? t("pacing_sub_long")
        : t("pacing_sub_occasional");
  return { label, sub };
}

const PERSONA_KEY: Record<string, string> = {
  warm_coach: "guide_style_warm_coach",
  playful_friend: "guide_style_playful_friend",
  calm_guide: "guide_style_calm_guide",
  structured_mentor: "guide_style_structured_mentor",
};

function buildGuide(state: LearnerBrainProfileState, t: T): GuideDTO | null {
  const key = state.activeTutors[0];
  if (!key) return null;
  const tutor = TUTORS[key as TutorKey];
  const styleKey = PERSONA_KEY[state.tutorPersonaRecommendation.style] ?? "guide_style_warm_coach";
  return {
    name: tutor?.name ?? humanize(key),
    icon: tutor?.icon ?? "✨",
    sub: t(styleKey),
  };
}

function buildRai(state: LearnerBrainProfileState): RaiDTO | null {
  const d = state.xaiExplanation.raiComplianceDetail;
  if (d) {
    return {
      dataSources: d.dataSources.slice(0, 6),
      biasMitigations: d.biasMitigations.slice(0, 6),
      transparency: d.transparency,
      oversight: d.humanOversight,
    };
  }
  // Flat fallback so the disclosure is never empty.
  return {
    dataSources: state.xaiExplanation.accommodationDecisions.slice(0, 4),
    biasMitigations: [],
    transparency: state.xaiExplanation.summary,
    oversight: "",
  };
}

const STEP_KEYS = [
  "step_assessment",
  "step_baseline",
  "step_build",
  "step_review",
  "step_consent",
  "step_ready",
] as const;
const ACTIVE_STEP = 3; // Parent Review

export default async function BrainReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const { error } = await searchParams;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const profile = await getBrainProfile(learnerId, session.tenantId);
  // No reviewable profile yet: the clone-watch surface owns pending/rebuild
  // (and bounces to the baseline when that's the blocker) — never a dead end.
  if (!profile || profile.cloneStage === "pre_clone") {
    redirect(`/parent/learners/${learnerId}/brain-clone-watch`);
  }
  const t = await getTranslations("parent.brain_review");
  const name = learner.preferredName || learner.firstName || learner.displayName;

  const SetupChrome = (
    <header className="border-b border-iw-border bg-white">
      <div className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between px-6 md:px-9">
        <div className="flex items-center gap-2.5">
          <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={112} height={28} className="h-7 w-auto" priority />
          <span className="font-iw-display text-base font-bold text-iw-text-muted">| {t("setup_eyebrow")}</span>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-bold text-iw-text-muted">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {t("secure_private")}
        </span>
      </div>
    </header>
  );

  /* ── Already-approved: review closed, never a dead end ─────────────── */
  if (profile.cloneStage === "approved") {
    return (
      <div className={styles.canvas}>
        {SetupChrome}
        <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
          <div className="text-[96px] leading-none" aria-hidden="true">🧠</div>
          <h1 className="font-iw-display mt-2 text-3xl font-bold text-iw-text-strong">
            {t("already_approved_title", { name })}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-base leading-relaxed text-iw-text-muted">
            {t("already_approved_body", { name })}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/parent/learners/${learnerId}/brain-profile`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--aivo-sensory-primary)] px-6 py-3 text-base font-bold text-white shadow-[0_12px_26px_rgba(124,58,237,0.3)] hover:brightness-110"
            >
              {t("already_approved_view")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/parent/learners/${learnerId}`}
              className="inline-flex items-center rounded-full bg-white px-6 py-3 text-base font-bold text-iw-text-strong shadow-[0_6px_18px_rgba(60,40,110,0.08)] hover:bg-[var(--aivo-color-surface-sunken)]"
            >
              {t("back_to_learner", { name })}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const s = profile.state;

  return (
    <div className={styles.canvas}>
      {SetupChrome}

      {/* Onboarding stepper */}
      <div className="mx-auto w-full max-w-5xl px-6 pt-8 md:px-9">
        <ol className="relative flex items-start justify-between">
          <span aria-hidden="true" className="absolute left-[9%] right-[9%] top-[13px] h-[3px] bg-[var(--aivo-color-aivoPurple-100)]" />
          <span
            aria-hidden="true"
            className="absolute left-[9%] top-[13px] h-[3px] bg-[var(--aivo-color-aivoTeal-600)]"
            style={{ width: `${(ACTIVE_STEP / (STEP_KEYS.length - 1)) * (100 - 18)}%` }}
          />
          {STEP_KEYS.map((key, i) => {
            const done = i < ACTIVE_STEP;
            const active = i === ACTIVE_STEP;
            return (
              <li key={key} className="relative z-[1] flex flex-1 flex-col items-center gap-2">
                <span
                  aria-current={active ? "step" : undefined}
                  className={
                    done
                      ? "flex h-7 w-7 items-center justify-center rounded-full bg-[var(--aivo-color-aivoTeal-600)] text-white"
                      : active
                        ? "flex h-7 w-7 items-center justify-center rounded-full bg-[var(--aivo-sensory-primary)] text-white shadow-[0_0_0_5px_rgba(124,58,237,0.18)]"
                        : "flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--aivo-color-aivoPurple-100)] bg-white"
                  }
                >
                  {done ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : active ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </span>
                <span
                  className={
                    "text-center text-[12.5px] font-bold " +
                    (active
                      ? "text-[var(--aivo-sensory-primary)]"
                      : done
                        ? "text-[var(--aivo-color-aivoTeal-600)]"
                        : "text-iw-text-muted")
                  }
                >
                  {t(key)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-8 md:px-9">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,380px)_1fr]">
          {/* Left: meet the brain */}
          <div className="pt-2 text-center">
            <div className="relative inline-block">
              <div className="absolute -right-3 top-1.5 z-[2] rounded-[14px_14px_14px_2px] bg-white px-3.5 py-2 text-sm font-bold text-iw-text-strong shadow-[0_8px_22px_rgba(60,40,110,0.12)]">
                {t("hero_ready_bubble")}
              </div>
              <div className={styles.brain} aria-hidden="true">🧠</div>
            </div>
            <h1 className="font-iw-display mt-3.5 text-3xl font-bold leading-tight text-iw-text-strong">
              {t.rich("hero_title", {
                name,
                accent: (chunks) => <span className="text-[var(--aivo-sensory-primary)]">{chunks}</span>,
              })}
            </h1>
            <p className="mx-auto mt-3.5 max-w-md text-base leading-relaxed text-iw-text-muted">
              {t("hero_body", { name })}
            </p>
            <div className="mt-6 rounded-[18px] bg-white p-5 text-left shadow-[0_8px_24px_rgba(60,40,110,0.06)]">
              <div className="mb-1.5 flex items-center gap-2 text-[15px] font-bold text-[var(--aivo-color-aivoTeal-600)]">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5l-8-3Z" />
                </svg>
                {t("control_title")}
              </div>
              <p className="text-[13.5px] leading-relaxed text-[var(--aivo-color-aivoTeal-700)]">
                {t("control_body", { name })}
              </p>
            </div>
          </div>

          {/* Right: review + actions + consent (interactive) */}
          <BrainReviewClient
            learnerId={learnerId}
            learnerName={name}
            superpowers={buildSuperpowers(s, t)}
            supports={buildSupports(s, t)}
            sensory={buildSensory(s, t)}
            pacing={buildPacing(s, t)}
            guide={buildGuide(s, t)}
            rai={buildRai(s)}
            editProfileHref={`/parent/learners/${learnerId}/brain-profile`}
            backHref={`/parent/learners/${learnerId}/brain-clone-watch`}
            raiVersion={String(profile.revision)}
            initialError={error ?? null}
            stageAction={stageReviewAction}
            approveAction={approveFromReviewAction}
          />
        </div>
      </main>
    </div>
  );
}
