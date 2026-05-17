import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SUBJECTS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";

const URL = `${SITE_URL}/subjects`;

export const metadata: Metadata = {
  title: "AIVO Subjects – Personalized AI Tutoring Across Every Core Subject",
  description:
    "Math, reading, science, writing, speech, world languages and more. Each AIVO subject has a dedicated AI tutor that adapts to your child's level and accommodations.",
  alternates: { canonical: URL },
  openGraph: {
    title: "AIVO Subjects – Personalized AI Tutoring",
    description:
      "Adaptive math, reading, science, writing, speech, and world-languages tutors that work as one team.",
    url: URL,
    type: "website",
  },
};

export default function SubjectsIndex() {
  return (
    <LandingPageLayout
      badge="Subjects"
      badgeColor="#0891b2"
      title="One tutor per subject. One Brain Clone for your child."
      subtitle="AIVO covers every core academic subject — and the often-neglected ones like speech, social-emotional learning, and life skills — with specialist AI tutors that share what they learn."
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Subjects", href: "/subjects" },
      ]}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {SUBJECTS.map((s) => (
          <Link
            key={s.slug}
            href={`/subjects/${s.slug}`}
            className="block rounded-3xl border border-slate-100 bg-white p-6 hover:border-purple-200 hover:shadow-lg transition"
          >
            <div className="flex items-start gap-4">
              <span className="inline-flex w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 items-center justify-center font-heading font-bold text-lg shrink-0">
                {s.tutorName[0]}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading font-bold text-slate-900 text-lg">{s.name}</h2>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mt-0.5">
                  Tutor: {s.tutorName}
                </p>
                <p className="text-sm text-slate-600 font-body mt-2 leading-relaxed">{s.short}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-300 shrink-0 mt-2" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </LandingPageLayout>
  );
}
