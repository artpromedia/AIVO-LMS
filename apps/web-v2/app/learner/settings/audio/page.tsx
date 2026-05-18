import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { getLearnerVoicePreference, upsertLearnerVoicePreference } from "@/lib/db/repos";
import { AudioPrefForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  if (!session.learnerId) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader title="Audio" />
        <Card className="p-[var(--aivo-density-card-pad)] text-aivo-muted">
          Sign in as a learner to view audio settings.
        </Card>
      </AppShell>
    );
  }
  // Ensure a row exists so the form renders deterministic initial values
  // even on a fresh tenant where no parent has saved preferences yet.
  const pref =
    getLearnerVoicePreference(session.learnerId) ??
    upsertLearnerVoicePreference({
      learnerId: session.learnerId,
      tenantId: session.tenantId,
    });
  return (
    <AppShell
      role="learner"
      roleLabel="Learner"
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Settings"
        title="Read-aloud"
        description="Pick a voice and playback speed. Your grown-up controls whether read-aloud is turned on."
      />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <AudioPrefForm learnerId={session.learnerId} initial={pref} canToggleEnabled={false} />
      </Card>
    </AppShell>
  );
}
