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
import { resolveEnterpriseFlags } from "@aivo/feature-flags";
import { getCalmCatalog, recommendCalmActivity } from "@/lib/learner/calm";
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
  const flags = resolveEnterpriseFlags(process.env as Record<string, string | undefined>);
  const recommended =
    flags.selfRegulationHub && action ? recommendCalmActivity(action) : null;

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
      />
    </AppShell>
  );
}
