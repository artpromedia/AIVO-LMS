/**
 * Sprint C-05 — Review & correct screen (storyboard screen 5).
 *
 * The page a parent lands on from the recap's "Check & adjust" CTA. Every
 * inference is one row in a conversation — "Did we get this right?" — with
 * ✓ "That's right" / ✎ "Not quite". Corrections open inline controls plus an
 * optional note, save server-side as a staged draft
 * (`state.parentCorrectionsDraft` — resume-safe, never component-state-only),
 * and are folded into the live profile when the parent approves on the recap
 * (`approveBrainClone` + the fold rules in `lib/db/brain-corrections.ts`).
 *
 * Therapist-recommended supports render locked with attribution and are ALSO
 * rejected server-side if a forged request tries to remove them.
 *
 * States: loading (`loading.tsx`), no-profile / pre-clone (redirect to the
 * brain-clone-watch surface, which owns pending/rebuild), already-approved
 * (friendly closed-review card, never a dead end), zero-corrections
 * (confirm-all fast path in the sticky footer), save-error (kind retry in
 * the client), success (staged + routed to the recap to approve).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getBrainProfile, getLearner, parentCanAccessLearner } from "@/lib/db/repos";
import { SUPPORT_DEFAULT_BY_SLUG, type CoreSupportSlug } from "@/lib/db/brain-corrections";
import type { LearnerBrainProfileState } from "@/lib/db/types";
import { saveBrainCorrectionsAction } from "./actions";
import {
  BrainReviewClient,
  type SupportRowDTO,
  type TutorRowDTO,
  type ComfortRowDTO,
} from "./review-client";

/** Core five supports — label/reason i18n keys under `parent.brain_review`. */
const CORE_SUPPORTS: Array<{
  slug: CoreSupportSlug;
  labelKey: string;
  reasonKey: string;
}> = [
  { slug: "extended_time", labelKey: "support_extended_time", reasonKey: "support_extended_time_reason" },
  { slug: "read_aloud", labelKey: "support_read_aloud", reasonKey: "support_read_aloud_reason" },
  { slug: "speech_to_text", labelKey: "support_speech_to_text", reasonKey: "support_speech_to_text_reason" },
  { slug: "visual_schedules", labelKey: "support_visual_schedules", reasonKey: "support_visual_schedules_reason" },
  { slug: "sensory_breaks", labelKey: "support_sensory_breaks", reasonKey: "support_sensory_breaks_reason" },
];

/** Known non-core slugs with a translated label. */
const EXTRA_SUPPORT_LABEL_KEY: Record<string, string> = {
  aac_communication_support: "support_aac_communication_support",
};

/** Defensive humanizer for raw IEP accommodation strings / unknown slugs. */
function humanize(value: string): string {
  const spaced = value.replace(/[-_]/g, " ").trim();
  return spaced.length === 0 ? value : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function buildSupportRows(
  state: LearnerBrainProfileState,
  t: Awaited<ReturnType<typeof getTranslations>>,
  name: string,
): SupportRowDTO[] {
  const detailed = new Map(
    (state.xaiExplanation.accommodationDecisionsDetailed ?? []).map((d) => [d.accommodation, d]),
  );
  const rows: SupportRowDTO[] = [];
  for (const core of CORE_SUPPORTS) {
    const d = detailed.get(core.slug);
    rows.push({
      slug: core.slug,
      field: `accommodation.${core.slug}`,
      label: t(core.labelKey),
      enabled:
        state.supportDefaults[SUPPORT_DEFAULT_BY_SLUG[core.slug]] ||
        state.activeAccommodations.includes(core.slug),
      reasoning: d?.reasoning || t(core.reasonKey, { name }),
      locked: d?.removable === false,
    });
  }
  const coreSlugs = new Set<string>(CORE_SUPPORTS.map((c) => c.slug));
  for (const acc of state.activeAccommodations) {
    if (coreSlugs.has(acc)) continue;
    const d = detailed.get(acc);
    const labelKey = EXTRA_SUPPORT_LABEL_KEY[acc];
    rows.push({
      slug: acc,
      field: `accommodation.${acc}`,
      label: d?.displayLabel ?? (labelKey ? t(labelKey) : humanize(acc)),
      enabled: true,
      reasoning: d?.reasoning ?? t("reasoning_support_iep"),
      locked: d?.removable === false,
    });
  }
  return rows;
}

export default async function BrainReviewPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const profile = await getBrainProfile(learnerId, session.tenantId);
  // No reviewable profile yet: the brain-clone-watch surface owns the
  // pending/rebuild states (and bounces to the baseline when that's the
  // actual blocker) — never render a dead end here.
  if (!profile || profile.cloneStage === "pre_clone") {
    redirect(`/parent/learners/${learnerId}/brain-clone-watch`);
  }
  const t = await getTranslations("parent.brain_review");
  const name = learner.displayName;

  if (profile.cloneStage === "approved") {
    // Review closed — the corrections loop already finished. Point onward.
    return (
      <AppShell
        role="parent"
        roleLabel="Parent"
        navItems={PARENT_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow={t("eyebrow", { name })}
          title={t("already_approved_title", { name })}
          description={t("already_approved_body", { name })}
        />
        <Card className="flex flex-wrap items-center gap-3 p-[var(--aivo-density-card-pad)]">
          <Button asChild>
            <Link href={`/parent/learners/${learnerId}/brain-profile`}>
              {t("already_approved_view")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/parent/learners/${learnerId}`}>{t("back_to_learner", { name })}</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  const s = profile.state;
  const supportRows = buildSupportRows(s, t, name);
  const tutorDetailed = new Map(
    (s.xaiExplanation.tutorDecisionsDetailed ?? []).map((d) => [d.tutorKey, d]),
  );
  const tutorRows: TutorRowDTO[] = s.activeTutors.map((key) => ({
    key,
    field: `tutor.${key}`,
    name: TUTORS[key as TutorKey]?.name ?? humanize(key),
    reasoning: tutorDetailed.get(key)?.reasoning ?? t("reasoning_tutor_fallback", { name }),
  }));
  const comfortRows: ComfortRowDTO[] = [
    { field: "readingComfort", current: s.readingComfort },
    { field: "mathComfort", current: s.mathComfort },
  ];

  // Resume state: corrections staged on a previous visit prefill their rows.
  const draft = s.parentCorrectionsDraft;
  const initialValues: Record<string, string> = {};
  const initialNotes: Record<string, string> = {};
  for (const m of draft?.modifications ?? []) {
    if (typeof m.parentValue === "boolean") {
      initialValues[m.field] = m.parentValue ? "on" : "off";
    } else if (typeof m.parentValue === "string") {
      initialValues[m.field] = m.parentValue;
    }
    if (m.parentNote) initialNotes[m.field] = m.parentNote;
  }

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <div className="mb-3">
        <Link
          href={`/parent/learners/${learnerId}/brain-clone-watch`}
          className="inline-flex items-center gap-1 text-sm text-aivo-ink-soft hover:text-aivo-ink hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("back_to_summary")}
        </Link>
      </div>
      <PageHeader
        eyebrow={t("eyebrow", { name })}
        title={t("page_title")}
        description={t("page_description", { name })}
      />
      <BrainReviewClient
        learnerId={learnerId}
        learnerName={name}
        comfortRows={comfortRows}
        modalities={s.preferredModalities}
        supportRows={supportRows}
        tutorRows={tutorRows}
        initialValues={initialValues}
        initialNotes={initialNotes}
        hasDraft={Boolean(draft && draft.modifications.length > 0)}
        saveAction={saveBrainCorrectionsAction}
      />
    </AppShell>
  );
}
