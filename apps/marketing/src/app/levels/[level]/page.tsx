import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { LEVELS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return LEVELS.map((l) => ({ level: l.slug }));
}

type Props = { params: Promise<{ level: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { level } = await params;
  const lvl = LEVELS.find((l) => l.slug === level);
  if (!lvl) return {};
  const url = `${SITE_URL}/levels/${level}`;
  return {
    title: lvl.metaTitle,
    description: lvl.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: lvl.metaTitle, description: lvl.metaDescription, url, type: "website" },
    twitter: {
      card: "summary_large_image",
      title: lvl.metaTitle,
      description: lvl.metaDescription,
    },
  };
}

export default async function LevelPage({ params }: Props) {
  const { level } = await params;
  const lvl = LEVELS.find((l) => l.slug === level);
  if (!lvl) notFound();

  return (
    <LandingPageLayout
      badge={`Level ${lvl.level}`}
      badgeColor="#7c3aed"
      title={`Level ${lvl.level}: ${lvl.name}`}
      subtitle={lvl.short}
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Levels", href: "/levels" },
        { name: `Level ${lvl.level}`, href: `/levels/${lvl.slug}` },
      ]}
    >
      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-3">Who it's for</h2>
        <p className="text-slate-700 font-body leading-relaxed">{lvl.who}</p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">What's included</h2>
        <ul className="space-y-2">
          {lvl.features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-slate-700 font-body">
              <CheckCircle2
                className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">
          Built-in accommodations
        </h2>
        <ul className="space-y-2">
          {lvl.accommodations.map((a) => (
            <li key={a} className="flex items-start gap-3 text-slate-700 font-body">
              <CheckCircle2
                className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-slate-900 mb-4">Sample activities</h2>
        <ul className="space-y-2">
          {lvl.sample.map((s) => (
            <li key={s} className="flex items-start gap-3 text-slate-700 font-body">
              <span
                className="w-1.5 h-1.5 rounded-full bg-primary mt-2.5 shrink-0"
                aria-hidden="true"
              />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 pt-8 border-t border-slate-100">
        <h2 className="text-xl font-heading font-bold text-slate-900 mb-4">Other levels</h2>
        <div className="flex flex-wrap gap-3">
          {LEVELS.filter((l) => l.slug !== lvl.slug).map((other) => (
            <Link
              key={other.slug}
              href={`/levels/${other.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition"
            >
              Level {other.level}: {other.name}
            </Link>
          ))}
        </div>
      </section>
    </LandingPageLayout>
  );
}
