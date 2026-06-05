import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { getModerationStats, listModerationEvents } from "@/lib/admin-api/moderation";
import { ShieldAlert, Inbox, ScrollText, FlaskConical } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["platform_admin"]);
  const t = await getTranslations("admin.platform_safety_overview");
  const [events, stats] = await Promise.all([
    listModerationEvents(session, { perPage: 200 }),
    getModerationStats(session),
  ]);

  const statusCounts = new Map(stats.byStatus.map((row) => [row.status, row.count]));
  const reviewCount =
    (statusCounts.get("PENDING") ?? 0) + (statusCounts.get("LOW_CONFIDENCE") ?? 0);

  const tiles = [
    {
      href: "/admin/platform/safety/moderation",
      label: "Moderation events",
      v: events.length,
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/safety/review-queue",
      label: "Open review cases",
      v: reviewCount,
      icon: <Inbox className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/safety/policies",
      label: "Policy versions",
      v: 0,
      icon: <ScrollText className="h-4 w-4" />,
    },
    {
      href: "/admin/platform/safety/red-team",
      label: "Red-team tests",
      v: 0,
      icon: <FlaskConical className="h-4 w-4" />,
    },
  ];
  const rejected = events.filter((event) => event.status === "REJECTED").slice(0, 5);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform"
        title={t("title")}
        description="Moderation events and human review state from admin-svc."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card className="p-[var(--aivo-density-card-pad)] transition hover:bg-aivo-surface-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-aivo-muted">
                {tile.icon}
                {tile.label}
              </div>
              <p className="mt-1 font-display text-3xl font-bold">{tile.v.toLocaleString()}</p>
            </Card>
          </Link>
        ))}
      </div>
      {rejected.length > 0 ? (
        <Card className="mt-4 p-[var(--aivo-density-card-pad)]">
          <h2 className="font-display font-semibold">{t("recent_blocked_heading")}</h2>
          <ul className="mt-2 divide-y text-sm">
            {rejected.map((event) => (
              <li key={event.id} className="flex items-center justify-between py-2">
                <span>
                  {event.contentType.replace(/_/g, " ")} - {event.flagReason.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-aivo-muted">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </AppShell>
  );
}
