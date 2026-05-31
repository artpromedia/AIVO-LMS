import { MARKETING_ACCENTS } from "@aivo/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { LEVELS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";

const URL = `${SITE_URL}/levels`;

export const metadata: Metadata = {
  title: "AIVO's 5 Functioning Levels – Inclusive AI Tutoring for Every Learner",
  description:
    "AIVO supports five functioning levels — Standard, Supported, Guided, Exploratory, and Pre-Symbolic — so every learner gets a personalized path.",
  alternates: { canonical: URL },
  openGraph: {
    title: "AIVO's 5 Functioning Levels",
    description:
      "From grade-level academics to pre-symbolic communication — one platform for every learner.",
    url: URL,
    type: "website",
  },
};

export default async function LevelsIndex() {
  const t = await getTranslations("marketing.page_levels");
  return (
    <LandingPageLayout
      badge="Functioning Levels"
      badgeColor={MARKETING_ACCENTS.purple}
      title={t("hero_title")}
      subtitle="AIVO is the only AI learning platform built to serve learners across the full spectrum — from grade-level academics down to pre-symbolic, partner-assisted communication."
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Levels", href: "/levels" },
      ]}
    >
      <div className="space-y-4">
        {LEVELS.map((level) => (
          <Link
            key={level.slug}
            href={`/levels/${level.slug}`}
            className="block rounded-3xl border border-slate-100 bg-white p-6 hover:border-purple-200 hover:shadow-lg transition"
          >
            <div className="flex items-start gap-4">
              <span className="inline-flex w-12 h-12 rounded-2xl bg-purple-100 text-primary items-center justify-center font-heading font-bold text-xl shrink-0">
                {level.level}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading font-bold text-slate-900 text-xl">
                  Level {level.level}: {level.name}
                </h2>
                <p className="text-slate-600 font-body mt-2 leading-relaxed">{level.short}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 shrink-0 mt-2" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </LandingPageLayout>
  );
}
