import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WEB_APP_URL, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Subprocessors — AIVO Learning",
  description:
    "The current list of subprocessors AIVO Learning uses to deliver the platform. Each entry describes purpose, data category, region, and status.",
  alternates: { canonical: `${SITE_URL}/subprocessors` },
};

const LAST_UPDATED = "May 17, 2026";

type Subprocessor = {
  name: string;
  purpose: string;
  dataCategory: string;
  region: string;
  status: "Active" | "Optional" | "Planned";
};

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Hetzner Online GmbH",
    purpose: "Primary hosting and Kubernetes infrastructure",
    dataCategory: "All operational data; encrypted at rest",
    region: "Germany (EU)",
    status: "Active",
  },
  {
    name: "GitHub, Inc. (Microsoft)",
    purpose: "Source code hosting and container registry (GHCR)",
    dataCategory: "No learner data; engineering artifacts only",
    region: "United States",
    status: "Active",
  },
  {
    name: "Postmark (Wildbit, LLC)",
    purpose: "Transactional email delivery (account, security, summary emails)",
    dataCategory: "Email address and transactional message body",
    region: "United States",
    status: "Active",
  },
  {
    name: "Google LLC",
    purpose: "Optional Google OAuth sign-in; Gemini foundation-model inference via gateway",
    dataCategory:
      "Email and account identifiers for OAuth; scrubbed tutor prompts for inference (no learner identifiers)",
    region: "United States",
    status: "Active",
  },
  {
    name: "Anthropic, PBC",
    purpose: "Claude foundation-model inference for tutor responses (primary)",
    dataCategory: "Scrubbed tutor prompts (no learner identifiers); not used for model training",
    region: "United States",
    status: "Active",
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: "GPT foundation-model inference for tutor responses (fallback)",
    dataCategory: "Scrubbed tutor prompts (no learner identifiers); not used for model training",
    region: "United States",
    status: "Active",
  },
  {
    name: "Cloudflare, Inc.",
    purpose: "CDN, DNS, and edge protection for the AIVO marketing site",
    dataCategory: "Request metadata for public marketing surfaces only",
    region: "Global edge (United States headquartered)",
    status: "Active",
  },
];

const STATUS_STYLES: Record<Subprocessor["status"], string> = {
  Active: "bg-emerald-100 text-emerald-800",
  Optional: "bg-sky-100 text-sky-800",
  Planned: "bg-amber-100 text-amber-800",
};

