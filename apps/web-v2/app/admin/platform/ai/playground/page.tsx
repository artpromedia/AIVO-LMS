import { requirePageRole } from "@/lib/auth/server";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { PLATFORM_NAV } from "@/components/layout/role-shells";
import { PlaygroundForm } from "./playground-form";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const t = await getTranslations("admin.platform_ai_playground");
  const session = await requirePageRole(["platform_admin"]);

  return (
    <AppShell
      role="platform_admin"
      roleLabel="Platform admin"
      navItems={PLATFORM_NAV}
      user={{ displayName: session.displayName, email: session.email }}
    >
      <PageHeader
        eyebrow="Platform · AI"
        title={t("title")}
        description="Send ad-hoc prompts through the safety pipeline and LLM fallback chain. Useful for verifying tutor prompts, moderation behaviour, and cost envelopes without touching production."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-[var(--aivo-density-card-pad)] lg:col-span-2">
          <PlaygroundForm />
        </Card>

        <Card className="p-[var(--aivo-density-card-pad)]">
          <p className="font-display text-lg font-semibold">{t("how_it_works")}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-aivo-ink-soft">
            <li>
              Your prompt is screened by the safety pipeline (prompt-injection, crisis,
              age-appropriateness) before any LLM is called.
            </li>
            <li>
              If allowed, the request is sent through the standard fallback chain (Claude Opus 4.7 →
              Gemini 3.0 Pro → GPT-5.5).
            </li>
            <li>{t("responses_moderated")}</li>
            <li>
              Every playground call is attributed to your platform-admin session in the AI cost
              ledger.
            </li>
          </ol>
          <p className="mt-4 text-xs text-aivo-ink-soft">
            {t("playground_responses_are")} <span className="font-medium">not</span> persisted to
            learner-facing surfaces.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
