import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { WaitlistForm } from "@/components/marketing/forms";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Join the AIVO waitlist",
  description:
    "Save your spot for AIVO Learning. We'll email you as new family spots open — no spam, no sharing.",
  alternates: { canonical: `${SITE_URL}/waitlist` },
};

export default async function WaitlistPage() {
  const t = await getTranslations("marketing.page_waitlist");
  return (
    <LandingPageLayout
      badge="Waitlist"
      title={t("page_title")}
      subtitle="AIVO opens to new families in small batches so every learner gets a real onboarding. Drop your email and we'll let you know when it's your turn."
      breadcrumbs={[{ name: "Waitlist", href: "/waitlist" }]}
      finalCta={{
        title: "Looking for schools or districts?",
        body: "Schools and districts don't wait — request a demo and we'll scope a pilot.",
        primary: { label: "Request a demo", href: "/demo" },
        secondary: { label: "For schools", href: "/for-schools" },
      }}
    >
      <section
        aria-labelledby="waitlist-form-heading"
        className="rounded-iw-card-lg border border-iw-border bg-white p-6 shadow-soft-1 md:p-8"
      >
        <h2 id="waitlist-form-heading" className="font-heading text-2xl font-bold text-iw-ink">
          {t("form_heading")}
        </h2>
        <p className="mt-1 mb-6 font-body text-iw-ink-muted">{t("form_subheading")}</p>
        <WaitlistForm />
      </section>

      <section
        aria-labelledby="waitlist-promise-heading"
        className="mt-10 rounded-iw-card-lg border border-iw-border bg-iw-raised/60 p-6 md:p-8"
      >
        <h2 id="waitlist-promise-heading" className="font-heading text-xl font-bold text-iw-ink">
          {t("promise_heading")}
        </h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <li className="rounded-iw-card border border-iw-border bg-white p-5">
            <span className="font-heading text-sm font-bold text-iw-success-strong">
              {t("promise_no_spam_title")}
            </span>
            <p className="mt-1 font-body text-iw-ink">{t("promise_no_spam_body")}</p>
          </li>
          <li className="rounded-iw-card border border-iw-border bg-white p-5">
            <span className="font-heading text-sm font-bold text-iw-success-strong">
              {t("promise_no_sharing_title")}
            </span>
            <p className="mt-1 font-body text-iw-ink">{t("promise_no_sharing_body")}</p>
          </li>
          <li className="rounded-iw-card border border-iw-border bg-white p-5">
            <span className="font-heading text-sm font-bold text-iw-success-strong">
              {t("promise_easy_out_title")}
            </span>
            <p className="mt-1 font-body text-iw-ink">{t("promise_easy_out_body")}</p>
          </li>
        </ul>
      </section>
    </LandingPageLayout>
  );
}
