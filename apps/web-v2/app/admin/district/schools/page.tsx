import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Permission } from "@aivo/security";
import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DISTRICT_NAV } from "@/components/layout/role-shells";
import { scopeTenantsForSession, listDistrictSchools, createTenant } from "@/lib/db/repos";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  identityCreateDistrictSchool,
  identityListDistrictSchools,
} from "@/lib/auth/identity-client";
import { sessionHasPermission } from "@/lib/auth/permissions";
import { Building2, Users, GraduationCap } from "lucide-react";

type DistrictSchoolsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function createSchoolAction(formData: FormData) {
  "use server";

  const session = await requirePageRole(["district_admin"]);
  if (!sessionHasPermission(session, Permission.SchoolCreate)) {
    redirect("/admin/district/schools?error=You+do+not+have+permission+to+create+schools.");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/admin/district/schools?error=School+name+is+required.");
  }

  const accessToken = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    const result = await identityCreateDistrictSchool(accessToken, { name });
    if (!result.ok) {
      redirect(`/admin/district/schools?error=${encodeURIComponent(result.error)}`);
    }
  } else {
    createTenant({ name, type: "school", parentTenantId: session.tenantId });
  }

  revalidatePath("/admin/district/schools");
  redirect(`/admin/district/schools?created=${encodeURIComponent(name)}`);
}

export default async function Page({ searchParams }: DistrictSchoolsPageProps) {
  const session = await requirePageRole(["district_admin"]);
  const t = await getTranslations("admin.district_schools");
  const query = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const createdMessage =
    typeof query.created === "string" && query.created.length > 0
      ? `Created ${query.created}.`
      : null;
  const errorMessage = typeof query.error === "string" ? query.error : null;
  const canCreateSchool = sessionHasPermission(session, Permission.SchoolCreate);

  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const tenantIds = tenants.map((tenant) => tenant.id);
  const localRows = listDistrictSchools(tenantIds);
  const localById = new Map(localRows.map((row) => [row.school.id, row]));

  const accessToken = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  const remoteSchools = accessToken ? await identityListDistrictSchools(accessToken) : null;
  const schools =
    remoteSchools && remoteSchools.ok
      ? remoteSchools.schools.map((school) => {
          const local = localById.get(school.id);
          return {
            school: {
              id: school.id,
              name: school.name,
              createdAt: local?.school.createdAt ?? new Date().toISOString(),
            },
            learnerCount: local?.learnerCount ?? 0,
            staffCount: local?.staffCount ?? 0,
            familyCount: local?.familyCount ?? 0,
          };
        })
      : localRows;

  return (
    <AppShell
      role={session.role}
      roleLabel="District admin"
      navItems={DISTRICT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="District admin"
        title={t("title")}
        description="Every school operating under this district, with staff and learner counts."
      />

      {canCreateSchool ? (
        <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
          <form action={createSchoolAction} className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div>
              <p className="text-sm font-semibold">Create a school</p>
              <p className="mt-1 text-sm text-aivo-ink-soft">
                Add a new school to the district and start delegated staffing from the same shell.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_auto]">
              <input
                name="name"
                type="text"
                placeholder="Northside Elementary"
                className="h-10 rounded-iw-control border border-aivo-border bg-white px-3 text-sm outline-none focus:border-aivo-primary"
                required
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-iw-control bg-aivo-primary px-4 text-sm font-semibold text-white"
              >
                Create school
              </button>
            </div>
          </form>
          {createdMessage ? <p className="mt-3 text-sm text-aivo-success">{createdMessage}</p> : null}
          {errorMessage ? <p className="mt-3 text-sm text-aivo-danger">{errorMessage}</p> : null}
        </Card>
      ) : null}

      {schools.length === 0 ? (
        <EmptyState title={t("empty_title")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((row) => (
            <Card key={row.school.id} className="p-[var(--aivo-density-card-pad)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{row.school.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-aivo-muted">{row.school.id}</p>
                </div>
                <Badge tone="primary">{t("col_school")}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="flex items-center gap-1 text-xs text-aivo-ink-soft">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {t("col_learners")}
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-semibold">
                    {row.learnerCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-aivo-ink-soft">
                    <Users className="h-3.5 w-3.5" />
                    Staff
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-semibold">
                    {row.staffCount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-aivo-ink-soft">
                    <Building2 className="h-3.5 w-3.5" />
                    {t("col_families")}
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-semibold">
                    {row.familyCount.toLocaleString()}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-center justify-between text-xs text-aivo-ink-soft">
                <span>Onboarded {new Date(row.school.createdAt).toLocaleDateString()}</span>
                <Link
                  href="/admin/district/staff"
                  className="font-medium text-aivo-primary hover:underline"
                >
                  {t("view_staff")}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
