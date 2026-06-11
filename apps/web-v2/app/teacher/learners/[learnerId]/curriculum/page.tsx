import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurriculumManager } from "@/components/curriculum/curriculum-manager";
import { TermSyllabusManager } from "@/components/curriculum/term-syllabus-manager";
import { SchoolCalendarManager } from "@/components/curriculum/school-calendar-manager";
import { getLearner, listCurriculumUploadsForLearner, listSubjects } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherLearnerCurriculumPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const t = await getTranslations("curriculum.tabs");
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
        eyebrow="School alignment"
        title={`${learner.displayName}'s school curriculum`}
        description="Add the week's scope, the full-term syllabus, and the school calendar so AIVO teaches the same topics and vocabulary, break-aware, fitted to this learner's profile and accommodations."
      />
      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="week">{t("this_week")}</TabsTrigger>
          <TabsTrigger value="term">{t("full_term")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("school_calendar")}</TabsTrigger>
        </TabsList>
        <TabsContent value="week">
          <CurriculumManager
            apiBase={`/api/bff/teacher/learners/${learnerId}/curriculum`}
            learnerName={learner.displayName}
            initialUploads={uploads}
            subjects={subjects.map((s) => ({ slug: s.slug, name: s.name }))}
          />
        </TabsContent>
        <TabsContent value="term">
          <TermSyllabusManager
            learnerId={learnerId}
            apiBase={`/api/bff/teacher/learners/${learnerId}/term-syllabus`}
            pacingApiBase={`/api/bff/teacher/learners/${learnerId}/pacing-plan`}
            gradeBand={learner.gradeBand ?? undefined}
            jurisdiction={learner.zipCode ? { zipCode: learner.zipCode } : undefined}
          />
        </TabsContent>
        <TabsContent value="calendar">
          <SchoolCalendarManager
            apiBase={`/api/bff/teacher/learners/${learnerId}/school-calendar`}
            learnerName={learner.displayName}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
