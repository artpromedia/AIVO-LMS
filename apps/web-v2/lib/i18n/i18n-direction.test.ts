/**
 * Sprint 8 — locale direction helper.
 *
 * Pins the RTL/LTR contract the root layout consumes via dirForLocale().
 * Adding a new RTL locale is a one-line edit in config.ts; this test
 * makes sure existing locales keep their direction.
 */
import { describe, it, expect } from "vitest";
import { RTL_LOCALES, dirForLocale, isRTL } from "./config";

describe("isRTL", () => {
  it("identifies the shipped Arabic locale as RTL", () => {
    expect(isRTL("ar")).toBe(true);
  });

  it("identifies common future RTL locales", () => {
    for (const locale of ["he", "fa", "ur", "ps", "sd", "yi"]) {
      expect(isRTL(locale), `${locale} should be RTL`).toBe(true);
    }
  });

  it("treats every other shipped locale as LTR", () => {
    const ltrLocales = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "hi"];
    for (const locale of ltrLocales) {
      expect(isRTL(locale), `${locale} should be LTR`).toBe(false);
    }
  });

  it("strips a BCP-47 region tag before matching", () => {
    expect(isRTL("ar-EG")).toBe(true);
    expect(isRTL("en-US")).toBe(false);
    expect(isRTL("zh-Hans-CN")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isRTL("AR")).toBe(true);
    expect(isRTL("AR-eg")).toBe(true);
  });
});

describe("dirForLocale", () => {
  it("returns 'rtl' for RTL locales and 'ltr' otherwise", () => {
    expect(dirForLocale("ar")).toBe("rtl");
    expect(dirForLocale("en")).toBe("ltr");
    expect(dirForLocale("fr")).toBe("ltr");
    expect(dirForLocale("he-IL")).toBe("rtl");
  });
});

describe("RTL_LOCALES set", () => {
  it("contains all currently-supported RTL primary languages", () => {
    for (const locale of ["ar", "he", "fa", "ur"]) {
      expect(RTL_LOCALES.has(locale), `RTL_LOCALES missing ${locale}`).toBe(true);
    }
  });

  it("does not include any LTR languages", () => {
    for (const locale of ["en", "es", "zh", "ja"]) {
      expect(RTL_LOCALES.has(locale), `${locale} should not be in RTL_LOCALES`).toBe(false);
    }
  });
});
