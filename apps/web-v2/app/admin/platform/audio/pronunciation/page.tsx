import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listPronunciationOverrides } from "@/lib/db/repos";
import { CreateOverrideForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const overrides = listPronunciationOverrides();
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Audio"
        title="Pronunciation overrides"
        description="Tokens the TTS provider should pronounce differently. Platform-scope overrides apply everywhere; tenant-scope rows apply to one tenant."
      />
      <Card className="mb-4 p-[var(--aivo-density-card-pad)]">
        <h2 className="font-display font-semibold mb-3">Add override</h2>
        <CreateOverrideForm canPublishPlatform={true} />
      </Card>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-aivo-surface-2 text-xs uppercase text-aivo-muted">
            <tr>
              <th className="px-4 py-2 text-left">Token</th>
              <th className="px-4 py-2 text-left">Replacement</th>
              <th className="px-4 py-2 text-left">Encoding</th>
              <th className="px-4 py-2 text-left">Scope</th>
              <th className="px-4 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {overrides.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-aivo-muted">
                  No overrides yet.
                </td>
              </tr>
            ) : (
              overrides.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-medium">{o.token}</td>
                  <td className="px-4 py-2 font-mono text-xs">{o.replacement}</td>
                  <td className="px-4 py-2 text-xs">{o.encoding}</td>
                  <td className="px-4 py-2">
                    <Badge tone={o.scope === "platform" ? "primary" : "neutral"}>{o.scope}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-aivo-muted">{o.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
