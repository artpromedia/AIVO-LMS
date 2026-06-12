import Link from "next/link";
import { StaticRoleShell } from "@/components/layout/static-role-shell";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { AivoMascot } from "@/components/learner/art/aivo-mascot";

export default async function LearnerNotFound() {
  const t = await getTranslations("learner.not_found");
  return (
    <StaticRoleShell role="learner">
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <AivoMascot expression="thinking" size={104} className="mb-1" />
        <p className="text-sm font-medium uppercase tracking-wide text-aivo-ink-soft">404</p>
        <h1 className="mt-2 font-display text-4xl font-bold">{t("title")}</h1>
        <p className="mt-3 text-aivo-ink-soft">{t("body")}</p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/learner/home">{t("cta")}</Link>
          </Button>
        </div>
      </div>
    </StaticRoleShell>
  );
}
