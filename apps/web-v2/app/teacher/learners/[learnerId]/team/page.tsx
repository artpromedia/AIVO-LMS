/**
 * Teacher · Build the team.
 *
 * The teacher-side mirror of the parent care-team invite page. A teacher who
 * teaches this learner (accepted classroom/roster link) can invite the
 * NON-teaching adults who also know the child — family caregivers and
 * related-service therapists — so their read shapes the learning profile
 * alongside the teacher's own classroom assessment.
 *
 * RBAC: `teacherCanAccessLearner` gates the whole page (404 otherwise), and
 * every server action re-checks it. The single teacher seat is parent-owned, so
 * it is not invitable here.
 *
 * The "where the team stands" section is READ-ONLY for teachers: it reuses the
 * shared contribution-status derivation but deliberately does NOT reuse the
 * parent TeamHub component, whose Remind/Remove controls call parent-only
 * server actions.
 */
import { notFound } from "next/navigation";
import { GraduationCap, HeartHandshake, Brain, Check, Clock, UserCheck } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getLearner, teacherCanAccessLearner } from "@/lib/db/repos";
import { getCareTeam, type TeamRole } from "@/lib/db/team-invites";
import {
  getContributionStatus,
  type MemberContributionStatus,
} from "@/lib/collaboration/contribution-status";
import { TeamInviteSection } from "./team-invite-section";

export const dynamic = "force-dynamic";

const ROLE_META: Record<TeamRole, { labelKey: string; icon: React.ReactNode; accent: string }> = {
  teacher: {
    labelKey: "role_teacher",
    icon: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
    accent: "bg-iw-accent-soft text-iw-teal-700 border-iw-accent",
  },
  caregiver: {
    labelKey: "role_caregiver",
    icon: <HeartHandshake className="h-4 w-4" aria-hidden="true" />,
    accent: "bg-iw-success-subtle text-iw-success-strong border-iw-success",
  },
  therapist: {
    labelKey: "role_therapist",
    icon: <Brain className="h-4 w-4" aria-hidden="true" />,
    accent: "bg-iw-purple-100 text-iw-primary border-iw-purple-200",
  },
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function TeacherTeamPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const t = await getTranslations("teacher.learner_team");
  const session = await requirePageRole(["teacher"]);
  const { learnerId } = await params;
  if (!(await teacherCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  // One care-team read, shared by the invite section + the read-only status.
  const careTeam = await getCareTeam(learner.id, session.tenantId);
  const contributions = await getContributionStatus(learner.id, session.tenantId, careTeam);

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title={t("title")}
        description={t("description", { name: learner.displayName })}
      />

      <SectionHeader title={t("invite_member")} />
      <TeamInviteSection learnerId={learner.id} careTeam={careTeam} viewerId={session.userId} />

      <SectionHeader title={t("team_status_title")} />
      {contributions.members.length > 0 ? (
        <p className="mb-2 text-sm text-iw-ink-muted">
          {t("team_status_summary", {
            contributed: contributions.voices.contributed,
            invited: contributions.voices.invited,
            name: learner.displayName,
          })}
        </p>
      ) : null}
      <TeamStatusList members={contributions.members} learnerName={learner.displayName} />

      <SectionHeader title={t("how_title")} />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <ul className="list-disc space-y-1 pl-5 text-sm text-iw-ink-muted">
          <li>{t("how_1")}</li>
          <li>{t("how_2")}</li>
          <li>{t("how_3")}</li>
        </ul>
      </Card>
    </AppShell>
  );
}

/** Read-only roll-up of where each teammate stands. No parent-only controls. */
async function TeamStatusList({
  members,
  learnerName,
}: {
  members: MemberContributionStatus[];
  learnerName: string;
}) {
  const t = await getTranslations("teacher.learner_team");
  if (members.length === 0) {
    return (
      <EmptyState
        icon={<UserCheck className="h-8 w-8" aria-hidden="true" />}
        title={t("status_empty_title")}
        description={t("status_empty_body", { name: learnerName })}
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {members.map((m) => {
        const meta = ROLE_META[m.kind];
        const acceptedOn = fmtDate(m.acceptedAt);
        const contributedOn = fmtDate(m.lastContributionAt);
        let stageBadge: React.ReactNode;
        let stageLine: string;
        if (m.contributed) {
          stageBadge = (
            <Badge tone="success">
              <Check className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
              {t("stage_contributed")}
            </Badge>
          );
          stageLine = contributedOn
            ? t("stage_contributed_on", { date: contributedOn })
            : t("stage_contributed_line");
        } else if (m.status === "ACCEPTED") {
          stageBadge = (
            <Badge tone="primary">
              <UserCheck className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
              {t("stage_accepted")}
            </Badge>
          );
          stageLine = acceptedOn
            ? t("stage_accepted_on", { date: acceptedOn })
            : t("stage_accepted_line");
        } else if (m.status === "DECLINED") {
          stageBadge = <Badge tone="warning">{t("stage_declined")}</Badge>;
          stageLine = t("stage_declined_line");
        } else {
          stageBadge = (
            <Badge tone="neutral">
              <Clock className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
              {t("stage_invited")}
            </Badge>
          );
          stageLine = t("stage_invited_line");
        }
        return (
          <li key={m.id}>
            <Card className="flex h-full flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.accent}`}
                >
                  {meta.icon} {t(meta.labelKey)}
                </span>
                {stageBadge}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-iw-ink">
                  {m.displayName || m.email}
                </p>
                {m.displayName ? (
                  <p className="truncate text-xs text-iw-ink-muted">{m.email}</p>
                ) : null}
                <p className="mt-1 text-xs text-iw-ink-muted">{stageLine}</p>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
