import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { listModels } from "@/lib/services/responsible-ai-svc";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["school_admin"]);
  const models = (await listModels()).filter((m) => m.status === "active");

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School · Responsible AI"
        title="AI models in use"
        description="Models enabled for your school and how they are intended to be used."
      />

      <Card className="mb-6 p-[var(--aivo-density-card-pad)]" variant="accent">
        <p className="text-sm">
          School admins have read-only visibility into AI usage. Opt-outs are managed at the
          district level — contact your district administrator to change model availability.
        </p>
      </Card>

      {models.length === 0 ? (
        <EmptyState title="No models enabled" description="No AI models are currently active." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {models.map((m) => (
            <Card key={m.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold">{m.name}</p>
                <Badge tone="neutral">{m.modality}</Badge>
              </div>
              <p className="mt-1 text-xs text-aivo-ink-soft">{m.provider}</p>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">Intended use</p>
                <p className="mt-1 text-sm">{m.intendedUse}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
