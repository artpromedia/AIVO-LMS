/**
 * Sprint 17 / HW-1: Homework Helper "Work through" screen. Renders the session
 * state server-side (4-step stepper + problem card) then hands the live
 * work-through loop to a client workspace (chat + support sidebar).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTenantFlags } from "@/lib/bff/tenant-flags";
import { getHomeworkSession } from "@/lib/db/repos";
import { describeHomeworkAttachment } from "@/lib/homework/attachments";
import { HomeworkWorkspace } from "./workspace";
import type { CaptureDescriptor } from "./sidebar";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

const STEP_KEYS = ["step_capture", "step_confirm", "step_work", "step_complete"] as const;

export default async function HomeworkSessionPage({ params }: Readonly<Params>) {
  const { sessionId } = await params;
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }
  const hw = await getHomeworkSession(sessionId, session.tenantId);
  if (hw?.learnerId !== learnerId) notFound();
  const t = await getTranslations("learner.homework");

  const flags = await getTenantFlags();
  const regulationEnabled = flags.selfRegulationHub;

  // Capture method — truthful: web-v2 does not OCR images, so an attached photo
  // is "added", not "OCR confirmed". The learner-typed topic is the problem.
  const capture: CaptureDescriptor = hw.attachment
    ? {
        method: hw.attachment.mimeType === "application/pdf" ? "pdf" : "photo",
        label: describeHomeworkAttachment(hw.attachment),
      }
    : { method: "typed", label: hw.topic };

  // The session always has a captured + confirmed problem; "work through" is the
  // live step until the learner wraps up, which moves it to "complete".
  const currentStep = hw.endedAt ? 3 : 2;

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("header_eyebrow")} title={hw.topic} />

      <ol className="mt-4 flex flex-wrap gap-2" aria-label={t("stepper_aria")}>
        {STEP_KEYS.map((key, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <li
              key={key}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-iw-primary text-white"
                  : done
                    ? "bg-iw-accent-soft text-iw-primary"
                    : "bg-iw-surface text-iw-text-muted border border-iw-border"
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  active ? "bg-white/25" : done ? "bg-iw-primary text-white" : "bg-iw-border"
                }`}
              >
                {done ? "✓" : index + 1}
              </span>
              {t(key)}
            </li>
          );
        })}
      </ol>

      <Card className="mt-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-iw-text-muted">
          {t("problem_label")}
        </p>
        <p className="mt-1 text-base font-medium text-iw-text-strong">{hw.topic}</p>
      </Card>

      {hw.endedAt ? (
        <Card className="mt-4 p-(--aivo-density-card-pad)">
          <h2 className="font-semibold">{t("session_summary")}</h2>
          <p className="mt-2 text-sm">{hw.insight}</p>
          <div className="mt-4">
            <Button asChild variant="soft">
              <Link href="/learner/homework">{t("start_new")}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mt-4">
          <HomeworkWorkspace
            learnerId={learnerId}
            sessionId={hw.id}
            initialMessages={hw.messages}
            regulationEnabled={regulationEnabled}
            capture={capture}
          />
        </div>
      )}
    </AppShell>
  );
}
