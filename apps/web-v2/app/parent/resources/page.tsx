import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listResources } from "@/lib/parent/resources-content";
import { ResourcesBrowser } from "./resources-browser";

export default async function Page() {
  const t = await getTranslations("parent.resources");
  const session = await requirePageRole(["parent"]);
  const resources = listResources();

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow="Parent" title={t("title")} description={t("description")} />
      <ResourcesBrowser resources={resources} />
    </AppShell>
  );
}
