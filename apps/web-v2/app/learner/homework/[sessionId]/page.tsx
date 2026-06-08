/**
 * Sprint 17: Homework chat. Renders message history server-side then hands
 * off to a small client component for the live send/receive loop.
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
import { resolveEnterpriseFlags } from "@aivo/feature-flags";
import { getHomeworkSession } from "@/lib/db/repos";
import { describeHomeworkAttachment } from "@/lib/homework/attachments";
import { HomeworkChat } from "./chat";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

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

  const flags = resolveEnterpriseFlags(process.env);
  const regulationEnabled = flags.selfRegulationHub;

  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader eyebrow={t("header_eyebrow")} title={hw.topic} />
      {hw.attachment ? (
        <Card className="mt-3 p-3 text-sm">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold"
            >
              {hw.attachment.mimeType === "application/pdf" ? "PDF" : "IMG"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-iw-text-strong truncate">
                {describeHomeworkAttachment(hw.attachment)}
              </p>
              <p className="text-xs text-iw-text-muted">{t("attachment_note")}</p>
            </div>
          </div>
        </Card>
      ) : null}
      {hw.endedAt ? (
        <Card className="p-(--aivo-density-card-pad)">
          <h2 className="font-semibold">{t("session_summary")}</h2>
          <p className="mt-2 text-sm">{hw.insight}</p>
          <div className="mt-4">
            <Button asChild variant="soft">
              <Link href="/learner/homework">{t("start_new")}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <HomeworkChat
          learnerId={learnerId}
          sessionId={hw.id}
          initialMessages={hw.messages}
          regulationEnabled={regulationEnabled}
        />
      )}
    </AppShell>
  );
}
