import Link from "next/link";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listLearnersForParent, refreshLearnerReadiness } from "@/lib/db/repos";
import { LearnerCard } from "@/components/parent/learner-card";

export default async function ParentLearnersPage() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.learners");
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  for (const l of learners) await refreshLearnerReadiness(l.id, session.tenantId);
  const fresh = await listLearnersForParent(session.userId, session.tenantId);

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Parent"
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/parent/learners/new">
              <Plus className="mr-1 h-4 w-4" /> {t("add_learner")}
            </Link>
          </Button>
        }
      />
      {fresh.length === 0 ? (
        <EmptyState
          title={t("no_learners")}
          description={t("no_learners_desc")}
          action={
            <Button asChild>
              <Link href="/parent/learners/new">{t("add_a_learner")}</Link>
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
