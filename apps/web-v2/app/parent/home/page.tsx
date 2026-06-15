import Link from "next/link";
import { Plus, Users, Sparkles, ShieldCheck, ArrowRight } from "lucide-react";
import { FloatingMetricCard } from "@aivo/ui/hero";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { SectionHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PARENT_NAV } from "@/components/layout/role-shells";
import { listLearnersForParent, refreshLearnerReadiness } from "@/lib/db/repos";
import { LearnerCard } from "@/components/parent/learner-card";
import { MessagesSummaryCard } from "@/components/parent/messages-summary-card";
import { NextSessionCard, type NextSession } from "@/components/parent/next-session-card";
import { getParentMessagesSummary } from "@/lib/messaging/summary";
import { listSessionsForParent, getProvider } from "@/lib/db/repos";

const READY_STATES = new Set(["ready_for_today_mission", "active_learning"]);

export default async function ParentHome() {
  const session = await requirePageRole(["parent"]);
  const t = await getTranslations("parent.home");
  const initial = await listLearnersForParent(session.userId, session.tenantId);
  for (const l of initial) await refreshLearnerReadiness(l.id, session.tenantId);
  const learners = await listLearnersForParent(session.userId, session.tenantId);
  const messagesSummary = await getParentMessagesSummary(session);

  // Soonest upcoming human session across the family (real bookings only).
  const allSessions = await listSessionsForParent(session.userId, session.tenantId);
  const nowMs = Date.now();
  const nextBooking = allSessions
    .filter((s) => s.status === "scheduled" && new Date(s.scheduledStart).getTime() > nowMs)
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0];
  const nextSession: NextSession = nextBooking
    ? {
        learnerId: nextBooking.learnerId,
        providerName:
          getProvider(nextBooking.providerId, session.tenantId)?.displayName ?? nextBooking.title,
        kind: nextBooking.kind,
        scheduledStart: nextBooking.scheduledStart,
      }
    : null;

  const firstName = session.displayName.split(" ")[0];
  const primary = learners[0];
  const primaryFirst = primary ? primary.displayName.split(" ")[0] : null;
  const readyCount = learners.filter((l) => READY_STATES.has(l.readinessState)).length;
  const needsActionCount = learners.length - readyCount;

  const subhead =
    learners.length === 0
      ? "Let's add your first learner so we can start their journey."
      : learners.length === 1
        ? `${primaryFirst} is ready for today's learning.`
        : "Your learners are set up. Pick one to dive in.";

  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <section
        aria-label={t("greeting")}
        className="relative overflow-hidden rounded-iw-hero bg-gradient-to-br from-[var(--aivo-aivoPurple-100)] via-white to-[var(--aivo-aivoTeal-100)] px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12 shadow-[0_40px_100px_-50px_rgba(124,58,237,0.25)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--aivo-sensory-primary)]/20 to-[var(--aivo-aivoTeal-700)]/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-gradient-to-tr from-[var(--aivo-aivoTeal-100)] to-transparent blur-3xl"
        />
        <div className="relative flex max-w-2xl flex-col gap-4">
          <p className="text-sm font-medium text-iw-text-muted">{t("family_workspace")}</p>
          <h1 className="font-iw-display text-3xl font-bold leading-[1.1] tracking-tight text-iw-text-strong sm:text-4xl lg:text-5xl">
            Hi, {firstName}.
          </h1>
          <p className="font-iw-display text-lg text-iw-text-muted sm:text-xl">{subhead}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href={primary ? `/parent/learners/${primary.id}` : "/parent/learners/new"}>
                {primary ? `Open ${primaryFirst}'s profile` : t("add_your_first_learner")}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            {primary ? (
              <Button asChild variant="outline" size="lg">
                <Link href="/parent/learners/new">
                  <Plus className="mr-1 h-4 w-4" /> {t("add_another_learner")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {learners.length > 0 ? (
        <section
          aria-label={t("today_at_a_glance")}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <FloatingMetricCard
            label="Learners"
            value={learners.length}
            description={
              learners.length === 1
                ? "One learner on your family plan."
                : `${learners.length} learners on your family plan.`
            }
            icon={<Users className="h-5 w-5" aria-hidden />}
            tone="info"
          />
          <FloatingMetricCard
            label="Ready to learn"
            value={readyCount}
            description={
              readyCount === learners.length
                ? "All learners are set up for today."
                : "Baseline + consent complete."
            }
            icon={<Sparkles className="h-5 w-5" aria-hidden />}
            tone={readyCount === learners.length ? "success" : "neutral"}
          />
          <FloatingMetricCard
            label="Needs your action"
            value={needsActionCount}
            description={
              needsActionCount === 0
                ? "Nothing waiting on you. Nice."
                : "Open the learner card below to finish setup."
            }
            icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
            tone={needsActionCount === 0 ? "success" : "warning"}
          />
        </section>
      ) : null}

      {learners.length > 0 ? (
        <section aria-label={t("messages_section")} className="grid gap-4 sm:grid-cols-2">
          <MessagesSummaryCard summary={messagesSummary} />
          <NextSessionCard next={nextSession} />
        </section>
      ) : null}

      <div className="space-y-4">
        <SectionHeader
          title={t("your_learners")}
          description="Each card shows the next step we need from you."
        />
        {learners.length === 0 ? (
          <EmptyState
            title={t("no_learners_yet")}
            description="Add your first learner to begin assessment and personalize their learning path."
            action={
              <Button asChild>
                <Link href="/parent/learners/new">{t("add_your_first_learner")}</Link>
              </Button>
            }
          />
        ) : (
          <div
            className={
              learners.length === 1
                ? "grid gap-4 sm:max-w-md"
                : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
            }
          >
            {learners.map((l) => (
              <LearnerCard key={l.id} learner={l} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
