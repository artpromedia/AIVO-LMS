import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TUTORS } from "@aivo/brand";
import { TUTOR_ART_FILES } from "@/src/lib/tutor-art-manifest";

describe("tutor art", () => {
  it("manifest covers exactly the TUTORS catalogue (a 15th tutor without art fails here)", () => {
    expect(Object.keys(TUTOR_ART_FILES).sort()).toEqual(Object.keys(TUTORS).sort());
  });

  it("every manifest file exists in the bundled assets", () => {
    for (const file of Object.values(TUTOR_ART_FILES)) {
      expect(existsSync(join(__dirname, "..", "assets", "images", "tutors", file))).toBe(true);
    }
  });

  it("tutor-art.ts requires stay in lockstep with the manifest (Metro needs literals)", () => {
    const src = readFileSync(join(__dirname, "..", "src", "lib", "tutor-art.ts"), "utf8");
    for (const [slug, file] of Object.entries(TUTOR_ART_FILES)) {
      expect(src).toContain(`${slug}: require("@/assets/images/tutors/${file}")`);
    }
  });
});
