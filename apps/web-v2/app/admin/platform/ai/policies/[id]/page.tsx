import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listPolicies } from "@/lib/services/responsible-ai-svc";
import { PolicyEditor } from "@/components/admin/ai/PolicyEditor";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await requirePageRole(["platform_admin"]);
  const policies = await listPolicies();
  const policy = policies.find((p: any) => p.id === params.id) ?? null;

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Responsible AI"
        title={policy?.name ?? "Policy"}
        description="Edit content, age-gating, and regional guardrails for this policy."
        actions={
          <Link
            href="/admin/platform/ai/policies"
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Back to policies
          </Link>
        }
      />

      {policy ? (
        <div className="max-w-2xl">
          <PolicyEditor policy={policy} />
        </div>
      ) : (
        <EmptyState title="Policy not found" description="No policy exists with that id." />
      )}
    </AppShell>
  );
}
