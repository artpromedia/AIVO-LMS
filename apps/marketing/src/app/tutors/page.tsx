import { MARKETING_ACCENTS } from "@aivo/brand";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { TUTORS } from "@/components/marketing/data";
import { SITE_URL } from "@/lib/constants";

const URL = `${SITE_URL}/tutors`;

export const metadata: Metadata = {
  title: "Meet the 14 AIVO AI Tutors – Personalized Tutors for Every Subject",
  description:
    "Meet AIVO's 14 specialized AI tutors — from Nova for math to Echo for AAC speech. Each has a unique personality and adapts to your child's learning profile.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Meet the 14 AIVO AI Tutors",
    description:
      "Specialized AI tutors for math, reading, science, speech, social-emotional learning and more — all adapting to your child's Brain Clone.",
    url: URL,
    type: "website",
  },
};

export default async function TutorsIndex() {
  const t = await getTranslations("marketing.page_tutors");
  return (
    <LandingPageLayout
      badge="AI Tutors"
      badgeColor={MARKETING_ACCENTS.purple}
      title={t("page_title")}
      subtitle="Each AIVO tutor is a specialist with a personality. They share what they learn about your child so every session picks up exactly where the last one left off."
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Tutors", href: "/tutors" },
      ]}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {TUTORS.map((tutor) => (
          <Link
            key={tutor.name}
            href={`/tutors/${tutor.name.toLowerCase()}`}
            className="group rounded-3xl border border-slate-100 bg-white p-6 hover:border-purple-200 hover:shadow-lg transition flex gap-4"
          >
            <div
              className="w-20 h-20 rounded-2xl shrink-0 overflow-hidden"
              style={{ backgroundColor: `${tutor.color}15` }}
            >
              <Image
                src={tutor.img}
                alt=""
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-slate-900 text-lg group-hover:text-primary transition">
                {tutor.name}
              </h2>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mt-0.5">
                {tutor.domain}
              </p>
              <p className="text-sm text-slate-600 font-body mt-2 leading-relaxed">
                {tutor.tagline}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </LandingPageLayout>
  );
}
