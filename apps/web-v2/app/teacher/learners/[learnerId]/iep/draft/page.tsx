/**
 * Sprint 30: Teacher · IEP goal drafting.
 * Read-only view of the learner's current IEP extraction plus a curated set
 * of suggested SMART goal drafts that pull from mastery + accommodations.
 * Mirrors the legacy `/dashboard/teacher/learners/[id]/iep/draft` page.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { FileText, Target, Sparkles } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { TEACHER_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getIEPForLearner,
  getLearner,
  getMasteryMap,
  listSkills,
  listSubjects,
  teacherCanAccessLearner,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function TeacherIepDraftPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const session = await requirePageRole(["teacher"]);
  const { learnerId } = await params;
  if (!await teacherCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  const iep = getIEPForLearner(learnerId, session.tenantId);
  const { skillMasteries } = getMasteryMap(learnerId, session.tenantId);
  const subjects = listSubjects();
  const skills = listSkills();
  const skillsById = new Map(skills.map((s) => [s.id, s]));
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));

  // Suggest goal drafts from the 3 lowest-scoring skills with the most need.
  const needsWork = [...skillMasteries]
    .filter((s) => s.score < 0.6)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);

  const drafts = needsWork.map((sm) => {
    const skill = skillsById.get(sm.skillId);
    const subject = subjectsById.get(sm.subjectId);
    const target = Math.min(0.85, Math.max(0.6, sm.score + 0.25));
    return {
      key: sm.skillId,
      skillName: skill?.name ?? sm.skillId,
      subjectName: subject?.name ?? "—",
      currentPct: Math.round(sm.score * 100),
      targetPct: Math.round(target * 100),
      smart: `By the end of the next reporting period, ${learner.displayName} will demonstrate ${
        skill?.name ?? "this skill"
      } at ${Math.round(target * 100)}% accuracy across 3 consecutive sessions, with the supports listed below.`,
    };
  });

  return (
    <AppShell
      role="teacher"
      roleLabel="Teacher"
      navItems={TEACHER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={learner.displayName}
        title="IEP goal draft"
        description="Draft SMART goals from current mastery + accommodations. Drafts are not shared with the parent until you submit."
        actions={
          <Link
            href={`/teacher/learners/${learner.id}`}
            className="text-sm text-aivo-accent underline underline-offset-4"
          >
            ← Learner profile
          </Link>
        }
      />

      {!iep ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No IEP on file"
          description="The parent or guardian needs to upload an IEP document before you can draft new goals. You can still see mastery insights below."
        />
      ) : (
        <>
          <SectionHeader title="Current IEP" />
          <Card className="p-[var(--aivo-density-card-pad)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{iep.fileName}</p>
                <p className="mt-0.5 text-xs text-aivo-ink-soft">
                  Uploaded {new Date(iep.uploadedAt).toLocaleDateString()} ·{" "}
                  {Math.round(iep.bytes / 1024)} KB
                </p>
              </div>
              <Badge
                tone={
                  iep.status === "parsed"
                    ? "success"
                    : iep.status === "failed"
                      ? "danger"
                      : "neutral"
                }
              >
                {iep.status}
              </Badge>
            </div>
            {iep.extraction ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                    Existing learning goals
                  </p>
                  {iep.extraction.learningGoals.length === 0 ? (
                    <p className="mt-1 text-sm text-aivo-ink-soft">None on file.</p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                      {iep.extraction.learningGoals.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-aivo-ink-soft">
                    Accommodations
                  </p>
                  {iep.extraction.accommodations.length === 0 ? (
                    <p className="mt-1 text-sm text-aivo-ink-soft">None recorded.</p>
                  ) : (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                      {iep.extraction.accommodations.slice(0, 6).map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </Card>
        </>
      )}

      <SectionHeader title="Suggested goal drafts" />
      {drafts.length === 0 ? (
        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="text-sm text-aivo-ink-soft">
            No skills currently below 60% mastery — this learner is on track. Goal drafts will
            appear when fresh mastery data indicates a gap.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {drafts.map((d) => (
            <li key={d.key}>
              <Card className="p-[var(--aivo-density-card-pad)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aivo-accent/10 text-aivo-accent">
                    <Target className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{d.skillName}</p>
                      <Badge tone="neutral">{d.subjectName}</Badge>
                      <Badge tone="warning">Currently {d.currentPct}%</Badge>
                      <Badge tone="success">Target {d.targetPct}%</Badge>
                    </div>
                    <p className="mt-2 text-sm">{d.smart}</p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SectionHeader title="How drafts are generated" />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-aivo-accent" />
          <div className="space-y-1 text-sm text-aivo-ink-soft">
            <p>
              Drafts pull from the learner's current MasteryMap snapshot. Skills below 60% mastery
              are surfaced first, with a target lift of +25 percentage points.
            </p>
            <p>
              Final SMART goals are reviewed and approved by the parent before being added to the
              IEP record. Drafts here are not visible to the parent until you submit.
            </p>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
