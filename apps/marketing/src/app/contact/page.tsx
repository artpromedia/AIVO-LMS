import type { Metadata } from "next";
import { MARKETING_ACCENTS } from "@aivo/brand";
import { getTranslations } from "next-intl/server";
import { CompanyPageLayout } from "@/components/marketing/legal/CompanyPageLayout";
import { ContactForm } from "@/components/marketing/forms";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact AIVO Learning",
  description:
    "Questions about AIVO? Send us a note and the right team — support, privacy, press, or partnerships — will reply within one business day.",
  alternates: { canonical: `${SITE_URL}/contact` },
};

const CONTACTS = [
  {
    icon: "📧",
    title: "General Inquiries",
    description: "Questions about AIVO Learning? We'd love to hear from you.",
    email: "hello@aivolearning.com",
    color: MARKETING_ACCENTS.purple,
  },
  {
    icon: "🛡️",
    title: "Privacy & Data",
    description: "Questions about data privacy, COPPA, FERPA, or student records.",
    email: "privacy@aivolearning.com",
    color: MARKETING_ACCENTS.emeraldDeep,
  },
  {
    icon: "🎯",
    title: "Customer Support",
    description: "Need help with your AIVO account or a technical issue?",
    email: "support@aivolearning.com",
    color: MARKETING_ACCENTS.amberDeep,
  },
  {
    icon: "📰",
    title: "Press & Media",
    description: "Media inquiries, press releases, and partnership opportunities.",
    email: "press@aivolearning.com",
    color: MARKETING_ACCENTS.pink,
  },
];

export default async function ContactPage() {
  const t = await getTranslations("marketing.page_contact");
  return (
    <CompanyPageLayout
      badge="Contact"
      title={t("page_title")}
      subtitle="Pick the right inbox or send us a message — we typically reply within one business day."
      icon="💬"
      accentColor={MARKETING_ACCENTS.purple}
      breadcrumbSlug="contact"
      breadcrumbLabel="Contact"
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
        <section
          aria-labelledby="contact-form-heading"
          className="rounded-iw-card-lg border border-iw-border bg-white p-6 shadow-soft-1 md:p-8"
        >
          <h2 id="contact-form-heading" className="font-heading text-2xl font-bold text-iw-ink">
            {t("form_heading")}
          </h2>
          <p className="mt-1 mb-6 font-body text-iw-ink-muted">{t("form_subheading")}</p>
          <ContactForm />
        </section>

        <aside aria-labelledby="contact-inboxes-heading" className="space-y-4">
          <h2
            id="contact-inboxes-heading"
            className="font-heading text-2xl font-bold text-iw-ink"
          >
            {t("inboxes_heading")}
          </h2>
          {CONTACTS.map((c) => (
            <a
              key={c.email}
              href={`mailto:${c.email}`}
              className="block rounded-iw-card border border-iw-border bg-white p-5 transition hover:border-iw-border hover:shadow-soft-1"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-iw-control text-xl"
                  style={{ backgroundColor: `${c.color}15`, color: c.color }}
                  aria-hidden="true"
                >
                  {c.icon}
                </div>
                <div>
                  <h3 className="font-heading font-bold text-iw-ink">{c.title}</h3>
                  <p className="mt-1 text-sm font-body text-iw-ink-muted">{c.description}</p>
                  <p className="mt-2 text-sm font-bold" style={{ color: c.color }}>
                    {c.email}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </aside>
      </div>
    </CompanyPageLayout>
  );
}
