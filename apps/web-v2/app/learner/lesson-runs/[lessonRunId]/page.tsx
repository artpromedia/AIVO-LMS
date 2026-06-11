/**
 * Sprint 13: Lesson Player route.
 *
 * Server component loads the LessonRun + GeneratedLessonPlan + accessibility
 * prefs, performs role/tenant/learner authz, and renders the client-side
 * `LessonPlayer` for beat-by-beat interaction. The route URL is canonical
 * (`/learner/lesson-runs/[lessonRunId]`) — older `/learner/lesson/[id]` links
 * have been migrated.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAccessibilityPrefs,
  getLearner,
  getLessonRun,
  getSubjectById,
  parentCanAccessLearner,
} from "@/lib/db/repos";
import { TUTORS } from "@aivo/brand";
import { LessonPlayer, type LessonAgentConfig } from "./lesson-player";
import { lessonPlayerV2Enabled, tutorAgenticModeEnabled } from "@/lib/feature-flags";
import { isLiveTutorAgent } from "@/lib/bff/tutor-agent";

// Re-export ergonomics: subject lookup by id used to pin the v2 player
// to a learning-path subject slug.

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ lessonRunId: string }> };

export default async function LearnerLessonRunPage({ params }: RouteParams) {
  const { lessonRunId } = await params;
  const session = await requirePageRole(["learner", "parent"]);
  const t = await getTranslations("learner.lesson_run");
  const found = await getLessonRun(lessonRunId, session.tenantId);
  if (!found) redirect("/learner/home");
  const { lessonRun, plan } = found;
  const learner = await getLearner(lessonRun.learnerId, session.tenantId);
  if (!learner) redirect("/learner/home");
  // Tenant scope is already enforced by getLessonRun. Now enforce
  // learner-level scope to prevent SSR IDOR — a parent in the same tenant
  // must own the learner, and a learner can only open their own run.
  if (session.role === "learner") {
    if (learner.id !== session.learnerId) redirect("/learner/home");
  } else {
    // Parent (or other shadowing role): require ownership + active-learner
    // cookie match so a parent can only play under the learner they've
    // explicitly switched to.
    if (!(await parentCanAccessLearner(session.userId, learner.id, session.tenantId))) {
      redirect("/learner/select");
    }
    const active = await readActiveLearnerFromCookies(session);
    if (active !== learner.id) redirect("/learner/select");
  }
  const a11y = await getAccessibilityPrefs(learner.id, session.tenantId);
  const lessonSubject = await getSubjectById(lessonRun.subjectId);
  const v2Enabled = lessonPlayerV2Enabled();

  // Wave E (S9) — agentic tutor pilot. Math lessons get Nova as the
  // observing agent when the tenant flag is on AND the live tutor-svc path
  // is configured. With either condition false `agent` stays null and the
  // player renders byte-identically to the pre-agent build.
  let agent: LessonAgentConfig | null = null;
  if (
    lessonSubject?.slug === "math" &&
    isLiveTutorAgent() &&
    (await tutorAgenticModeEnabled())
  ) {
    const nova = TUTORS.nova;
    agent = { tutorKey: "nova", name: nova.name, icon: nova.icon, color: nova.color };
  }

  // When the plan is still generating or has failed, we can't run the player.
  if (!plan || lessonRun.status === "generating" || lessonRun.status === "failed") {
    return (
      <AppShell
        role={session.role === "learner" ? "learner" : "parent"}
        roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader
          eyebrow="Lesson"
          title={
            lessonRun.status === "failed"
              ? "We hit a snag preparing this lesson"
              : "Getting your lesson ready…"
          }
          description={
            lessonRun.status === "failed"
              ? "Try again — your tutor will rebuild it from scratch."
              : "Hang tight — your tutor is preparing the lesson."
          }
        />
        <Card className="p-[var(--aivo-density-card-pad)]">
          <Badge tone={lessonRun.status === "failed" ? "warning" : "neutral"}>
            {lessonRun.status}
          </Badge>
          {lessonRun.failureReason && (
            <p className="mt-2 text-sm text-red-700">{lessonRun.failureReason}</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button asChild variant="soft">
              <Link href="/learner/home">{t("back_to_today")}</Link>
            </Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <LessonPlayer
        learnerId={learner.id}
        lessonRunId={lessonRun.id}
        plan={plan}
        accessibility={a11y}
        initialStatus={lessonRun.status}
        v2Enabled={v2Enabled}
        // Treat the lesson-run id as the v2 session correlator when no
        // separate `sessions` row has been minted yet. The v2 BFF
        // accepts either — upstream learning-svc creates the session
        // lazily on first advance.
        sessionId={lessonRun.id}
        subjectSlug={lessonSubject?.slug ?? null}
        agent={agent}
      />
    </AppShell>
  );
}
