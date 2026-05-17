import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  listAssessmentBlueprints,
  listLessonObjectiveTemplates,
  listSkillVersions,
  listSkills,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const skills = listSkills();
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const versions = listSkillVersions();
  const objectives = listLessonObjectiveTemplates();
  const blueprints = listAssessmentBlueprints();
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Curriculum"
        title="Versioning, objectives, and blueprints"
        description="One skill version is current at a time. AI generation reads the current version's objective summary + the active blueprint as its hard scope."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold mb-2">Skill versions</h2>
          <ul className="divide-y text-sm">
            {versions.map((v) => (
              <li key={v.id} className="py-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{skillById.get(v.skillId)?.name ?? v.skillId}</div>
                  <div className="text-[11px] text-aivo-muted">{v.objectiveSummary}</div>
                </div>
                <div className="text-right">
                  <Badge tone={v.isCurrent ? "success" : "neutral"}>v{v.version}</Badge>
                  <div className="text-[11px] text-aivo-muted mt-1">
                    {new Date(v.effectiveAt).toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold mb-2">Objective templates</h2>
          <ul className="divide-y text-sm">
            {objectives.map((o) => (
              <li key={o.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{o.title}</div>
                  <Badge tone={o.status === "active" ? "success" : "neutral"}>{o.status}</Badge>
                </div>
                <div className="text-[11px] text-aivo-muted">
                  {skillById.get(o.skillId)?.name ?? o.skillId} ·{" "}
                  {o.objectives.length} objective{o.objectives.length === 1 ? "" : "s"}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-[var(--aivo-density-card-pad)] md:col-span-2">
          <h2 className="font-display font-semibold mb-2">Assessment blueprints</h2>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-aivo-muted">
              <tr>
                <th className="text-left py-1">Skill</th>
                <th className="text-left py-1">Blueprint</th>
                <th className="text-left py-1">Items</th>
                <th className="text-left py-1">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {blueprints.map((b) => (
                <tr key={b.id}>
                  <td className="py-2">{skillById.get(b.skillId)?.name ?? b.skillId}</td>
                  <td className="py-2">{b.name}</td>
                  <td className="py-2 text-[11px]">
                    {b.items
                      .map((i) => `${i.count}× ${i.kind.replace(/_/g, " ")}`)
                      .join(", ")}
                  </td>
                  <td className="py-2">
                    <Badge tone={b.status === "active" ? "success" : "neutral"}>{b.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
