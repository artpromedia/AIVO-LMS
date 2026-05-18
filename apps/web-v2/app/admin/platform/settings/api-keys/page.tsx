import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { listPlatformApiKeys, getUserById } from "@/lib/db/repos";
import type { User } from "@/lib/db/types";

export const dynamic = "force-dynamic";

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const keys = listPlatformApiKeys();

  // Precompute creator map: one lookup per distinct creator, not per row.
  const creatorById = new Map<string, User>();
  for (const id of new Set(keys.map((k) => k.createdByUserId))) {
    const u = getUserById(id);
    if (u) creatorById.set(id, u);
  }

  const active = keys.filter((k) => k.status === "active");
  const idle = active.filter(
    (k) => !k.lastUsedAt || Date.now() - new Date(k.lastUsedAt).getTime() > 30 * 86400_000,
  );

  const stats = [
    { k: "Active keys", v: active.length.toLocaleString() },
    { k: "Revoked", v: (keys.length - active.length).toLocaleString() },
    { k: "Idle 30d+", v: idle.length.toLocaleString() },
  ];

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · Settings"
        title="API keys"
        description="Long-lived credentials used by internal systems and trusted integrations. Secrets are shown once at creation and are never displayed here again."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.k} className="p-[var(--aivo-density-card-pad)]">
            <p className="text-xs uppercase tracking-wide text-aivo-ink-soft">{s.k}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{s.v}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        {keys.length === 0 ? (
          <EmptyState
            title="No API keys yet"
            description="Create a key when you need to grant a system access to the platform API."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-xs uppercase tracking-wide text-aivo-ink-soft">
              <tr>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Prefix</th>
                <th className="px-4 py-3 text-left">Scopes</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created by</th>
                <th className="px-4 py-3 text-left">Last used</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aivo-border">
              {keys.map((k) => {
                const creator = creatorById.get(k.createdByUserId) ?? null;
                return (
                  <tr key={k.id} className="hover:bg-aivo-surface-2/40">
                    <td className="px-4 py-3 font-medium">{k.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-aivo-ink-soft">
                      {k.prefix}••••
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="rounded bg-aivo-surface-2 px-2 py-0.5 font-mono text-xs"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={k.status === "active" ? "success" : "neutral"}>{k.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {creator?.displayName ?? creator?.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {relativeTime(k.lastUsedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-aivo-ink-soft">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </AppShell>
  );
}
