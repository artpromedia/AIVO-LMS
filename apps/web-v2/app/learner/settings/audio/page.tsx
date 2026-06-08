import { requirePageRole } from "@/lib/auth/server";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { getLearnerVoicePreference, upsertLearnerVoicePreference } from "@/lib/db/repos";
import { AudioPrefForm } from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requirePageRole(["learner"]);
  const t = await getTranslations("learner.settings_audio");
  if (!session.learnerId) {
    return (
      <AppShell
        role="learner"
        roleLabel="Learner"
        navItems={LEARNER_NAV}
        user={{ displayName: session.displayName, email: session.email }}
      >
        <PageHeader title={t("no_learner_title")} />
        <Card className="p-[var(--aivo-density-card-pad)] text-aivo-muted">
          {t("no_learner_body")}
        </Card>
      </AppShell>
    );
  }
  // Ensure a row exists so the form renders deterministic initial values
  // even on a fresh tenant where no parent has saved preferences yet.
  const pref =
    await getLearnerVoicePreference(session.learnerId) ??
    await upsertLearnerVoicePreference({
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
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <Card className="p-[var(--aivo-density-card-pad)]">
        <AudioPrefForm learnerId={session.learnerId} initial={pref} canToggleEnabled={false} />
      </Card>
    </AppShell>
  );
}
