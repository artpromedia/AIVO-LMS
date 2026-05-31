import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getTranslations } from "next-intl/server";
import {
  getCurrentSkillVersion,
  listAssessmentBlueprints,
  listCurriculumMaps,
  listLessonObjectiveTemplates,
  listSkillPrerequisites,
  listSkills,
  listStandards,
  listSubjects,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("admin.platform_curriculum_skills");
  const session = await requirePageRole(["platform_admin"]);
  const subjects = await listSubjects();
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const skills = await listSkills();
  const standards = listStandards();
  const standardById = new Map(standards.map((s) => [s.id, s]));
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Curriculum"
        title={t("title")}
        description="Every skill maps to a subject, a grade band, and (optionally) one or more standards. AI generation refuses to write a lesson that has no active skill version."
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-xs uppercase text-aivo-muted">
            <tr>
              <th className="px-4 py-2 text-left">Skill</th>
              <th className="px-4 py-2 text-left">{t("col_subject")}</th>
              <th className="px-4 py-2 text-left">{t("col_grade_band")}</th>
              <th className="px-4 py-2 text-left">{t("col_version")}</th>
              <th className="px-4 py-2 text-left">{t("col_prereqs")}</th>
              <th className="px-4 py-2 text-left">{t("col_standards")}</th>
              <th className="px-4 py-2 text-left">{t("col_constraints")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {skills.map((s) => {
              const subj = subjectById.get(s.subjectId);
              const ver = getCurrentSkillVersion(s.id);
              const prereqs = listSkillPrerequisites(s.id);
              const maps = listCurriculumMaps(s.id);
              const hasObj = listLessonObjectiveTemplates(s.id).some((t) => t.status === "active");
              const hasBp = listAssessmentBlueprints(s.id).some((b) => b.status === "active");
              return (
                <tr key={s.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-[11px] text-aivo-muted">{s.slug}</div>
                  </td>
                  <td className="px-4 py-2">{subj?.name ?? "—"}</td>
                  <td className="px-4 py-2">{s.gradeBand}</td>
                  <td className="px-4 py-2">
                    {ver ? <Badge tone="neutral">v{ver.version}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-2">{prereqs.length}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {maps.length === 0 ? (
                        <span className="text-aivo-muted text-xs">—</span>
                      ) : (
                        maps.map((m) => (
                          <Badge key={m.id} tone="neutral">
                            {standardById.get(m.standardId)?.code ?? "?"}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <Badge tone={hasObj ? "success" : "warning"}>
                        {hasObj ? "OBJ" : "no obj"}
                      </Badge>
                      <Badge tone={hasBp ? "success" : "warning"}>{hasBp ? "BP" : "no BP"}</Badge>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
