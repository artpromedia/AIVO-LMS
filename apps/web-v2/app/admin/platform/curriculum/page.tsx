import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getTranslations } from "next-intl/server";
import {
  listAssessmentBlueprints,
  listCurriculumImportJobs,
  listLessonObjectiveTemplates,
  listSkills,
  listStandards,
  listStandardsFrameworks,
  listSubjects,
} from "@/lib/db/repos";
import { BookOpen, GraduationCap, Layers, ScrollText, ListTree, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("admin.platform_curriculum_overview");
  const session = await requirePageRole(["platform_admin"]);
  const frameworks = listStandardsFrameworks();
  const subjects = await listSubjects();
  const skills = await listSkills();
  const standards = listStandards();
  const blueprints = listAssessmentBlueprints();
  const objectives = listLessonObjectiveTemplates();
  const jobs = listCurriculumImportJobs();

  const tiles: { href: string; label: string; v: number; icon: React.ReactNode }[] = [
    {
      href: "/admin/platform/curriculum/frameworks",
      label: "Frameworks",
      v: frameworks.length,
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/curriculum/subjects",
      label: "Subjects",
      v: subjects.length,
      icon: <Layers className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/curriculum/skills",
      label: "Skills",
      v: skills.length,
      icon: <GraduationCap className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/curriculum/skills",
      label: "Standards",
      v: standards.length,
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/curriculum/versioning",
      label: "Blueprints + objectives",
      v: blueprints.length + objectives.length,
      icon: <ListTree className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/curriculum/import",
      label: "Import jobs",
      v: jobs.length,
      icon: <Upload className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title={t("title")}
        description="Standards frameworks, subjects, skills, prereqs, and assessment blueprints that AI generation reads as constraints."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="block">
            <Card className="p-[var(--aivo-density-card-pad)] hover:bg-aivo-surface-2 transition">
              <div className="flex items-center gap-2 text-aivo-muted text-xs font-semibold uppercase">
                {t.icon}
                {t.label}
              </div>
              <p className="mt-1 font-display text-3xl font-bold">{t.v.toLocaleString()}</p>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
