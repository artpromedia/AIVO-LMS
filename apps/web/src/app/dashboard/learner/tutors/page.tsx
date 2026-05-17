"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { type TutorKey, getTutorsForTier, TUTORS } from "@aivo/brand";
import { TUTOR_KEY_TO_SKU } from "@aivo/billing-entitlements";
import { useTierThemeOptional } from "@aivo/learner-ui";
import { useTranslations } from "next-intl";
import { useLearnerEntitlements } from "@/hooks/useLearnerEntitlements";

export default function LearnerTutorsPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("learner");
  const tCommon = useTranslations("common");
  const [filter, setFilter] = useState<"all" | "active" | "locked">("all");
  const tierCtx = useTierThemeOptional();

  const { status, isTutorEntitled, entitlements } = useLearnerEntitlements({
    tenantId: user?.tenantId,
    accessToken,
  });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  if (loading || !user) return null;

  // Filter to tutors that fit this learner's age tier (e.g. K-5 hides
  // Chrono / Lingua / Forge / Compass).
  const tutorEntries = getTutorsForTier(tierCtx?.theme.id ?? null) as [TutorKey, typeof TUTORS[TutorKey]][];

  const filtered = tutorEntries.filter(([key]) => {
    if (filter === "active") return isTutorEntitled(key);
    if (filter === "locked") return !isTutorEntitled(key);
    return true;
  });

  const purchasedCount = entitlements?.purchasedTutorSkus.length ?? 0;
  const includedCount = entitlements?.includedTutorSkus.length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard/learner" className="text-sm text-primary hover:underline font-semibold mb-2 inline-block">← {tCommon("back")}</Link>
            <h1 className="text-3xl font-heading font-bold text-slate-900">{t("my_tutors")}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {status === "loading"
                ? tCommon("loading")
                : `${includedCount + purchasedCount} ${t("tutors_unlocked_label")}`}
            </p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(["all", "active", "locked"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {status === "loading" ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <div className="animate-pulse text-slate-400">{tCommon("loading")}</div>
          </div>
        ) : status === "error" ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-rose-200">
            <p className="text-sm text-rose-700">{t("session_load_error")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(([key, tutor]) => {
              const active = isTutorEntitled(key);
              const sku = TUTOR_KEY_TO_SKU[key];
              const isIncluded = entitlements?.includedTutorSkus.includes(sku);
              return (
                <Link key={key} href={`/dashboard/learner/tutors/${key}`}
                  aria-label={
                    active
                      ? `${tutor.name}, ${tutor.domain}, unlocked`
                      : t("tutor_locked_label", { name: tutor.name })
                  }
                  className={`group rounded-2xl border-2 overflow-hidden transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${active ? "border-primary/30 bg-white" : "border-slate-200 bg-slate-50/50 opacity-70 hover:opacity-100"}`}>
                  <div className="p-5">
                    <div className="flex items-center gap-4 mb-3">
                      <Image src={tutor.avatar} alt={tutor.name} width={56} height={56} className={`rounded-xl shadow-sm ${!active ? "grayscale" : ""}`} />
                      <div>
                        <h3 className="font-heading font-bold text-slate-900 group-hover:text-primary transition">{tutor.name}</h3>
                        <p className="text-xs text-slate-500">{tutor.domain}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${tutor.tier === "core" ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"}`}>
                        {tutor.tier}
                      </span>
                      {active ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))] font-semibold">
                          {isIncluded ? t("included") : t("purchased")}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-500 font-semibold">{t("locked")}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1" style={{ backgroundColor: tutor.color }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
