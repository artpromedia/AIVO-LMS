import { expect, test } from "@playwright/test";
import { ART_DRAWING_FIXTURE_ITEMS } from "../../../lib/db/art-drawing-fixtures";

test.describe("Art DrawingCanvas fixtures", () => {
  test("ships 10 PreK-K drawing fixtures with PNG+SVG outputs", async () => {
    expect(ART_DRAWING_FIXTURE_ITEMS).toHaveLength(10);
    for (const item of ART_DRAWING_FIXTURE_ITEMS) {
      expect(item.subjectSlug).toBe("art");
      expect(item.gradeBand).toBe("PreK-K");
      expect(item.surfaceType).toBe("drawing_canvas");
      expect(item.expectedAttachments).toEqual(["image/png", "image/svg+xml"]);
    }
  });
});
