/**
 * Parent Notifications (ParentApp.dc.html → isNotifications).
 *
 * The AIVO recommendations inbox — "AIVO's suggestions for {name}, you decide
 * what to accept" — plus a real "Other updates" activity stream. Recommendation
 * decisions (accept / add context / deny) run through the recommendation-svc
 * routes the panel already calls; the full add-context/undo redesign lands with
 * net-new backend #2. Relocated here from the home per the design.
 */
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PendingRecommendationsPanel } from "@/components/parent/pending-recommendations-panel";
import { LiveUpdatesCard } from "@/components/parent/live-updates-card";
import { listLearnersForParent } from "@/lib/db/repos";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ learner?: string }>;
}) {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.notifications");
  const { learner: requestedId } = await searchParams;

  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const featured = (requestedId && learners.find((l) => l.id === requestedId)) || learners[0];
  const featuredFirst = featured?.displayName.split(" ")[0] ?? "";

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        title={t("page_title")}
        description={featured ? t("page_subtitle", { name: featuredFirst }) : t("description")}
      />

      {!featured ? (
        <div className="rounded-iw-card-lg bg-white border border-iw-border p-6">
          <EmptyState title={t("empty_title")} description={t("empty_body")} />
        </div>
      ) : (
        <div className="flex max-w-3xl flex-col gap-7">
          {learners.length > 1 ? (
            <nav aria-label={t("page_title")} className="flex flex-wrap gap-2">
              {learners.map((l) => {
                const isActive = l.id === featured.id;
                return (
                  <Button
                    key={l.id}
                    asChild
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                  >
                    <Link href={`?learner=${l.id}`} aria-current={isActive ? "true" : undefined}>
                      {l.displayName.split(" ")[0]}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          ) : null}

          <section aria-label={t("recs_heading", { name: featuredFirst })}>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-iw-control bg-[var(--aivo-aivoPurple-100)] text-[var(--aivo-sensory-primary)]">
                <Sparkles size={16} aria-hidden />
              </span>
              <h2 className="font-iw-display text-lg font-bold text-iw-text-strong">
                {t("recs_heading", { name: featuredFirst })}
              </h2>
            </div>
            <PendingRecommendationsPanel learnerId={featured.id} />
          </section>

          <section aria-label={t("other_updates_heading")}>
            <h2 className="mb-3 font-iw-display text-lg font-bold text-iw-text-strong">
              {t("other_updates_heading")}
            </h2>
            <LiveUpdatesCard learnerId={featured.id} learnerName={featuredFirst} />
          </section>
        </div>
      )}
    </AppShell>
  );
}