export default async function SubprocessorsPage() {
  const t = await getTranslations("marketing.page_subprocessors");
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-8">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/aivo-logo-purple.png"
              alt="AIVO"
              width={130}
              height={40}
              priority
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link
              href="/"
              className="hidden min-h-[44px] items-center rounded-lg px-5 py-2 font-semibold text-slate-600 transition hover:text-primary sm:inline-flex"
            >
              Home
            </Link>
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--aivo-sensory-primary)] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_-12px_rgba(124,58,237,0.6)] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              {t("get_started")}
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-purple-50/40 via-white to-white py-16 md:py-20">
        <div className="mx-auto max-w-4xl px-6 md:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1 text-sm font-bold text-purple-700">
            <span aria-hidden="true">🔗</span> {t("badge")}
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            {t("heading")}
          </h1>
          <p className="mt-3 max-w-2xl font-body text-lg text-slate-500">
            The companies AIVO uses to deliver the platform. We keep this list short on purpose.
            Updates are reflected here within ten business days of going live.
          </p>
          <p className="mt-4 font-body text-sm text-slate-400">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-12 md:px-8 md:py-16">
        <section aria-labelledby="subprocessors-table-heading">
          <h2
            id="subprocessors-table-heading"
            className="font-heading text-2xl font-bold text-slate-900"
          >
            {t("current_subprocessors")}
          </h2>
          <p className="mt-1 font-body text-slate-600">
            Each row describes what the subprocessor does and what data category it may handle. None
            of our foundation-model subprocessors receive learner identifiers.
          </p>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <caption className="sr-only">
                Current AIVO subprocessors, their purpose, data category handled, region, and
                status.
              </caption>
              <thead className="bg-slate-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    {t("col_subprocessor")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    {t("col_purpose")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    {t("col_data_category")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    {t("col_region")}
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600"
                  >
                    {t("col_status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {SUBPROCESSORS.map((s) => (
                  <tr key={s.name} className="align-top">
                    <th
                      scope="row"
                      className="px-4 py-4 font-heading text-sm font-bold text-slate-900"
                    >
                      {s.name}
                    </th>
                    <td className="px-4 py-4 font-body text-sm text-slate-700">{s.purpose}</td>
                    <td className="px-4 py-4 font-body text-sm text-slate-700">{s.dataCategory}</td>
                    <td className="px-4 py-4 font-body text-sm text-slate-700">{s.region}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[s.status]}`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="how-we-use-heading"
          className="mt-12 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-6 md:p-8"
        >
          <h2 id="how-we-use-heading" className="font-heading text-xl font-bold text-slate-900">
            {t("how_we_use_heading")}
          </h2>
          <p className="font-body text-slate-700">
            Schools and districts can rely on this page for procurement review. If you need a signed
            DPA referencing this subprocessor list, write to compliance@aivolearning.com.
          </p>
          <p className="font-body text-slate-700">
            When we add a new subprocessor, we update this page first. School and district admins
            receive a tenant-level notice in their admin console for changes that affect data
            category or region.
          </p>
        </section>

        <section
          aria-labelledby="changes-heading"
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 md:p-8"
        >
          <h2 id="changes-heading" className="font-heading text-xl font-bold text-slate-900">
            {t("reporting_heading")}
          </h2>
          <p className="mt-2 font-body text-slate-700">
            Subscribe to subprocessor change notifications by writing to{" "}
            <a
              className="font-semibold text-purple-700 underline"
              href="mailto:compliance@aivolearning.com"
            >
              compliance@aivolearning.com
            </a>
            . We send notices at least ten business days before a new subprocessor goes live for any
            tenant.
          </p>
        </section>

        <div className="mt-12 rounded-3xl border border-purple-100 bg-purple-50/40 p-8">
          <h3 className="font-heading text-xl font-bold text-slate-900">
            {t("questions_heading")}
          </h3>
          <p className="mt-2 font-body text-slate-600">
            Contact our compliance team for a signed DPA, subprocessor exhibits, or procurement
            review.
          </p>
          <a
            href="mailto:compliance@aivolearning.com"
            className="group mt-4 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[var(--aivo-sensory-primary)] px-7 text-base font-semibold text-white shadow-[0_18px_40px_-12px_rgba(124,58,237,0.6)] transition hover:-translate-y-0.5 hover:brightness-110"
          >
            compliance@aivolearning.com
          </a>
        </div>
      </main>

      <footer className="bg-slate-900 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-8">
          <div className="flex items-center gap-6">
            <Image
              src="/images/aivo-logo-white.png"
              alt="AIVO"
              width={100}
              height={30}
              style={{ width: "auto", height: "auto" }}
            />
            <nav className="hidden items-center gap-4 md:flex">
              <Link
                href="/privacy-policy"
                className="text-sm text-slate-400 transition hover:text-white"
              >
                {t("footer_privacy")}
              </Link>
              <Link
                href="/terms-of-service"
                className="text-sm text-slate-400 transition hover:text-white"
              >
                Terms
              </Link>
              <Link href="/security" className="text-sm text-slate-400 transition hover:text-white">
                {t("footer_security")}
              </Link>
              <Link href="/trust" className="text-sm text-slate-400 transition hover:text-white">
                Trust
              </Link>
              <Link
                href="/accessibility"
                className="text-sm text-slate-400 transition hover:text-white"
              >
                {t("footer_accessibility")}
              </Link>
            </nav>
          </div>
          <p className="font-body text-sm text-slate-500">
            &copy; {new Date().getFullYear()} AIVO Learning Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
