import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildArticleJsonLd } from "@/lib/article-schema";
import { WEB_APP_URL } from "@/lib/constants";
import type { ContentArticle } from "@/lib/content";

interface Props {
  article: ContentArticle;
  backHref: string;
  backLabel: string;
}

export function ArticleView({ article, backHref, backLabel }: Props) {
  // BlogPosting / Article / HowTo + BreadcrumbList, built by a pure helper so
  // the schema shape stays unit-testable and CI-validatable.
  const articleJsonLd = buildArticleJsonLd(article, { backHref, backLabel });

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={articleJsonLd} />

      <header className="sticky top-0 z-50 border-b border-iw-border bg-white">
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
              href={backHref}
              className="hidden min-h-[44px] items-center rounded-lg px-5 py-2 font-semibold text-iw-ink-muted transition hover:text-primary sm:inline-flex"
            >
              {backLabel}
            </Link>
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              className="inline-flex min-h-[44px] items-center rounded-iw-control bg-primary px-5 py-2.5 font-bold text-white shadow-soft-3 transition hover:bg-primary-dark"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-iw-purple-50/40 via-white to-white py-12 md:py-20">
        <div className="mx-auto max-w-3xl px-6 md:px-8">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm font-body text-iw-ink-muted">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <Link href={backHref} className="hover:text-primary">
              {backLabel}
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-iw-ink">{article.title}</span>
          </nav>
          <span
            className="inline-flex items-center gap-2 rounded-iw-chip px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: article.categoryColor }}
          >
            {article.category}
          </span>
          <h1 className="mt-4 font-heading text-3xl font-bold leading-tight text-iw-ink md:text-5xl">
            {article.title}
          </h1>
          <p className="mt-4 max-w-2xl font-body text-lg text-iw-ink-muted">{article.excerpt}</p>
          <p className="mt-4 font-body text-sm text-iw-ink-muted">
            {new Date(article.publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {article.readTime}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 py-12 md:px-8 md:py-16">
        {/* Extractive summary: concise, self-contained claims that answer
            engines preferentially quote. Sits above the article body. */}
        <section
          aria-labelledby="key-takeaways-heading"
          className="mb-12 rounded-iw-card border border-iw-purple-100 bg-iw-purple-100/40 p-6 md:p-7"
        >
          <h2 id="key-takeaways-heading" className="font-heading text-lg font-bold text-iw-ink">
            Key takeaways
          </h2>
          <ul className="mt-3 space-y-2 font-body text-base leading-relaxed text-iw-ink">
            {article.keyTakeaways.map((takeaway, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-iw-primary"
                />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </section>

        <article className="space-y-6 font-body text-lg leading-relaxed text-iw-ink">
          {article.body.map((block, i) => {
            if (block.type === "p") return <p key={i}>{block.text}</p>;
            if (block.type === "h2")
              return (
                <h2 key={i} className="mt-10 font-heading text-2xl font-bold text-iw-ink">
                  {block.text}
                </h2>
              );
            if (block.type === "ul")
              return (
                <ul key={i} className="ml-6 list-disc space-y-2">
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              );
            return null;
          })}
        </article>

        <div className="mt-16 rounded-iw-card-lg border border-iw-purple-100 bg-iw-purple-100/40 p-8">
          <h3 className="font-heading text-xl font-bold text-iw-ink">
            See AIVO for your learner
          </h3>
          <p className="mt-2 font-body text-iw-ink-muted">
            Get a personalized walkthrough, or start a free parent account today.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={`${WEB_APP_URL}/signup?plan=free`}
              className="inline-flex items-center gap-2 rounded-iw-control bg-iw-primary px-6 py-3 font-bold text-white shadow-soft-3 transition hover:bg-iw-primary-hover"
            >
              Start a free account
            </a>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 rounded-iw-control border border-iw-purple-200 bg-white px-6 py-3 font-bold text-iw-primary transition hover:bg-iw-purple-100"
            >
              Request a demo
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-iw-ink py-8">
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
              <Link href="/blog" className="text-sm text-iw-ink-muted transition hover:text-white">
                Blog
              </Link>
              <Link
                href="/resources"
                className="text-sm text-iw-ink-muted transition hover:text-white"
              >
                Resources
              </Link>
              <Link
                href="/privacy-policy"
                className="text-sm text-iw-ink-muted transition hover:text-white"
              >
                Privacy
              </Link>
              <Link href="/security" className="text-sm text-iw-ink-muted transition hover:text-white">
                Security
              </Link>
            </nav>
          </div>
          <p className="font-body text-sm text-iw-ink-muted">
            &copy; {new Date().getFullYear()} AIVO Learning Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
