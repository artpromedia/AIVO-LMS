import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import {
  listBlockedGenerations,
  listHumanReviewCases,
  listModerationEvents,
  listSafetyPolicyVersions,
} from "@/lib/db/repos";
import { ShieldAlert, Inbox, ScrollText, FlaskConical } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const events = listModerationEvents({});
  const cases = listHumanReviewCases({});
  const blocked = listBlockedGenerations();
  const policies = listSafetyPolicyVersions();
  const tiles: { href: string; label: string; v: number; icon: React.ReactNode }[] = [
    {
      href: "/admin/platform/safety/moderation",
      label: "Moderation events",
      v: events.length,
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/safety/review-queue",
      label: "Open review cases",
      v: cases.filter((c) => c.status === "open" || c.status === "in_review").length,
      icon: <Inbox className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/safety/policies",
      label: "Policy versions",
      v: policies.length,
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/safety/red-team",
      label: "Red-team tests",
      v: 0,
      icon: <FlaskConical className="h-4 w-4" />,
    },
  ];
  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title="AI Safety"
        description="Moderation events, human review queue, blocked generations, and the safety policy that governs them all."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="block">
            <Card className="p-[var(--aivo-density-card-pad)] hover:bg-aivo-surface-2 transition">
              <div className="flex items-center gap-2 text-aivo-muted text-xs font-semibold uppercase">
                {t.icon}
                {t.label}
              </div>
              <p className="mt-1 font-display text-3xl font-bold">{t.v.toLocaleString()}</p>
            </Card>
          </Link>
        ))}
      </div>
      {blocked.length > 0 && (
        <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold">Recent blocked generations</h2>
          <ul className="mt-2 divide-y text-sm">
            {blocked.slice(0, 5).map((b) => (
              <li key={b.id} className="py-2 flex items-center justify-between">
                <span>
                  {b.subjectKind.replace(/_/g, " ")} — {b.reason}
                </span>
                <span className="text-[11px] text-aivo-muted">
                  {new Date(b.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
