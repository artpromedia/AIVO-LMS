import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import {
  getMasteryMap,
  getSubjectDetail,
  listSubjects,
} from "@/lib/db/repos";

const LEVEL_LABEL: Record<string, string> = {
  not_started: "Not started yet",
  emerging: "Just starting",
  approaching: "Growing",
  on_grade_level: "On track",
  stretching: "Stretching",
};

export default async function LearnerSubjectsPage() {
  const session = await requirePageRole(["learner"]);
  const learnerId = session.learnerId;
  if (!learnerId) redirect("/learner/home");

  const { map } = getMasteryMap(learnerId, session.tenantId);
  const subjects = listSubjects();
  const baselineNeeded = !map;

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Subjects"
        title="Pick a subject"
        description="Each one has a tutor and a recommended next skill."
      />

      {baselineNeeded ? (
        <EmptyState
          title="Finish the baseline first"
          description="Your subject pages light up after you complete a quick baseline check-in."
          action={
            <Button asChild>
              <Link href="/learner/baseline">
                Start baseline <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const detail = getSubjectDetail(learnerId, session.tenantId, s.id);
            const level = detail?.currentLevel ?? "not_started";
            return (
              <Card key={s.id} className="flex flex-col gap-3 p-[var(--aivo-density-card-pad)]">
                <div>
                  <p className="font-display text-lg font-semibold">{s.name}</p>
                  <p className="mt-1 text-sm text-aivo-ink-soft">{s.description}</p>
                </div>
                <Badge tone={level === "not_started" ? "neutral" : "primary"}>
                  {LEVEL_LABEL[level] ?? level}
                </Badge>
                <div className="mt-auto">
                  <Button asChild className="w-full">
                    <Link href={`/learner/subjects/${s.id}`}>
                      Open {s.name} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
