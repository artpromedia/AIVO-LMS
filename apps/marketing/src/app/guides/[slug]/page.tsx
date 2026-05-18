import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/marketing/ArticleView";
import { getArticle, getArticlesByKind } from "@/lib/content";
import { SITE_URL } from "@/lib/constants";

export function generateStaticParams() {
  return getArticlesByKind("guide").map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug, "guide");
  if (!article) return { title: "Not found" };
  return {
    title: `${article.title} — AIVO Guides`,
    description: article.excerpt,
    alternates: { canonical: `${SITE_URL}/guides/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      url: `${SITE_URL}/guides/${article.slug}`,
      publishedTime: article.publishedAt,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug, "guide");
  if (!article) notFound();
  return <ArticleView article={article} backHref="/guides" backLabel="Guides" />;
}
