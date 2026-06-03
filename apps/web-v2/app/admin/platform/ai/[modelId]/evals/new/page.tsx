import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { NewEvalForm } from "./new-eval-form";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { modelId: string } }) {
  const session = await requirePageRole(["platform_admin"]);

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Responsible AI"
        title="Run new evaluation"
        description="Kick off a safety, accuracy, or bias evaluation harness against this model."
        actions={
          <Link
            href={`/admin/platform/ai/${params.modelId}`}
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Back to model
          </Link>
        }
      />

      <div className="max-w-2xl">
        <NewEvalForm modelId={params.modelId} />
      </div>
    </AppShell>
  );
}
