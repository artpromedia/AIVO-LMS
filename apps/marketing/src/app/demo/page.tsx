import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { DemoRequestForm } from "@/components/marketing/forms";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Request a demo — AIVO Learning",
  description:
    "See AIVO in action with a walkthrough tailored to your role and rollout goals. A member of our team will reach out within one business day.",
  alternates: { canonical: `${SITE_URL}/demo` },
};

export default async function DemoPage() {
  const t = await getTranslations("marketing.page_demo");
  return (
    <LandingPageLayout
      badge="Demo"
      title={t("hero_title")}
      subtitle="A 30-minute walkthrough tailored to your role — teacher, special education lead, principal, or district. We'll show you Today's Mission, LessonRun, the parent view, and how rostering works."
      breadcrumbs={[{ name: "Demo", href: "/demo" }]}
      finalCta={{
        title: "Not ready for a demo?",
        body: "Read about how AIVO works for schools, or join the waitlist as a family.",
        primary: { label: "For schools", href: "/for-schools" },
        secondary: { label: "Join the waitlist", href: "/waitlist" },
      }}
    >
      <section
        aria-labelledby="demo-form-heading"
        className="rounded-iw-card-lg border border-iw-border bg-white p-6 shadow-soft-1 md:p-8"
      >
        <h2 id="demo-form-heading" className="font-heading text-2xl font-bold text-iw-ink">
          {t("form_heading")}
        </h2>
        <p className="mt-1 mb-6 font-body text-iw-ink-muted">{t("form_subheading")}</p>
        <DemoRequestForm />
      </section>

      <section
        aria-labelledby="demo-what-happens-heading"
        className="mt-10 rounded-iw-card-lg border border-iw-border bg-iw-raised/60 p-6 md:p-8"
      >
        <h2
          id="demo-what-happens-heading"
          className="font-heading text-xl font-bold text-iw-ink"
        >
          {t("what_happens_next")}
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <li className="rounded-iw-card border border-iw-border bg-white p-5">
            <span className="font-heading text-sm font-bold text-iw-primary">
              {t("step1_label")}
            </span>
            <p className="mt-1 font-body text-iw-ink">
              A team member emails to confirm your goals and pick a time.
            </p>
          </li>
          <li className="rounded-iw-card border border-iw-border bg-white p-5">
            <span className="font-heading text-sm font-bold text-iw-primary">
              {t("step2_label")}
            </span>
            <p className="mt-1 font-body text-iw-ink">{t("step2_body")}</p>
          </li>
          <li className="rounded-iw-card border border-iw-border bg-white p-5">
            <span className="font-heading text-sm font-bold text-iw-primary">
              {t("step3_label")}
            </span>
            <p className="mt-1 font-body text-iw-ink">{t("step3_body")}</p>
          </li>
        </ol>
      </section>
    </LandingPageLayout>
  );
}
