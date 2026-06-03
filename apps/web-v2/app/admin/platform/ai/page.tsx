import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listModels } from "@/lib/services/responsible-ai-svc";

export const dynamic = "force-dynamic";

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "active") return "success";
  if (status === "deprecated") return "warning";
  return "neutral";
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const models = await listModels();

  const total = models.length;
  const active = models.filter((m) => m.status === "active").length;
  const deprecated = models.filter((m) => m.status === "deprecated").length;

  const stats = [
    { k: "Total models", v: total },
    { k: "Active", v: active },
    { k: "Deprecated", v: deprecated },
  ];

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Responsible AI"
        title="Model registry"
        description="Every AI model in the platform, its model card, eval history, and governance status."
        actions={
          <>
            <Link
              href="/admin/platform/ai/policies"
              className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
            >
              Policies
            </Link>
            <Link
              href="/admin/platform/ai/incidents"
              className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
            >
              Incidents
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{s.k}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{s.v.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        {models.length === 0 ? (
          <EmptyState title="No models registered" description="The AI registry is empty." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-left">Modality</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Owner team</th>
                <th className="px-4 py-3 text-left">Versions</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {models.map((m) => (
                <tr key={m.id} className="hover:bg-aivo-surface-2/40">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/platform/ai/${m.id}`} className="hover:underline">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{m.provider}</td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{m.modality}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{m.owner?.team ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-aivo-ink-soft">{m.versions ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                    {new Date(m.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
