import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listDataInventory, listSubprocessors } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const items = listDataInventory();
  const subs = listSubprocessors();

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Compliance"
        title="Data inventory"
        description="Every sensitive data category, its classification, lawful basis, and processing purposes."
      />

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-left">
            <tr>
              <th className="p-3">Key</th>
              <th className="p-3">Classification</th>
              <th className="p-3">Lawful basis</th>
              <th className="p-3">Purposes</th>
              <th className="p-3">Store</th>
              <th className="p-3">Child data</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-aivo-border">
                <td className="p-3 font-mono text-xs">{it.key}</td>
                <td className="p-3">
                  <Badge tone={it.containsChildData ? "warning" : "neutral"}>
                    {it.classification}
                  </Badge>
                </td>
                <td className="p-3 text-aivo-ink-soft">{it.lawfulBasis}</td>
                <td className="p-3 text-aivo-ink-soft">{it.purposes.join(", ")}</td>
                <td className="p-3 text-aivo-ink-soft">{it.storeLocation}</td>
                <td className="p-3">
                  {it.containsChildData ? (
                    <Badge tone="warning">Yes</Badge>
                  ) : (
                    <Badge tone="neutral">No</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display font-semibold">Subprocessors</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {subs.map((s) => (
            <li key={s.id} className="rounded border border-aivo-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.name}</span>
                <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
              </div>
              <p className="text-aivo-ink-soft">{s.purpose}</p>
              <p className="text-xs text-aivo-muted">Region: {s.region}</p>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
