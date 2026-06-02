import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function AdminNotFound() {
  const t = await getTranslations("admin.not_found");
  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-muted">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold">{t("heading")}</h1>
      <p className="mt-3 text-aivo-ink-soft">{t("body")}</p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/admin">{t("home_link")}</Link>
        </Button>
      </div>
    </main>
  );
}
