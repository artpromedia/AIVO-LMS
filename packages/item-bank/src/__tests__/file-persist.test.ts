import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BRAND_SLUG_TO_BANK_SUBJECT,
  authoredToRuntimeItem,
  createFileBankPersistAdapter,
} from "../cli/file-persist.js";
import { runImport } from "../cli/import.js";
import type { AuthoredItem } from "../schema.js";

const AUTHORED: AuthoredItem = {
  id: "math.1.add-within-20.import-test",
  subjectSlug: "math",
  gradeBand: "1",
  skillIds: ["ccss-math.1.OA.A.1"],
  surfaceType: "math_expression",
  stem: "What is 8 + 5?",
  assets: [],
  correctness: { kind: "exact", answer: "13" },
  accessibility: {},
  locale: "en",
};

describe("item-bank import — REAL file persistence (Sprint 05)", () => {
  it("converts AuthoredItem → runtime Item with one active variant", () => {
    const item = authoredToRuntimeItem(AUTHORED);
    expect(item.id).toBe(AUTHORED.id);
    expect(item.skillId).toBe("ccss-math.1.OA.A.1");
    expect(item.variants).toHaveLength(1);
    expect(item.variants[0].status).toBe("active");
    expect(item.variants[0].body).toMatchObject({ stem: "What is 8 + 5?", correctAnswer: "13" });
    expect(item.variants[0].surfaceType).toBe("math_expression");
  });

  it("round-trips: import a JSON bank → items land in the generated module", async () => {
    const dir = mkdtempSync(join(tmpdir(), "item-bank-import-"));
    const modulePath = join(dir, "imported-items.ts");
    writeFileSync(
      join(dir, "bank.json"),
      JSON.stringify({ schemaVersion: 1, id: "import-test-bank", items: [AUTHORED] }),
    );

    const adapter = createFileBankPersistAdapter(modulePath);
    const summary = await runImport({ inputDir: dir, persist: adapter });
    expect(summary.failed).toHaveLength(0);
    expect(summary.imported.map((i) => i.id)).toContain(AUTHORED.id);

    const written = readFileSync(modulePath, "utf8");
    expect(written).toContain('"subject": "math"');
    expect(written).toContain(AUTHORED.id);

    const mod = (await import(`${modulePath}?fresh=1`)) as {
      IMPORTED_PRODUCTION_ITEMS: ReadonlyArray<{ subject: string; item: { id: string } }>;
    };
    expect(mod.IMPORTED_PRODUCTION_ITEMS).toHaveLength(1);
    expect(mod.IMPORTED_PRODUCTION_ITEMS[0].subject).toBe("math");
    expect(mod.IMPORTED_PRODUCTION_ITEMS[0].item.id).toBe(AUTHORED.id);

    // Idempotent: re-importing the same item replaces, never duplicates.
    await runImport({ inputDir: dir, persist: adapter });
    const mod2 = (await import(`${modulePath}?fresh=2`)) as {
      IMPORTED_PRODUCTION_ITEMS: ReadonlyArray<unknown>;
    };
    expect(mod2.IMPORTED_PRODUCTION_ITEMS).toHaveLength(1);
  });

  it("maps every brand learner-subject slug to a bank subject", () => {
    for (const slug of [
      "math",
      "reading",
      "writing",
      "science",
      "social",
      "speech",
      "executive-function",
      "life",
      "art",
      "coding",
      "social-studies",
      "world-languages",
      "geography",
      "music",
      "physical-education",
      "engineering",
    ]) {
      expect(BRAND_SLUG_TO_BANK_SUBJECT[slug], `missing mapping for ${slug}`).toBeTruthy();
    }
  });
});
