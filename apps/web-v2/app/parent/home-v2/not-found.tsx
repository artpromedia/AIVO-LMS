import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /parent/home-v2 — not-found state.
 *
 * Reached if a nested route under /parent/home-v2 is hit that
 * doesn't exist. Keep the tone calm and offer a clear way back.
 */
export default async function ParentHomeV2NotFound() {
  const t = await getTranslations("parent.home_v2");
  return (
    <main className="min-h-screen bg-[var(--aivo-color-surface-canvas)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-iw-card-lg bg-white border border-iw-border shadow-[0_18px_50px_-30px_rgba(15,23,42,0.18)] p-8 flex flex-col gap-4 text-center">
        <div className="self-center inline-flex items-center justify-center h-14 w-14 rounded-full bg-[var(--aivo-aivoTeal-100)] text-[var(--aivo-aivoTeal-700)]">
          <AivoIcon name="aiBrain" size={28} />
        </div>
        <h1 className="text-xl font-semibold text-iw-text-strong">{t("not_found_heading")}</h1>
        <p className="text-sm text-iw-text-muted">
          The redesigned parent home is still rolling out. The page you were looking for either
          hasn't shipped yet or has a different address.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Link
            href="/parent/home-v2"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold hover:opacity-95"
          >
            {t("back_to_home")}
          </Link>
          <Link
            href="/parent/home"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-iw-control bg-white text-iw-text-strong font-semibold border border-iw-border hover:border-iw-text-muted"
          >
            {t("open_legacy_home")}
          </Link>
        </div>
      </div>
    </main>
  );
}
