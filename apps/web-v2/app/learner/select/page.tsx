/**
 * Sprint 12: Learner selection — a parent with multiple children picks which
 * one to "view as" on /learner/home. Sets the `aivo_active_learner_id`
 * cookie via a server action and redirects to /learner/home.
 *
 * Single-child parents are bounced through automatically.
 */
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LearnerAvatar } from "@/components/learner/learner-avatar";
import { listLearnersForParent } from "@/lib/db/repos";
import { ACTIVE_LEARNER_COOKIE, verifyActiveLearner } from "@/lib/auth/active-learner";

async function chooseLearner(formData: FormData) {
  "use server";
  const learnerId = String(formData.get("learnerId") ?? "");
  const session = await requirePageRole(["parent"]);
  const ok = await verifyActiveLearner(session, learnerId);
  if (!ok) redirect("/learner/select?error=forbidden");
  const jar = await cookies();
  jar.set({
    name: ACTIVE_LEARNER_COOKIE,
    value: ok,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/learner/home");
}

export default async function LearnerSelectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("learner.select");
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const params = await searchParams;

  // Single learner → auto-select and proceed. Cookies can only be mutated in
  // a Server Action or Route Handler in Next.js 15, so we bounce through the
  // `/learner/select/auto` route handler which sets the cookie and redirects.
  if (learners.length === 1) {
    redirect(`/learner/select/auto?learnerId=${encodeURIComponent(learners[0].id)}`);
  }

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      />
      {params.error === "forbidden" && (
        <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {t("forbidden")}
        </Card>
      )}
      {learners.length === 0 ? (
        <EmptyState
          title={t("no_learners")}
          description={t("no_learners_desc")}
          action={
            <Button asChild>
              <Link href="/parent/learners/new">{t("add_learner")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {learners.map((l) => (
            <form key={l.id} action={chooseLearner}>
              <input type="hidden" name="learnerId" value={l.id} />
              <button
                type="submit"
                className="block w-full text-left"
                aria-label={t("view_as_aria", { name: l.displayName })}
              >
                <Card className="flex items-center gap-4 p-[var(--aivo-density-card-pad)] transition hover:border-aivo-primary hover:shadow-md">
                  <LearnerAvatar name={l.displayName} size="lg" />
                  <div className="flex-1">
                    <p className="font-display text-lg font-semibold">{l.displayName}</p>
                    <p className="text-sm text-aivo-ink-soft">
                      {l.ageRange ?? t("age_not_set")}
                      {l.gradeBand ? ` · ${l.gradeBand}` : ""}
                    </p>
                    <div className="mt-2">
                      <Badge tone="neutral">{t("readiness", { state: l.readinessState.replace(/_/g, " ") })}</Badge>
                    </div>
                  </div>
                </Card>
              </button>
            </form>
          ))}
        </div>
      )}
    </AppShell>
  );
}
