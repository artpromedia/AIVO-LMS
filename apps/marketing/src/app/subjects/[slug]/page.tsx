import { MARKETING_ACCENTS } from "@aivo/brand";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SUBJECTS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return SUBJECTS.map((s) => ({ slug: s.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const subject = SUBJECTS.find((s) => s.slug === slug);
  if (!subject) return {};
  const url = `${SITE_URL}/subjects/${slug}`;
  return {
    title: subject.metaTitle,
    description: subject.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: subject.metaTitle,
      description: subject.metaDescription,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: subject.metaTitle,
      description: subject.metaDescription,
    },
  };
}

export default async function SubjectPage({ params }: Props) {
  const { slug } = await params;
  const subject = SUBJECTS.find((s) => s.slug === slug);
  if (!subject) notFound();
  const t = await getTranslations("marketing.page_subjects_detail");

  return (
    <LandingPageLayout
      badge={subject.name}
      badgeColor={MARKETING_ACCENTS.cyanDeep}
      title={`AI ${subject.name} tutoring with ${subject.tutorName}`}
      subtitle={subject.short}
      breadcrumbs={[
        { name: "Home", href: "/" },
        { name: "Subjects", href: "/subjects" },
        { name: subject.name, href: `/subjects/${subject.slug}` },
      ]}
    >
      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-iw-ink mb-3">
          What {subject.tutorName} does
        </h2>
        <p className="text-iw-ink font-body leading-relaxed">{subject.what}</p>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-iw-ink mb-4">{t("key_features")}</h2>
        <ul className="space-y-2">
          {subject.features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-iw-ink font-body">
              <CheckCircle2
                className="w-5 h-5 text-iw-success mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-heading font-bold text-iw-ink mb-4">
          {t("topics_covered")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {subject.topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center px-3 py-1.5 rounded-iw-chip bg-iw-raised text-iw-ink text-sm font-body"
            >
              {topic}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-14 pt-8 border-t border-iw-border">
        <h2 className="text-xl font-heading font-bold text-iw-ink mb-4">
          {t("other_subjects")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {SUBJECTS.filter((s) => s.slug !== subject.slug).map((other) => (
            <Link
              key={other.slug}
              href={`/subjects/${other.slug}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-iw-chip bg-iw-raised text-iw-ink font-bold text-sm hover:bg-iw-border transition"
            >
              {other.name}
            </Link>
          ))}
        </div>
      </section>
    </LandingPageLayout>
  );
}
