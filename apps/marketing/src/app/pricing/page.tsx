import type { Metadata } from "next";
import Link from "next/link";
import { LandingPageLayout } from "@/components/marketing/LandingPageLayout";
import { SITE_URL, WEB_APP_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing — AIVO Learning",
  description:
    "Simple, honest pricing for families, schools, and districts. Free to start. Family plan from $19.99 per learner. Schools and districts: request a quote.",
  alternates: { canonical: `${SITE_URL}/pricing` },
};

type Plan = {
  key: string;
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlight?: boolean;
  badge?: string;
};

const FAMILY_PLANS: Plan[] = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Try AIVO with one learner. No card required.",
    features: [
      "1 learner profile",
      "Today's Mission (limited)",
      "Sample LessonRun lessons",
      "Parent visibility dashboard",
    ],
    cta: { label: "Start free", href: `${WEB_APP_URL}/signup?plan=free` },
  },
  {
    key: "single",
    name: "Single Learner",
    price: "$24.99",
    cadence: "per month",
    description: "Full AIVO for one learner.",
    features: [
      "1 learner profile",
      "All 14 AI tutors",
      "Unlimited LessonRun lessons",
      "Homework Helper (anti-answer-dump)",
      "Sensory adaptations & 5 functioning levels",
      "Parent dashboard + weekly summary",
    ],
    cta: { label: "Choose Single", href: `${WEB_APP_URL}/signup?plan=single` },
  },
  {
    key: "family",
    name: "Family",
    price: "$19.99",
    cadence: "per learner / month",
    description: "Best value for households with two or more learners.",
    features: [
      "Up to 6 learner profiles",
      "All 14 AI tutors per learner",
      "Unlimited LessonRun lessons",
      "Homework Helper across learners",
      "Sensory adaptations & 5 functioning levels",
      "Parent dashboard with per-learner views",
      "Sibling-aware scheduling in Today's Mission",
    ],
    cta: { label: "Choose Family", href: `${WEB_APP_URL}/signup?plan=family` },
    highlight: true,
    badge: "Most popular",
  },
];

const INSTITUTIONAL = [
  {
    key: "school",
    name: "School",
    description: "For a single school or after-school program rolling AIVO out across classrooms.",
    features: [
      "Roster sync (Google Classroom, Clever, ClassLink, Canvas)",
      "Teacher accounts with class-level visibility",
      "Special education program support",
      "SOC 2-aligned admin controls",
      "Onboarding for staff & families",
    ],
    cta: { label: "Request a school quote", href: "/demo" },
  },
  {
    key: "district",
    name: "District",
    description: "For multi-school districts standardizing on AIVO across grades and programs.",
    features: [
      "All School-tier features",
      "District admin console + cross-school reporting",
      "Custom rollout plan and dedicated success contact",
      "DPA / data-sharing agreement on request",
      "Optional research collaboration",
    ],
    cta: { label: "Request a district quote", href: "/demo" },
  },
];

const FAQ = [
  {
    q: "Are these the final prices?",
    a: "Family prices above are current. School and District pricing depends on learner counts and rollout scope — we send a written quote within one business day of a demo.",
  },
  {
    q: "Is there a trial or money-back guarantee?",
    a: "Yes. Family plans include a 30-day money-back guarantee on paid subscriptions. Schools and districts run a scoped pilot before annual commitment.",
  },
  {
    q: "What if my child only uses AIVO sometimes?",
    a: "Family plans are month-to-month. Pause or cancel any time from your account — your learner's progress is saved if you come back.",
  },
  {
    q: "Do you charge per tutor or per subject?",
    a: "No. Every paid plan includes all 14 tutors and every subject. We don't gate features by paywalled add-ons.",
  },
];

export default function PricingPage() {
  return (
    <LandingPageLayout
      badge="Pricing"
      title="Honest pricing. No surprises."
      subtitle="Free to start. Family plans by the month. Schools and districts get a written quote — never a black-box invoice."
      breadcrumbs={[{ name: "Pricing", href: "/pricing" }]}
      finalCta={{
        title: "Still deciding?",
        body: "Read about how AIVO works day to day before you sign up.",
        primary: { label: "How it works", href: "/features/todays-mission" },
        secondary: { label: "Contact us", href: "/contact" },
      }}
    >
      <section aria-labelledby="family-pricing-heading">
        <h2 id="family-pricing-heading" className="font-heading text-2xl font-bold text-slate-900">
          For families
        </h2>
        <p className="mt-1 font-body text-slate-600">
          Month-to-month. Cancel any time. 30-day money-back guarantee on paid plans.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          {FAMILY_PLANS.map((p) => (
            <article
              key={p.key}
              className={`relative flex flex-col rounded-3xl border p-6 shadow-sm ${
                p.highlight ? "border-purple-300 bg-gradient-to-b from-purple-50 to-white" : "border-slate-200 bg-white"
              }`}
            >
              {p.badge ? (
                <span className="absolute -top-3 left-6 rounded-full bg-purple-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {p.badge}
                </span>
              ) : null}
              <h3 className="font-heading text-xl font-bold text-slate-900">{p.name}</h3>
              <p className="mt-1 font-body text-sm text-slate-600">{p.description}</p>
              <div className="mt-4">
                <span className="font-heading text-3xl font-bold text-slate-900">{p.price}</span>
                {p.cadence ? <span className="ml-1 text-sm text-slate-500">{p.cadence}</span> : null}
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm font-body text-slate-700">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.cta.href}
                className={`mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 font-bold transition ${
                  p.highlight
                    ? "bg-gradient-to-r from-primary to-purple-600 text-white shadow-sm hover:from-primary-dark hover:to-purple-700"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {p.cta.label}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="institutional-heading" className="mt-14">
        <h2 id="institutional-heading" className="font-heading text-2xl font-bold text-slate-900">
          For schools and districts
        </h2>
        <p className="mt-1 font-body text-slate-600">
          Annual pricing scales with learner count and program scope. We send a written quote — not a black-box invoice.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {INSTITUTIONAL.map((p) => (
            <article key={p.key} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-heading text-xl font-bold text-slate-900">{p.name}</h3>
              <p className="mt-1 font-body text-sm text-slate-600">{p.description}</p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm font-body text-slate-700">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.cta.href}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:from-primary-dark hover:to-purple-700"
              >
                {p.cta.label}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="pricing-faq-heading" className="mt-14">
        <h2 id="pricing-faq-heading" className="font-heading text-2xl font-bold text-slate-900">
          Pricing FAQ
        </h2>
        <dl className="mt-5 space-y-4">
          {FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
              <dt className="font-heading text-base font-bold text-slate-900">{item.q}</dt>
              <dd className="mt-1 font-body text-slate-700">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </LandingPageLayout>
  );
}
