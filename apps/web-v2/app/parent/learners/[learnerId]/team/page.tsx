/**
 * Sprint 30: Parent · Care team.
 * Lists every adult connected to this learner: parents/guardians, classroom
 * teachers (via enrollments), and tenant memberships. Mirrors the legacy
 * collaboration page. Uses existing parentLearnerRelationships + enrollments
 * + memberships — no new data layer required.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, Users } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getStore as db } from "@/lib/db/store";
import { getLearner, getUserById, parentCanAccessLearner } from "@/lib/db/repos";
import { getCareTeam } from "@/lib/db/team-invites";
import { hasTeacherContributed } from "@/lib/teacher/teacher-assessment-status";
import { getContributionStatus } from "@/lib/collaboration/contribution-status";
import { TeamInviteSection } from "./team-invite-section";
import { TeamHub } from "./team-hub";
import { completeTeamInviteStepAction } from "./actions";
export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  parent: "Parent / Guardian",
  teacher: "Teacher",
  therapist: "Therapist",
  caregiver: "Caregiver",
  school_admin: "School admin",
  district_admin: "District admin",
};

type TeamMember = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  context: string;
  isPrimary?: boolean;
  /** C-07: a teacher whose assessment is submitted shows "Contributed ✓". */
  contributed?: boolean;
};

