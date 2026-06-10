/**
 * Content module for marketing claims, research references, and testimonials.
 *
 * Render guards enforce:
 *   - Stats: only rendered when `source` is a non-empty string (URL or DOI).
 *   - Research institutions: only rendered when `source` is non-empty.
 *   - Testimonials: only rendered when `consent === true`.
 *
 * To enable an entry:
 *   - Stats / institutions: set `source` to a URL or DOI for the underlying
 *     study or publication.  Do not invent citations.
 *   - Testimonials: obtain explicit written consent from the named person,
 *     set `consent: true`, and replace placeholder copy with their real words.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A numeric or qualitative statistic displayed on the marketing page. */
export interface Stat {
  readonly id: string;
  /** Display value shown to the visitor (e.g. "+47.2%"). */
  readonly value: string;
  /**
   * URL or citation for the underlying study / data source.
   * MUST be non-empty for the stat to render.  Leave as `""` while
   * documentation is pending — the render logic gates on this field.
   */
  readonly source: string;
  /** Human-readable label for the citation link (e.g. "Smith et al., 2023"). */
  readonly sourceLabel?: string;
}

/** A research institution or publication listed in the methodology banner. */
export interface ResearchInstitution {
  readonly name: string;
  /**
   * URL to the specific paper, report, or page that justifies the reference.
   * MUST be non-empty for the institution to render.
   */
  readonly source: string;
  /** Anchor text for the citation link (e.g. "UDL Guidelines, 2018"). */
  readonly sourceLabel?: string;
}

/**
 * A user testimonial.
 *
 * Only renders when `consent === true`.  The field is required (not optional)
 * so the TypeScript compiler rejects entries that omit it entirely.
 */
export interface Testimonial {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly quote: string;
  /**
   * Written consent from the named person has been obtained and is on file.
   * Must be explicitly `true` — `false` or a missing field → not rendered.
   */
  readonly consent: boolean;
  /** Relative path to a real (consented) photo under public/images/, if any. */
  readonly photo?: string;
}

// ---------------------------------------------------------------------------
// Render guards  (TypeScript narrowing + runtime double-enforcement)
// ---------------------------------------------------------------------------

/**
 * Returns `true` only when `item.source` is a non-empty, non-whitespace
 * string.  Use as a filter predicate:
 *   STATS.filter(isSourced).map(...)
 */
export function isSourced<T extends { source: string }>(item: T): boolean {
  return item.source.trim().length > 0;
}

/**
 * Returns `true` only when the testimonial has explicit written consent on
 * file (`consent === true`).  Use as a filter predicate:
 *   TESTIMONIALS.filter(isConsented).map(...)
 */
export function isConsented(testimonial: Testimonial): boolean {
  return testimonial.consent === true;
}

// ---------------------------------------------------------------------------
// Seed data — team populates source / consent fields to enable each entry
// ---------------------------------------------------------------------------

/**
 * Homepage stats.
 *
 * All entries are seeded as unsourced so no numeric efficacy claim renders
 * until the underlying study is documented.  To enable a stat, set its
 * `source` to a URL or DOI and update the i18n caption keys to reference it.
 */
export const STATS: readonly Stat[] = [
  {
    id: "focus-duration",
    value: "+47.2%",
    // No citation on file.  The stat does NOT render until source is set.
    // Corresponding i18n keys: stat_focus_label / stat_focus_qualitative /
    // stat_focus_caption  (apps/marketing/src/i18n/messages/en.json).
    source: "",
  },
] as const;

/**
 * Research institutions for the methodology banner.
 *
 * Each entry needs a URL to the specific paper or page that supports the
 * reference before it renders.  Do not invent citations — add the URL once
 * the team has identified and documented the underlying work.
 */
export const RESEARCH_INSTITUTIONS: readonly ResearchInstitution[] = [
  { name: "Stanford University", source: "" },
  { name: "MIT Media Lab",       source: "" },
  { name: "CAST",                source: "" },
  { name: "Johns Hopkins",       source: "" },
] as const;

/**
 * User testimonials.
 *
 * No consented entries are seeded.  When adding a real testimonial:
 *   1. Obtain explicit written consent from the named person.
 *   2. Set `consent: true`.
 *   3. Use the person's exact words for `quote`.
 *   4. Optionally add a `photo` path from public/images/testimonials/.
 */
export const TESTIMONIALS: readonly Testimonial[] = [] as const;
