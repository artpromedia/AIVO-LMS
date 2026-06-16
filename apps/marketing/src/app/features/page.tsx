import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SITE_URL } from "@/lib/constants";

const FEATURES = [
  {
    slug: "todays-mission",
    title: "Today's Mission",
    description:
      "One adaptive next-best lesson, picked daily from a learner's mastery, prerequisites, parent goals, and teacher assignments — never a tile grid of decisions to make.",
  },
  {
    slug: "lessonrun",
    title: "LessonRun",
    description:
      "Intro → guided practice → checks for understanding → reflection → mastery event. Resumable, auditable, and pinned to a frozen brain-profile snapshot so retries don't drift.",
  },
  {
    slug: "homework-helper",
    title: "Homework Helper",
    description:
      "Walks learners through a problem step by step with clarifying questions and scaffolded hints. It never reveals a final answer up front — it teaches.",
  },
] as const;

export const metadata: Metadata = {
  title: "AIVO features",
  description:
    "AIVO is more than a quiz app. Explore Today's Mission, LessonRun, and Homework Helper — each designed around the learner's brain profile, IEP, and pace.",
  alternates: { canonical: `${SITE_URL}/features` },
};

export default async function FeaturesPage() {
  const t = await getTranslations("marketing.page_features");
  return (
    <main id="main" className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-aivo-purple">{t("eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-bold">{t("heading")}</h1>
      <p className="mt-3 text-aivo-ink-soft">
        AIVO is built around three flows learners use every day. Each one is adaptive, accessible,
        and grounded in the learner's IEP and brain profile.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li
            key={f.slug}
            className="rounded-iw-card border border-aivo-border bg-white p-6 shadow-soft-1 transition hover:shadow-soft-3"
          >
            <Link
              href={`/features/${f.slug}`}
              className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aivo-purple"
            >
              <h2 className="font-display text-xl font-semibold text-aivo-ink">{f.title}</h2>
              <p className="mt-2 text-sm text-aivo-ink-soft">{f.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-aivo-purple">
                {t("learn_more")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
