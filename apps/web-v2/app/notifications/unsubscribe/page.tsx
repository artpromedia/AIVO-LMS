/**
 * Sprint C-08 — contribution-nudge unsubscribe landing.
 *
 * The "turn them off" link in the team-contribution nudge email lands here.
 * We render an explicit one-tap confirm (never auto-fire on load, so an email
 * client's link prefetch can't silently opt someone out). Confirming calls a
 * server action that sets the per-member opt-out flag the reminder job honors.
 */
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { UnsubscribeConfirm } from "./unsubscribe-confirm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kind?: string; invite?: string }>;

export default async function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations("notifications.unsubscribe");
  const params = await searchParams;
  const kind = (params.kind ?? "").trim();
  const invite = (params.invite ?? "").trim();
  const valid = ["teacher", "caregiver", "therapist"].includes(kind) && invite.length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-aivo-surface-soft p-6">
      <Card className="w-full max-w-md space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        {valid ? (
          <UnsubscribeConfirm
            kind={kind}
            invite={invite}
            prompt={t("prompt")}
            confirmLabel={t("confirm")}
            doneLabel={t("done")}
            errorLabel={t("error")}
          />
        ) : (
          <p className="text-sm text-aivo-ink-soft">{t("invalid")}</p>
        )}
      </Card>
    </div>
  );
}
