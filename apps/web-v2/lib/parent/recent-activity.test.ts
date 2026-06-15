import { describe, expect, it } from "vitest";
import { mergeRecentActivity, type ActivityItem } from "./recent-activity";

function item(p: Partial<ActivityItem> & { id: string; at: string }): ActivityItem {
  return {
    id: p.id,
    kind: p.kind ?? "lesson",
    at: p.at,
    titleKey: p.titleKey ?? "lesson_completed",
    params: p.params,
    detail: p.detail ?? null,
    href: p.href ?? null,
  };
}

describe("mergeRecentActivity", () => {
  it("returns an empty array for no items (honest empty feed)", () => {
    expect(mergeRecentActivity([])).toEqual([]);
  });

  it("sorts newest-first across kinds", () => {
    const out = mergeRecentActivity([
      item({ id: "a", at: "2026-06-01T00:00:00Z", kind: "lesson" }),
      item({ id: "b", at: "2026-06-10T00:00:00Z", kind: "observation" }),
      item({ id: "c", at: "2026-06-05T00:00:00Z", kind: "therapy_note" }),
    ]);
    expect(out.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("caps the feed at the requested limit", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      item({ id: `i${i}`, at: `2026-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z` }),
    );
    expect(mergeRecentActivity(many, 12)).toHaveLength(12);
  });

  it("drops items without a timestamp", () => {
    const out = mergeRecentActivity([
      item({ id: "good", at: "2026-06-10T00:00:00Z" }),
      item({ id: "bad", at: "" }),
    ]);
    expect(out.map((i) => i.id)).toEqual(["good"]);
  });

  it("breaks ties deterministically by id", () => {
    const out = mergeRecentActivity([
      item({ id: "z", at: "2026-06-10T00:00:00Z" }),
      item({ id: "a", at: "2026-06-10T00:00:00Z" }),
    ]);
    expect(out.map((i) => i.id)).toEqual(["a", "z"]);
  });
});
