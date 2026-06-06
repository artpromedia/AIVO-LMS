import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getProductionItemCounts,
  getProductionItemsForSubject,
  type RequiredSubjectSlug,
} from "../production.js";

describe("production item manifest", () => {
  it("matches the live production bank counts", () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, "..", "production-manifest.json"), "utf8"),
    ) as Record<RequiredSubjectSlug, number>;
    expect(getProductionItemCounts()).toEqual(manifest);
  });

  it("matches the live PRE-K production item counts", () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, "..", "production-prek-manifest.json"), "utf8"),
    ) as Record<RequiredSubjectSlug, number>;
    const live = Object.fromEntries(
      Object.keys(manifest).map((subject) => [
        subject,
        getProductionItemsForSubject(subject as RequiredSubjectSlug).filter((item) =>
          item.skillId.startsWith("prek."),
        ).length,
      ]),
    );
    expect(live).toEqual(manifest);
  });
});
