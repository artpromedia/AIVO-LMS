import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StaticRoleShell } from "@/components/layout/static-role-shell";

export default async function TherapistNotFound() {
  const t = await getTranslations("therapist.not_found");
  return (
    <StaticRoleShell role="therapist">
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-iw-ink-muted">{t("eyebrow")}</p>
        <h1 className="mt-2 font-display text-4xl font-bold">{t("heading")}</h1>
        <p className="mt-3 text-iw-ink-muted">{t("body")}</p>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/therapist/home">{t("home_link")}</Link>
          </Button>
        </div>
      </div>
    </StaticRoleShell>
  );
}
