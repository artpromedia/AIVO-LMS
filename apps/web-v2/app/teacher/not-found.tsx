import Link from "next/link";
import { StaticRoleShell } from "@/components/layout/static-role-shell";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function TeacherNotFound() {
  const t = await getTranslations("teacher.not_found");
  return (
    <StaticRoleShell role="teacher">
    <div
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold">{t("heading")}</h1>
      <p className="mt-3 text-aivo-ink-soft">{t("body")}</p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/teacher/home">{t("home_link")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/teacher/classes">{t("classes_link")}</Link>
        </Button>
      </div>
    </div>
    </StaticRoleShell>
  );
}
