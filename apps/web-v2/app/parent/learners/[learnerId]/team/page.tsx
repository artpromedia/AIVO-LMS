/**
 * Sprint 30: Parent · Care team.
 * Lists every adult connected to this learner: parents/guardians, classroom
 * teachers (via enrollments), and tenant memberships. Mirrors the legacy
 * collaboration page. Uses existing parentLearnerRelationships + enrollments
 * + memberships — no new data layer required.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getStore as db } from "@/lib/db/store";
import { getLearner, getUserById, parentCanAccessLearner } from "@/lib/db/repos";
import { getCareTeam } from "@/lib/db/team-invites";
import { TeamInviteSection } from "./team-invite-section";
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
};

export default async function ParentTeamPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

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
      <PageHeader
        eyebrow={learner.displayName}
        title="Care team"
        description="Everyone supporting this learner. Parents, teachers, therapists, and caregivers can all see progress."
      />

      <SectionHeader title="Invite a team member" />
      <TeamInviteSection learnerId={learner.id} careTeam={getCareTeam(learner.id)} />

      <SectionHeader title={`${list.length} member${list.length === 1 ? "" : "s"}`} />
      {list.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Once a teacher is enrolled in your learner's classroom or a therapist joins your family tenant, they'll appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((m) => (
            <li key={m.userId}>
              <Card className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{m.displayName}</p>
                    {m.isPrimary ? <Badge tone="success">Primary</Badge> : null}
                    <Badge tone="neutral">{ROLE_LABEL[m.role] ?? m.role}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-aivo-ink-soft">{m.context}</p>
                  <a
                    href={`mailto:${m.email}`}
                    className="mt-1 flex items-center gap-1 text-xs text-aivo-accent hover:underline"
                  >
                    <Mail className="h-3 w-3" /> {m.email}
                  </a>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionHeader title="How collaboration works" />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <ul className="list-disc space-y-1 pl-5 text-sm text-aivo-ink-soft">
          <li>Parents and guardians have full access to all learner data.</li>
          <li>Teachers see classroom-scoped progress and may draft IEP goals.</li>
          <li>Therapists and caregivers see read-only summaries unless explicitly elevated.</li>
          <li>
            Any member can be removed at any time from{" "}
            <Link
              href={`/parent/learners/${learner.id}/settings`}
              className="text-aivo-accent underline underline-offset-4"
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
