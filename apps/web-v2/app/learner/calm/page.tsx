/**
 * Calm Corner — a learner-initiated regulation surface.
 *
 * Universal activities (breathing, grounding, stretch, strategies) are
 * always available; a personalized suggestion appears only when the
 * `selfRegulationHub` enterprise flag is on and a focus signal was
 * deep-linked via `?action=`.
 */
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePageRole } from "@/lib/auth/server";
import { readActiveLearnerFromCookies } from "@/lib/auth/active-learner";
import { AppShell } from "@/components/layout/app-shell";
import { LEARNER_NAV } from "@/components/layout/role-shells";
import { getTenantFlags } from "@/lib/bff/tenant-flags";
import { getCalmCatalog, recommendCalmActivity } from "@/lib/learner/calm";
import { getAccessibilityPrefs } from "@/lib/db/repos";
import { CalmCorner } from "./calm-corner";

export const dynamic = "force-dynamic";

export default async function LearnerCalmPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const session = await requirePageRole(["learner", "parent"]);
  let learnerId: string | null = null;
  if (session.role === "learner") {
    learnerId = session.learnerId ?? null;
    if (!learnerId) redirect("/learner/select");
  } else {
    learnerId = await readActiveLearnerFromCookies(session);
    if (!learnerId) redirect("/learner/select");
  }

  const { action } = await searchParams;
  const flags = await getTenantFlags();
  const recommended =
    flags.selfRegulationHub && action ? recommendCalmActivity(action) : null;

  // Audio cues are an explicit, persisted opt-in (default off). There is no
  // server-authoritative "quiet" sensory posture today — the sensory mode is
  // a browser cookie set client-side — so we gate purely on the stored
  // preference here; the in-runner mute affordance covers a momentary quiet.
  const prefs = await getAccessibilityPrefs(learnerId, session.tenantId);
  const audioCuesEnabled = prefs.calmAudioCues === true;

  const t = await getTranslations("learner.calm");

  return (
    <AppShell
      role={session.role === "learner" ? "learner" : "parent"}
      roleLabel={session.role === "learner" ? "Learner" : "Parent · Learner view"}
      navItems={LEARNER_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-aivo-muted">
          {t("eyebrow")}
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-iw-text-strong">
          {t("title")}
        </h1>
        <p className="text-aivo-ink-soft max-w-prose">{t("intro")}</p>
      </header>

      <CalmCorner
        learnerId={learnerId}
        catalog={getCalmCatalog()}
        recommendedId={recommended}
        audioCuesEnabled={audioCuesEnabled}
      />
    </AppShell>
  );
}
