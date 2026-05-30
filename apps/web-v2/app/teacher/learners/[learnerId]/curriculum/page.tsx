import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { CurriculumManager } from "@/components/curriculum/curriculum-manager";
import { getLearner, listCurriculumUploadsForLearner, listSubjects } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherLearnerCurriculumPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const { learnerId } = await params;
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const [uploads, subjects] = await Promise.all([
    listCurriculumUploadsForLearner(learnerId, session.tenantId),
    listSubjects(),
  ]);

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="This week at school"
        title={`${learner.displayName}'s weekly lessons`}
        description="Add the week's scope so AIVO's tutor teaches the same topics and vocabulary, with worked examples fitted to this learner's profile and accommodations."
      />
      <CurriculumManager
        apiBase={`/api/bff/teacher/learners/${learnerId}/curriculum`}
        learnerName={learner.displayName}
        initialUploads={uploads}
        subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))}
      />
    </AppShell>
  );
}
