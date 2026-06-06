/**
 * Pure builders for the structured data emitted by blog posts and guides.
 *
 * Kept out of the React component so the schema shape is unit-testable and so
 * the Sprint 3 CI validator can reason about required types/fields:
 *   - blog posts          → BlogPosting
 *   - non-procedural guide → Article
 *   - procedural guide     → HowTo (with ordered HowToStep[])
 * Every type carries non-null author + datePublished + publisher + image so
 * generative engines can attribute and cite AIVO by name.
 */
import { SITE_URL } from "@/lib/constants";
import type { JsonLdObject } from "@/components/seo/JsonLd";
import type { ContentArticle } from "@/lib/content";

const LOGO_URL = `${SITE_URL}/images/aivo-logo-purple.png`;

export function articleCanonicalUrl(article: ContentArticle): string {
  const routeBase = article.kind === "guide" ? "guides" : "blog";
  return `${SITE_URL}/${routeBase}/${article.slug}`;
}

/**
 * Returns the [primary, breadcrumb] JSON-LD blocks for an article page.
 * `backHref`/`backLabel` describe the parent listing (e.g. /blog · "Blog").
 */
export function buildArticleJsonLd(
  article: ContentArticle,
  { backHref, backLabel }: { backHref: string; backLabel: string },
): [JsonLdObject, JsonLdObject] {
  const canonicalUrl = articleCanonicalUrl(article);
  const dateModified = article.updatedAt ?? article.publishedAt;
  const author = { "@type": "Organization", name: article.author, url: SITE_URL };
  const publisher = {
    "@type": "Organization",
    name: "AIVO Learning",
    logo: { "@type": "ImageObject", url: LOGO_URL },
  };

  const primary: JsonLdObject = article.howTo
    ? {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: article.howTo.name ?? article.title,
        description: article.excerpt,
        image: LOGO_URL,
        datePublished: article.publishedAt,
        dateModified,
        author,
        publisher,
        mainEntityOfPage: canonicalUrl,
        step: article.howTo.steps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      }
    : {
        "@context": "https://schema.org",
        "@type": article.kind === "blog" ? "BlogPosting" : "Article",
        headline: article.title,
        description: article.excerpt,
        image: LOGO_URL,
        datePublished: article.publishedAt,
        dateModified,
        author,
        publisher,
        mainEntityOfPage: canonicalUrl,
      };

  const breadcrumb: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: backLabel, item: `${SITE_URL}${backHref}` },
      { "@type": "ListItem", position: 3, name: article.title, item: canonicalUrl },
    ],
  };

  return [primary, breadcrumb];
}