export default async function ParentTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const t = await getTranslations("parent.learner_team");
  const tHub = await getTranslations("parent.team_hub");
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  const { onboarding } = await searchParams;
  const isOnboarding = onboarding === "1";
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  // C-08: one care-team read, shared by the invite section + the hub +
  // the contribution-status derivation (avoids three duplicate reads).
  const careTeam = await getCareTeam(learner.id, session.tenantId);
  const contributions = await getContributionStatus(learner.id, session.tenantId, careTeam);

  const store = db();
  const members = new Map<string, TeamMember>();

  // Parents, guardians, and caregivers from explicit relationships only —
  // this is the single source of truth for who is linked to *this* learner.
  for (const rel of store.parentLearnerRelationships) {
    if (rel.learnerId !== learner.id || rel.tenantId !== session.tenantId) continue;
    const u = await getUserById(rel.parentUserId);
    if (!u) continue;
    const role =
      rel.relation === "caregiver"
        ? "caregiver"
        : rel.relation === "guardian"
          ? "guardian"
          : "parent";
    members.set(u.id, {
      userId: u.id,
      displayName: u.displayName,
      email: u.email,
      role,
      context:
        rel.relation === "guardian"
          ? "Legal guardian"
          : rel.relation === "caregiver"
            ? "Caregiver"
            : "Parent",
      isPrimary: rel.isPrimary,
    });
  }

  // Classroom teachers via enrollments — strictly tenant-scoped on every hop
  // so a roster row from another tenant cannot leak in if learner ids ever
  // overlap in the in-memory store.
  const learnerEnrollments = Array.from(store.enrollments.values()).filter(
    (e) => e.tenantId === learner.tenantId && e.subjectId === learner.id && e.role === "learner",
  );
  for (const lEnr of learnerEnrollments) {
    const classroom = store.classrooms.get(lEnr.classroomId);
    if (!classroom || classroom.tenantId !== learner.tenantId) continue;
    const teacherEnrs = Array.from(store.enrollments.values()).filter(
      (e) =>
        e.tenantId === learner.tenantId &&
        e.classroomId === lEnr.classroomId &&
        e.role === "teacher",
    );
    for (const tEnr of teacherEnrs) {
      const u = await getUserById(tEnr.subjectId);
      if (!u || members.has(u.id)) continue;
      members.set(u.id, {
        userId: u.id,
        displayName: u.displayName,
        email: u.email,
        role: "teacher",
        context: `Teacher · ${classroom.name}`,
      });
    }
  }
  // Therapists / co-caregivers without a parentLearnerRelationship are
  // intentionally omitted — generic tenant membership does not imply a link
  // to this specific learner and surfacing them would leak unrelated adults.

  // C-07 EDIT-1: flag teachers who have submitted their assessment so the
  // parent sees a "Contributed ✓" badge. Status comes from the assessment
  // status route with a local-draft fallback (see teacher-assessment-status).
  await Promise.all(
    Array.from(members.values())
      .filter((m) => m.role === "teacher")
      .map(async (m) => {
        m.contributed = await hasTeacherContributed(learner.id, learner.tenantId, m.userId);
      }),
  );

  const list = Array.from(members.values()).sort((a, b) => {
    if (a.role === "parent" && b.role !== "parent") return -1;
    if (b.role === "parent" && a.role !== "parent") return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <div className="flex items-center gap-3.5">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[13px] bg-iw-primary-soft text-[var(--aivo-sensory-primary)]"
          aria-hidden="true"
        >
          <Users className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="font-iw-display text-2xl font-bold text-iw-text-strong">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-iw-text-muted">
            Everyone supporting this learner. Parents, teachers, therapists, and caregivers can all
            see progress.
          </p>
        </div>
      </div>

      {isOnboarding ? (
        <Card className="mb-2 border-iw-warm/40 bg-iw-warm/5 p-[var(--aivo-density-card-pad)]">
          <p className="text-sm font-semibold text-iw-ink">{t("onboarding_title")}</p>
          <p className="mt-1 text-sm text-iw-ink-muted">{t("onboarding_subtitle")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={completeTeamInviteStepAction}>
              <input type="hidden" name="learnerId" value={learner.id} />
              <input type="hidden" name="intent" value="continue" />
              <button
                type="submit"
                className="rounded-md bg-iw-warm px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {t("continue_to_baseline")}
              </button>
            </form>
            <form action={completeTeamInviteStepAction}>
              <input type="hidden" name="learnerId" value={learner.id} />
              <input type="hidden" name="intent" value="skip" />
              <button
                type="submit"
                className="rounded-md border border-iw-border px-4 py-2 text-sm font-semibold text-iw-ink-muted hover:bg-iw-raised"
              >
                {t("skip_for_now")}
              </button>
            </form>
          </div>
        </Card>
      ) : null}

      <SectionHeader title={t("invite_member")} />
      <TeamInviteSection learnerId={learner.id} careTeam={careTeam} />

      {/* Sprint C-08 — the orchestration hub: where each invited teammate
          stands (invited → on the team → contributed), one-tap remind, remove
          with confirm. Fed by the contribution-status derivation. */}
      <SectionHeader title={tHub("section_title")} />
      {contributions.members.length > 0 ? (
        <p className="mb-2 text-sm text-iw-ink-muted">
          {tHub("voices_summary", {
            contributed: contributions.voices.contributed,
            invited: contributions.voices.invited,
            name: learner.displayName,
          })}
        </p>
      ) : null}
      <TeamHub
        learnerId={learner.id}
        learnerName={learner.displayName}
        members={contributions.members}
      />

      {list.length > 0 ? (
        <>
          <SectionHeader title={t("classroom_connections_title")} />
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((m) => (
              <li key={m.userId}>
                <Card className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{m.displayName}</p>
                      {m.isPrimary ? <Badge tone="success">{t("primary")}</Badge> : null}
                      <Badge tone="neutral">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                      {m.contributed ? <Badge tone="success">{t("contributed")}</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-iw-ink-muted">{m.context}</p>
                    <a
                      href={`mailto:${m.email}`}
                      className="mt-1 flex items-center gap-1 text-xs text-iw-warm hover:underline"
                    >
                      <Mail className="h-3 w-3" /> {m.email}
                    </a>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <SectionHeader title={t("how_collab_works")} />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <ul className="list-disc space-y-1 pl-5 text-sm text-iw-ink-muted">
          <li>{t("collab_parents")}</li>
          <li>{t("collab_teachers")}</li>
          <li>{t("collab_therapists")}</li>
          <li>
            Any member can be removed at any time from{" "}
            <Link
              href={`/parent/learners/${learner.id}/settings`}
              className="text-iw-warm underline underline-offset-4"
            >
              learner settings
            </Link>
            .
          </li>
        </ul>
      </Card>
    </AppShell>
  );
}
