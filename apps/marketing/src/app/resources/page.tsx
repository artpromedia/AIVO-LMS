import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WEB_APP_URL, SITE_URL } from "@/lib/constants";
import { getAllArticles } from "@/lib/content";

export const metadata: Metadata = {
  title: "Resources — AIVO Learning",
  description:
    "Parent guides, school implementation checklists, accessibility explainers, and privacy primers for AIVO Learning.",
  alternates: { canonical: `${SITE_URL}/resources` },
};

export default function ResourcesPage() {
  const all = getAllArticles();
  const guides = all.filter((a) => a.kind === "guide");
  const blog = all.filter((a) => a.kind === "blog");

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
              href="/blog"
              className="hidden min-h-[44px] items-center rounded-lg px-5 py-2 font-semibold text-slate-600 transition hover:text-primary sm:inline-flex"
            >
              Blog
            </Link>
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 py-2.5 font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-primary-dark"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-purple-50/40 via-white to-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6 md:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1 text-sm font-bold text-purple-700">
            Resources
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Guides, primers, and reading paths
          </h1>
          <p className="mt-3 max-w-2xl font-body text-lg text-slate-500">
            Plain-language reference material for parents, teachers, and school leaders.
            Procurement-friendly where it needs to be.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-16 px-6 py-12 md:px-8 md:py-16">
        <section aria-labelledby="guides-heading">
          <h2 id="guides-heading" className="font-heading text-2xl font-bold text-slate-900">
            Guides
          </h2>
          <p className="mt-1 font-body text-slate-600">
            Longer-form practical guides for schools, districts, and procurement teams.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {guides.map((g) => (
              <Link
                key={g.slug}
                href={`/guides/${g.slug}`}
                className="group block rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-purple-200 hover:shadow-lg md:p-8"
              >
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: g.categoryColor }}
                >
                  {g.category}
                </span>
                <h3 className="mt-4 font-heading text-xl font-bold text-slate-900 group-hover:text-purple-700">
                  {g.title}
                </h3>
                <p className="mt-2 font-body text-slate-600">{g.excerpt}</p>
                <p className="mt-3 font-body text-sm text-slate-400">{g.readTime}</p>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="blog-heading">
          <h2 id="blog-heading" className="font-heading text-2xl font-bold text-slate-900">
            From the blog
          </h2>
          <p className="mt-1 font-body text-slate-600">
            Short articles on how the learning loop actually works.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {blog.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group block rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-purple-200 hover:shadow-lg md:p-8"
              >
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white"
                  style={{ backgroundColor: p.categoryColor }}
                >
                  {p.category}
                </span>
                <h3 className="mt-4 font-heading text-xl font-bold text-slate-900 group-hover:text-purple-700">
                  {p.title}
                </h3>
                <p className="mt-2 font-body text-slate-600">{p.excerpt}</p>
                <p className="mt-3 font-body text-sm text-slate-400">{p.readTime}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-slate-900 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-8">
          <Image
            src="/images/aivo-logo-white.png"
            alt="AIVO"
            width={100}
            height={30}
            style={{ width: "auto", height: "auto" }}
          />
          <p className="font-body text-sm text-slate-500">
            &copy; {new Date().getFullYear()} AIVO Learning Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
