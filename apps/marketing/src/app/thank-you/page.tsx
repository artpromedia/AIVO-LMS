import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Thank you — AIVO Learning",
  description: "Thanks for reaching out to AIVO. Here's what happens next.",
  alternates: { canonical: `${SITE_URL}/thank-you` },
  robots: { index: false, follow: true },
};

const NEXT_STEPS = [
  {
    title: "Read about how learning works",
    body: "See how Today's Mission, LessonRun, and Homework Helper fit together into a daily rhythm.",
    href: "/features/todays-mission",
    label: "Explore features",
  },
  {
    title: "Meet the tutors",
    body: "Fourteen AI tutors with their own subjects and styles — pick the ones your learner will love.",
    href: "/tutors",
    label: "Meet the tutors",
  },
  {
    title: "See how it adapts",
    body: "AIVO has five functioning levels so the same lesson reaches very different learners.",
    href: "/levels",
    label: "See the levels",
  },
];

export default async function ThankYouPage() {
  const t = await getTranslations("marketing.page_thank_you");
  return (
    <LandingPageLayout
      badge="Thank you"
      title={t("hero_title")}
      subtitle="A real person will read your note and reply soon. While you wait, here are a few things worth a look."
      breadcrumbs={[{ name: "Thank you", href: "/thank-you" }]}
      finalCta={{
        title: "Need to reach us again?",
        body: "If you didn't get a confirmation email within a few minutes, send a quick note and we'll sort it out.",
        primary: { label: "Contact us", href: "/contact" },
        secondary: { label: "Back to home", href: "/" },
      }}
    >
      <section aria-labelledby="next-steps-heading">
        <h2 id="next-steps-heading" className="font-heading text-2xl font-bold text-slate-900">
          {t("while_you_wait")}
        </h2>
        <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {NEXT_STEPS.map((s) => (
            <li
              key={s.href}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="font-heading text-lg font-bold text-slate-900">{s.title}</h3>
              <p className="mt-2 flex-1 font-body text-slate-700">{s.body}</p>
              <Link
                href={s.href}
                className="mt-4 inline-flex w-fit items-center font-bold text-purple-700 hover:text-purple-800"
              >
                {s.label}{" "}
                <span aria-hidden="true" className="ml-1">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </LandingPageLayout>
  );
}
