/**
 * Caregiver learners — placeholder route. The caregiver's learner roster is
 * already surfaced on `/caregiver/home`; this page is reserved for richer
 * learner-by-learner detail in a follow-up sprint.
 */
import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { CAREGIVER_NAV } from "@/components/layout/role-shells";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["caregiver", "platform_admin"]);
  return (
    <AppShell
      role="caregiver"
      roleLabel="Caregiver"
      navItems={CAREGIVER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader title="Learners" description="Detailed view coming soon." />
      <EmptyState
        title="Detailed learner views land soon"
        description="For now, your roster lives on the caregiver home."
      />
      <div className="mt-4">
        <Link href="/caregiver/home">
          <Button variant="outline">Back to home</Button>
        </Link>
      </div>
    </AppShell>
  );
}
