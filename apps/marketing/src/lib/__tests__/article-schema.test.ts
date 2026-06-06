import { describe, it, expect } from "vitest";
import { CONTENT, getArticlesByKind } from "@/lib/content";
import { buildArticleJsonLd, articleCanonicalUrl } from "@/lib/article-schema";

const opts = (kind: string) =>
  kind === "guide"
    ? { backHref: "/guides", backLabel: "Guides" }
    : { backHref: "/blog", backLabel: "Blog" };

describe("content invariants", () => {
  it("every article ships 3-5 key takeaways", () => {
    for (const a of CONTENT) {
      expect(a.keyTakeaways.length, a.slug).toBeGreaterThanOrEqual(3);
      expect(a.keyTakeaways.length, a.slug).toBeLessThanOrEqual(5);
      for (const t of a.keyTakeaways) expect(t.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("buildArticleJsonLd", () => {
  it("emits BlogPosting with non-null author + datePublished for every blog post", () => {
    for (const a of getArticlesByKind("blog")) {
      const [primary] = buildArticleJsonLd(a, opts(a.kind));
      expect(primary["@type"]).toBe("BlogPosting");
      expect((primary.author as { name: string }).name).toBeTruthy();
      expect(primary.datePublished).toBe(a.publishedAt);
      expect(primary.dateModified).toBeTruthy();
      expect(primary.publisher).toBeTruthy();
      expect(primary.image).toBeTruthy();
      expect(primary.mainEntityOfPage).toBe(articleCanonicalUrl(a));
    }
  });

  it("emits HowTo for procedural guides and Article otherwise", () => {
    for (const a of getArticlesByKind("guide")) {
      const [primary] = buildArticleJsonLd(a, opts(a.kind));
      if (a.howTo) {
        expect(primary["@type"]).toBe("HowTo");
        const steps = primary.step as Array<{ name: string; text: string; position: number }>;
        expect(steps.length).toBe(a.howTo.steps.length);
        steps.forEach((s, i) => {
          expect(s["@type" as keyof typeof s]).toBe("HowToStep");
          expect(s.position).toBe(i + 1);
          expect(s.name).toBeTruthy();
          expect(s.text).toBeTruthy();
        });
      } else {
        expect(primary["@type"]).toBe("Article");
      }
    }
  });

  it("emits a 3-item BreadcrumbList ending at the canonical URL", () => {
    for (const a of CONTENT) {
      const [, breadcrumb] = buildArticleJsonLd(a, opts(a.kind));
      const items = breadcrumb.itemListElement as Array<{ position: number; item: string }>;
      expect(items).toHaveLength(3);
      expect(items[0].position).toBe(1);
      expect(items[2].item).toBe(articleCanonicalUrl(a));
    }
  });

  it("includes at least one procedural guide (HowTo coverage)", () => {
    expect(getArticlesByKind("guide").some((g) => g.howTo)).toBe(true);
  });
});
