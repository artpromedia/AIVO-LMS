import { describe, expect, it } from "vitest";
import {
  buildAnswerAnnouncement,
  buildBeatAnnouncement,
  buildCompletionAnnouncement,
} from "../stage-announcements";
import en from "../../../../i18n/en.json";

const t = (key: string, values: Record<string, unknown> = {}) => {
  const raw = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en) as string;
  return Object.entries(values).reduce(
    (s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)),
    raw ?? key,
  );
};

describe("stage announcements", () => {
  it("answer announcement speaks the tier voice lines verbatim", () => {
    expect(
      buildAnswerAnnouncement({ correct: true, encourage: "Nice thinking!", missLine: "x" }),
    ).toBe("Nice thinking!");
    expect(
      buildAnswerAnnouncement({
        correct: false,
        encourage: "x",
        missLine: "Not yet — the answer is 4.",
      }),
    ).toBe("Not yet — the answer is 4.");
  });

  it("beat announcement interpolates index/total from the catalog", () => {
    const msg = buildBeatAnnouncement(t, { index: 2, total: 5 });
    expect(msg).toContain("2");
    expect(msg).toContain("5");
  });

  it("completion announcement carries the XP value", () => {
    expect(buildCompletionAnnouncement(t, { xpEarned: 35 })).toContain("35");
  });

  it("en catalog announcement strings are shame-free", () => {
    const beat = t("learnerStage.a11y.beatAdvance", { index: 1, total: 3 });
    const done = t("learnerStage.a11y.completed", { xp: 10 });
    for (const s of [beat, done]) {
      expect(s.toLowerCase()).not.toMatch(/wrong|incorrect|fail/);
      expect(s).not.toContain("learnerStage.");
    }
  });
});
