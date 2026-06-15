import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { getLearner, parentCanAccessLearner } from "@/lib/db/repos";
import { SessionsManager } from "./sessions-manager";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ learnerId: string }> }) {
  const t = await getTranslations("parent.sessions");
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!(await parentCanAccessLearner(session.userId, learnerId, session.tenantId))) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={learner.displayName} title={t("title")} description={t("description")} />
      <SessionsManager learnerId={learner.id} learnerName={learner.displayName} />
    </AppShell>
  );
}
