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
import { SCHOOL_NAV } from "@/components/layout/role-shells";
import { sessionHasPermission } from "@/lib/auth/permissions";
import {
  createLearner,
  createTenant,
  scopeTenantsForSession,
} from "@/lib/db/repos";
import { getStore, newId, nowIso } from "@/lib/db/store";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  identityCreateSchoolLearner,
  identityListSchoolLearners,
} from "@/lib/auth/identity-client";

type SchoolLearnersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function createLearnerAction(formData: FormData) {
  "use server";

  const session = await requirePageRole(["school_admin"]);
  if (!sessionHasPermission(session, Permission.LearnerCreate)) {
    redirect("/admin/school/learners?error=You+do+not+have+permission+to+create+learners.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const gradeBand = String(formData.get("gradeBand") ?? "").trim() || null;
  const functioningLevel = String(formData.get("functioningLevel") ?? "").trim() || null;
  if (!name) {
    redirect("/admin/school/learners?error=Learner+name+is+required.");
  }

  const accessToken = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (accessToken) {
    const result = await identityCreateSchoolLearner(accessToken, {
      name,
      gradeLevel: gradeBand ?? undefined,
      functioningLevel: functioningLevel ?? undefined,
    });
    if (!result.ok) {
      redirect(`/admin/school/learners?error=${encodeURIComponent(result.error)}`);
    }
  } else {
    const family = createTenant({
      name: `${name} Family`,
      type: "family",
      parentTenantId: session.tenantId,
    });
    const store = getStore();
    const createdAt = nowIso();
    const parentId = newId("u");
    store.users.set(parentId, {
      id: parentId,
      email: `${family.id}@demo.invalid`,
      displayName: `${name} Family`,
      createdAt,
    });
    store.memberships.push({
      userId: parentId,
      tenantId: family.id,
      role: "parent",
      permissions: [],
      createdAt,
    });
    const learner = await createLearner({
      tenantId: family.id,
      parentUserId: parentId,
      data: {
        firstName: name.split(/\s+/)[0] || name,
        preferredName: name,
        birthYear: new Date().getFullYear() - 8,
        gradeBand: (gradeBand as
          | "preK"
          | "K"
          | "1-2"
          | "3-5"
          | "6-8"
          | "9-12"
          | "post_secondary"
          | null) ?? null,
      },
    });
    if (functioningLevel) {
      store.learnerProfiles.set(learner.id, {
        ...learner,
        functioningLevel: functioningLevel as
          | "standard"
          | "supported"
          | "alternative"
          | "non_verbal"
          | "pre_symbolic",
      });
    }
  }

  revalidatePath("/admin/school/learners");
  redirect(`/admin/school/learners?created=${encodeURIComponent(name)}`);
}

export default async function Page({ searchParams }: SchoolLearnersPageProps) {
  const session = await requirePageRole(["school_admin"]);
  const t = await getTranslations("admin.school_learners");
  const query = ((await searchParams) ?? {}) as Record<string, string | string[] | undefined>;
  const createdMessage =
    typeof query.created === "string" && query.created.length > 0
      ? `Created learner ${query.created}.`
      : null;
  const errorMessage = typeof query.error === "string" ? query.error : null;
  const canCreateLearner = sessionHasPermission(session, Permission.LearnerCreate);

  const tenants = scopeTenantsForSession(session.role, session.tenantId);
  const ids = new Set(tenants.map((tenant) => tenant.id));

  const accessToken = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  const remoteLearners = accessToken ? await identityListSchoolLearners(accessToken) : null;
  const learners =
    remoteLearners && remoteLearners.ok
      ? remoteLearners.learners.map((learner) => ({
          id: learner.id,
          name: learner.name,
          gradeLevel: learner.gradeLevel ?? null,
          readiness: "created",
          functioningLevel: learner.functioningLevel ?? null,
        }))
      : Array.from(getStore().learnerProfiles.values())
          .filter((learner) => ids.has(learner.tenantId))
          .map((learner) => ({
            id: learner.id,
            name: learner.displayName,
            gradeLevel: learner.gradeBand,
            readiness: learner.readinessState,
            functioningLevel: learner.functioningLevel,
          }));

  return (
    <AppShell
      role={session.role}
      roleLabel="School admin"
      navItems={SCHOOL_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="School admin"
        title={t("title")}
        description="Every learner whose family is rostered under this school."
      />

      {canCreateLearner ? (
        <Card className="mb-6 p-[var(--aivo-density-card-pad)]">
          <form action={createLearnerAction} className="grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]">
            <input
              name="name"
              type="text"
              placeholder="Sky Rivera"
              className="h-10 rounded-iw-control border border-aivo-border bg-white px-3 text-sm outline-none focus:border-aivo-primary"
              required
            />
            <select
              name="gradeBand"
              className="h-10 rounded-iw-control border border-aivo-border bg-white px-3 text-sm outline-none focus:border-aivo-primary"
              defaultValue=""
            >
              <option value="">Grade</option>
              <option value="preK">Pre-K</option>
              <option value="K">K</option>
              <option value="1-2">1-2</option>
              <option value="3-5">3-5</option>
              <option value="6-8">6-8</option>
              <option value="9-12">9-12</option>
              <option value="post_secondary">Post-secondary</option>
            </select>
            <select
              name="functioningLevel"
              className="h-10 rounded-iw-control border border-aivo-border bg-white px-3 text-sm outline-none focus:border-aivo-primary"
              defaultValue=""
            >
              <option value="">Functioning level</option>
              <option value="standard">Standard</option>
              <option value="supported">Supported</option>
              <option value="alternative">Alternative</option>
              <option value="non_verbal">Non-verbal</option>
              <option value="pre_symbolic">Pre-symbolic</option>
            </select>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-iw-control bg-aivo-primary px-4 text-sm font-semibold text-white"
            >
              Create learner
            </button>
          </form>
          {createdMessage ? <p className="mt-3 text-sm text-aivo-success">{createdMessage}</p> : null}
          {errorMessage ? <p className="mt-3 text-sm text-aivo-danger">{errorMessage}</p> : null}
        </Card>
      ) : null}

      {learners.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-aivo-surface-2 text-left">
              <tr>
                <th className="p-3">{t("col_learner")}</th>
                <th className="p-3">Grade</th>
                <th className="p-3">{t("col_readiness")}</th>
                <th className="p-3">{t("col_fl")}</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <tr key={learner.id} className="border-t border-aivo-border">
                  <td className="p-3 font-medium">{learner.name}</td>
                  <td className="p-3 text-aivo-ink-soft">{learner.gradeLevel ?? "-"}</td>
                  <td className="p-3">
                    <Badge tone="primary">{learner.readiness}</Badge>
                  </td>
                  <td className="p-3 text-aivo-ink-soft">{learner.functioningLevel ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
