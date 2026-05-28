import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PARENT_NAV } from "@/components/layout/role-shells";
import {
  getLearner,
  getLearnerVoicePreference,
  parentCanAccessLearner,
  upsertLearnerVoicePreference,
} from "@/lib/db/repos";
import { AudioPrefForm } from "@/app/learner/settings/audio/form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ learnerId: string }> };

export default async function Page({ params }: PageProps) {
  const session = await requirePageRole(["parent"]);
  const { learnerId } = await params;
  if (!await parentCanAccessLearner(session.userId, learnerId, session.tenantId)) {
    notFound();
  }
  const learner = await getLearner(learnerId, session.tenantId);
  if (!learner) notFound();
  const pref =
    getLearnerVoicePreference(learnerId) ??
    upsertLearnerVoicePreference({
      learnerId,
      tenantId: session.tenantId,
    });
  return (
    <AppShell
      role="parent"
      roleLabel="Parent"
      navItems={PARENT_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow={`${learner.displayName} · Accessibility`}
        title="Read-aloud"
        description="Choose the voice your learner hears and decide whether read-aloud is turned on at all. Captions can be displayed alongside playback."
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <AudioPrefForm learnerId={learnerId} initial={pref} canToggleEnabled={true} />
      </Card>
    </AppShell>
  );
}
