import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listPolicies } from "@/lib/services/responsible-ai-svc";

export const dynamic = "force-dynamic";

function scopeTone(level: string): "primary" | "accent" | "neutral" {
  if (level === "platform") return "primary";
  if (level === "district") return "accent";
  return "neutral";
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const policies = await listPolicies();

  return (
    <AppShell
      role={session.role}
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Responsible AI"
        title="Safety policies"
        description="Content, age-gating, and regional guardrails applied across the platform."
        actions={
          <Link
            href="/admin/platform/ai"
            className="inline-flex h-11 items-center rounded-full border border-iw-border bg-iw-raised px-5 text-sm font-semibold"
          >
            Back to registry
          </Link>
        }
      />

      <Card className="overflow-hidden p-0">
        {policies.length === 0 ? (
          <EmptyState title="No policies" description="No safety policies are configured." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Scope</th>
                <th className="px-4 py-3 text-left">Scope id</th>
                <th className="px-4 py-3 text-left">Enabled</th>
                <th className="px-4 py-3 text-left">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {policies.map((p: any) => (
                <tr key={p.id} className="hover:bg-aivo-surface-2/40">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/admin/platform/ai/policies/${p.id}`} className="hover:underline">
                      {p.name ?? p.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={scopeTone(p.scopeLevel)}>{p.scopeLevel ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-aivo-ink-soft">{p.scopeId ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.enabled ? "success" : "neutral"}>
                      {p.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}
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
