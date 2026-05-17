import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { TUTORS } from "@/components/marketing/data";
import { SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return TUTORS.map((t) => ({ slug: t.name.toLowerCase() }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tutor = TUTORS.find((t) => t.name.toLowerCase() === slug);
  if (!tutor) return {};
  const url = `${SITE_URL}/tutors/${slug}`;
  const title = `${tutor.name} – AI ${tutor.domain} Tutor for Kids | AIVO`;
  const description = `${tutor.name} is AIVO's AI tutor for ${tutor.domain.toLowerCase()}. ${tutor.tagline} Adaptive, IEP-aware, and built for every learner.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TutorPage({ params }: Props) {
  const { slug } = await params;
  const tutor = TUTORS.find((t) => t.name.toLowerCase() === slug);
  if (!tutor) notFound();

  return (
    <LandingPageLayout
      badge={tutor.domain}
      badgeColor={tutor.color}
      title={`Meet ${tutor.name}, your AI ${tutor.domain.toLowerCase()} tutor`}
      subtitle={tutor.tagline}
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Tutors", href: "/tutors" },
        { name: tutor.name, href: `/tutors/${slug}` },
      ]}
    >
      <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
        <div
          className="w-40 h-40 rounded-3xl overflow-hidden shrink-0 mx-auto md:mx-0"
          style={{ backgroundColor: `${tutor.color}15` }}
        >
          <Image
            src={tutor.img}
            alt={`${tutor.name} – AIVO ${tutor.domain} tutor`}
            width={160}
            height={160}
            className="w-full h-full object-cover"
            priority
          />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-slate-900 mb-3">
            How {tutor.name} teaches
          </h2>
          <ul className="space-y-2 mb-6">
            {tutor.bullets.map((b) => (
              <li key={b} className="flex items-start gap-3 text-slate-700 font-body">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p className="text-slate-600 font-body leading-relaxed">
            {tutor.name} works alongside the other 13 AIVO tutors and your child's Brain Clone — sharing context across every session so {tutor.name} always picks up where the last lesson left off.
          </p>
        </div>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">
          Built for every learner
        </h2>
        <p className="text-slate-600 font-body leading-relaxed">
          {tutor.name} adapts across all 5 functioning levels — from grade-aligned content for Standard learners to AAC- and switch-accessible interactions for Exploratory and Pre-Symbolic learners. Sensory profiles, reduced visual clutter, and optional partner-assisted modes are all available.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">
          Other AIVO tutors
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TUTORS.filter((t) => t.name !== tutor.name).slice(0, 6).map((t) => (
            <Link
              key={t.name}
              href={`/tutors/${t.name.toLowerCase()}`}
              className="rounded-2xl border border-slate-100 bg-white p-3 flex items-center gap-3 hover:border-purple-200 hover:shadow-md transition"
            >
              <div
                className="w-10 h-10 rounded-xl shrink-0 overflow-hidden"
                style={{ backgroundColor: `${t.color}15` }}
              >
                <Image src={t.img} alt="" width={40} height={40} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-bold text-slate-900 text-sm truncate">{t.name}</p>
                <p className="text-xs text-slate-500 truncate">{t.domain}</p>
              </div>
            </Link>
          ))}
        </div>
        <Link
          href="/tutors"
          className="inline-block mt-4 text-primary font-bold hover:underline"
        >
          See all 14 tutors →
        </Link>
      </section>
    </LandingPageLayout>
  );
}
