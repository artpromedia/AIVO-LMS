import Link from "next/link";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { listConnectors, latestRun } from "@/lib/db/sis-store";
import { SyncStatusCard } from "@/components/admin/sis/SyncStatusCard";

export default async function Page() {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.sis");
  const connectors = listConnectors(session.tenantId);

  return (
    <AppShell
      role="district_admin"
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Rostering"
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/admin/district/sis/new">{t("add_connector")}</Link>
          </Button>
        }
      />
      {connectors.length === 0 ? (
        <EmptyState title={t("empty_title")} description={t("empty_description")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connectors.map((c) => (
            <Link key={c.id} href={`/admin/district/sis/${c.id}`} className="block">
              <SyncStatusCard connector={c} latestRun={latestRun(c.id)} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
