import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { CurriculumManager } from "@/components/curriculum/curriculum-manager";
import {
  getLearner,
  listCurriculumUploadsForLearner,
  listSubjects,
  parentCanAccessLearner,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function ParentLearnerCurriculumPage({
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

  const [uploads, subjects] = await Promise.all([
    listCurriculumUploadsForLearner(learnerId, session.tenantId),
    listSubjects(),
  ]);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="This week at school"
        title={`${learner.displayName}'s weekly lessons`}
        description="Add what your child is learning in class this week so AIVO's tutor introduces the same topics, with worked examples fitted to their learning profile."
      />
      <CurriculumManager
        apiBase={`/api/bff/parent/learners/${learnerId}/curriculum`}
        learnerName={learner.displayName}
        initialUploads={uploads}
        subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))}
      />
    </AppShell>
  );
}
