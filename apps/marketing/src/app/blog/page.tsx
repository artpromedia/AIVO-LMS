import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WEB_APP_URL, SITE_URL } from "@/lib/constants";
import { getArticlesByKind } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blog — AIVO Learning",
  description: "Plain-language articles on personalized learning, parent progress, baseline assessments, and accessibility supports.",
  alternates: { canonical: `${SITE_URL}/blog` },
};

export default function BlogIndexPage() {
  const posts = getArticlesByKind("blog");
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={130} height={40} priority style={{ width: "auto", height: "auto" }} />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link href="/resources" className="hidden min-h-[44px] items-center rounded-lg px-5 py-2 font-semibold text-slate-600 transition hover:text-primary sm:inline-flex">
              Resources
            </Link>
            <a href={`${WEB_APP_URL}/signup?plan=free`} className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 py-2.5 font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-primary-dark">
              Get Started
            </a>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-purple-50/40 via-white to-white py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6 md:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1 text-sm font-bold text-purple-700">
            Blog
          </span>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight text-slate-900 md:text-5xl">
            Notes from the AIVO team
          </h1>
          <p className="mt-3 max-w-2xl font-body text-lg text-slate-500">
            Short, honest writing about how personalized learning actually works — for parents, teachers, and school leaders.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-12 md:px-8 md:py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group block rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-purple-200 hover:shadow-lg md:p-8"
            >
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: p.categoryColor }}>
                {p.category}
              </span>
              <h2 className="mt-4 font-heading text-xl font-bold text-slate-900 group-hover:text-purple-700 md:text-2xl">{p.title}</h2>
              <p className="mt-3 font-body text-slate-600">{p.excerpt}</p>
              <p className="mt-4 font-body text-sm text-slate-400">
                {new Date(p.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · {p.readTime}
              </p>
            </Link>
          ))}
        </div>
      </main>

      <footer className="bg-slate-900 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-8">
          <Image src="/images/aivo-logo-white.png" alt="AIVO" width={100} height={30} style={{ width: "auto", height: "auto" }} />
          <p className="font-body text-sm text-slate-500">&copy; {new Date().getFullYear()} AIVO Learning Platform</p>
        </div>
      </footer>
    </div>
  );
}
