import { describe, it, expect } from "vitest";
import { AUDIENCES, LEVELS, SUBJECTS } from "@/lib/landing-content";
import { SITE_URL } from "@/lib/constants";
import { renderLlmsTxt, renderLlmsFullTxt, LLMS_SECTION_HEADERS } from "@/lib/llms-content";

/**
 * Drift guard: every audience / subject / level slug that the sitemap emits
 * must also be reachable from llms.txt, so the agent manifest never falls
 * behind the indexable surface. Both are sourced from the same data modules;
 * this test fails loudly if a future change breaks that.
 */
describe("llms.txt", () => {
  const txt = renderLlmsTxt();

  it("starts with the site H1 and a summary blockquote", () => {
    expect(txt.startsWith("# AIVO Learning")).toBe(true);
    expect(txt).toContain("\n> ");
  });

  it("emits every required section header", () => {
    for (const header of LLMS_SECTION_HEADERS) {
      expect(txt).toContain(header);
    }
  });

  it("builds absolute URLs from NEXT_PUBLIC_SITE_URL", () => {
    expect(txt).toContain(`${SITE_URL}/pricing`);
    // No bare relative markdown link targets leaked through.
    expect(txt).not.toMatch(/\]\(\/(?!\/)/);
  });

  it("includes every audience slug", () => {
    for (const a of AUDIENCES) {
      expect(txt).toContain(`${SITE_URL}/${a.slug}`);
    }
  });

  it("includes every subject slug", () => {
    for (const s of SUBJECTS) {
      expect(txt).toContain(`${SITE_URL}/subjects/${s.slug}`);
    }
  });

  it("includes every level slug", () => {
    for (const l of LEVELS) {
      expect(txt).toContain(`${SITE_URL}/levels/${l.slug}`);
    }
  });
});

describe("llms-full.txt", () => {
  const full = renderLlmsFullTxt();

  it("inlines the key value-prop facts LLMs cite", () => {
    expect(full).toContain("Brain Clone");
    expect(full).toContain("14 AI tutors");
    expect(full).toContain("five functioning levels");
    expect(full).toContain("COPPA and FERPA");
    expect(full).toContain("30-day money-back guarantee");
  });

  it("still carries the full link set + section headers", () => {
    for (const header of LLMS_SECTION_HEADERS) {
      expect(full).toContain(header);
    }
    for (const a of AUDIENCES) {
      expect(full).toContain(`${SITE_URL}/${a.slug}`);
    }
  });
});
