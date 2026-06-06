/**
 * Renders one or more JSON-LD structured-data blocks as
 * `<script type="application/ld+json">`.
 *
 * Centralises the pattern that was hand-rolled inline across the marketing
 * pages (layout, AudiencePage, PageFAQ, FAQ, ArticleView, LandingPageLayout)
 * so every page emits schema the same way. Pure markup with no hooks, so it
 * works in both server and client components. Output is byte-for-byte the
 * same as the previous inline scripts (`JSON.stringify(data)`).
 */

// JSON-LD is an open vocabulary; we keep the prop loosely typed but require
// the schema.org context/type discriminators callers always set.
export type JsonLdObject = {
  "@context"?: string;
  "@type": string | string[];
  [key: string]: unknown;
};

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
