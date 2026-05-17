import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WEB_APP_URL, SITE_URL } from "@/lib/constants";
import type { ContentArticle } from "@/lib/content";

interface Props {
  article: ContentArticle;
  backHref: string;
  backLabel: string;
}

export function ArticleView({ article, backHref, backLabel }: Props) {
  const routeBase = article.kind === "guide" ? "guides" : "blog";
  const canonicalUrl = `${SITE_URL}/${routeBase}/${article.slug}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: { "@type": "Organization", name: article.author },
    publisher: {
      "@type": "Organization",
      name: "AIVO Learning",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/images/aivo-logo-purple.png` },
    },
    mainEntityOfPage: canonicalUrl,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: backLabel, item: `${SITE_URL}${backHref}` },
      { "@type": "ListItem", position: 3, name: article.title, item: canonicalUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-8">
          <Link href="/" className="flex items-center">
            <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={130} height={40} priority style={{ width: "auto", height: "auto" }} />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <Link href={backHref} className="hidden min-h-[44px] items-center rounded-lg px-5 py-2 font-semibold text-slate-600 transition hover:text-primary sm:inline-flex">
              {backLabel}
            </Link>
            <a href={`${WEB_APP_URL}/signup?plan=free`} className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 py-2.5 font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-primary-dark">
              Get Started
            </a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-purple-50/40 via-white to-white py-12 md:py-20">
        <div className="mx-auto max-w-3xl px-6 md:px-8">
          <nav aria-label="Breadcrumb" className="mb-4 text-sm font-body text-slate-500">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span aria-hidden="true"> / </span>
            <Link href={backHref} className="hover:text-primary">{backLabel}</Link>
            <span aria-hidden="true"> / </span>
            <span className="text-slate-700">{article.title}</span>
          </nav>
          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: article.categoryColor }}>
            {article.category}
          </span>
          <h1 className="mt-4 font-heading text-3xl font-bold leading-tight text-slate-900 md:text-5xl">{article.title}</h1>
          <p className="mt-4 max-w-2xl font-body text-lg text-slate-600">{article.excerpt}</p>
          <p className="mt-4 font-body text-sm text-slate-400">
            {new Date(article.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · {article.readTime}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-6 py-12 md:px-8 md:py-16">
        <article className="space-y-6 font-body text-lg leading-relaxed text-slate-700">
          {article.body.map((block, i) => {
            if (block.type === "p") return <p key={i}>{block.text}</p>;
            if (block.type === "h2") return <h2 key={i} className="mt-10 font-heading text-2xl font-bold text-slate-900">{block.text}</h2>;
            if (block.type === "ul") return (
              <ul key={i} className="ml-6 list-disc space-y-2">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            );
            return null;
          })}
        </article>

        <div className="mt-16 rounded-3xl border border-purple-100 bg-purple-50/40 p-8">
          <h3 className="font-heading text-xl font-bold text-slate-900">See AIVO for your learner</h3>
          <p className="mt-2 font-body text-slate-600">Get a personalized walkthrough, or start a free parent account today.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`${WEB_APP_URL}/signup?plan=free`} className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg transition hover:bg-purple-700">
              Start a free account
            </a>
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white px-6 py-3 font-bold text-purple-700 transition hover:bg-purple-50">
              Request a demo
            </Link>
          </div>
        </div>
      </main>

      <footer className="bg-slate-900 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row md:px-8">
          <div className="flex items-center gap-6">
            <Image src="/images/aivo-logo-white.png" alt="AIVO" width={100} height={30} style={{ width: "auto", height: "auto" }} />
            <nav className="hidden items-center gap-4 md:flex">
              <Link href="/blog" className="text-sm text-slate-400 transition hover:text-white">Blog</Link>
              <Link href="/resources" className="text-sm text-slate-400 transition hover:text-white">Resources</Link>
              <Link href="/privacy-policy" className="text-sm text-slate-400 transition hover:text-white">Privacy</Link>
              <Link href="/security" className="text-sm text-slate-400 transition hover:text-white">Security</Link>
            </nav>
          </div>
          <p className="font-body text-sm text-slate-500">&copy; {new Date().getFullYear()} AIVO Learning Platform</p>
        </div>
      </footer>
    </div>
  );
}
