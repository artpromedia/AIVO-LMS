import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listLearnersForParent, refreshLearnerReadiness } from "@/lib/db/repos";
import { LearnerCard } from "@/components/parent/learner-card";

export default async function ParentHome() {
  const session = await requirePageRole(["parent"]);
  const learners = listLearnersForParent(session.userId, session.tenantId);
  for (const l of learners) refreshLearnerReadiness(l.id, session.tenantId);
  const fresh = listLearnersForParent(session.userId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Parent home"
        title={`Welcome, ${session.displayName.split(" ")[0]}`}
        description="Set up each learner, follow their growth, and adjust supports any time."
        actions={
          <Button asChild>
            <Link href="/parent/learners/new">
              <Plus className="mr-1 h-4 w-4" /> Add learner
            </Link>
          </Button>
        }
      />

      <SectionHeader
        title="Your learners"
        description="Each card shows the next step we need from you."
      />
      {fresh.length === 0 ? (
        <EmptyState
          title="No learners yet"
          description="Add your first learner to begin assessment and personalize their learning path."
          action={
            <Button asChild>
              <Link href="/parent/learners/new">Add your first learner</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {fresh.map((l) => (
            <LearnerCard key={l.id} learner={l} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
