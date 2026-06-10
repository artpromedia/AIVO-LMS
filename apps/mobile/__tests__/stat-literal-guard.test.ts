import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const MOBILE = join(__dirname, "..");
const ROUTE_ROOTS = [
  join(MOBILE, "app", "(parent)"),
  join(MOBILE, "app", "(learner)"),
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry);
    if (statSync(file).isDirectory()) return walk(file);
    return file.endsWith(".ts") || file.endsWith(".tsx") ? [file] : [];
  });
}

describe("mobile stat literal guard", () => {
  it("rejects numeric literal values passed to StatTile or StatPill in parent/learner routes", () => {
    const offenders: string[] = [];

    for (const root of ROUTE_ROOTS) {
      for (const file of walk(root)) {
        const source = readFileSync(file, "utf8");
        for (const pattern of [
          /<StatTile\b[^>]*\bvalue=\{\d+\}/g,
          /<StatPill\b[^>]*\bvalue=\{\d+\}/g,
        ]) {
          for (const match of source.matchAll(pattern)) {
            offenders.push(`${relative(MOBILE, file)} :: ${match[0]}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("rejects other literal stat-card values that would reintroduce fake KPI cards", () => {
    const offenders: string[] = [];

    for (const root of ROUTE_ROOTS) {
      for (const file of walk(root)) {
        const source = readFileSync(file, "utf8");
        for (const pattern of [
          /<StatCard\b[^>]*\bvalue=\{\d+\}/g,
          /<StatCard\b[^>]*\bvalue="[^"]*"/g,
          /<MetricCard\b[^>]*\bvalue="[^"]*"/g,
        ]) {
          for (const match of source.matchAll(pattern)) {
            offenders.push(`${relative(MOBILE, file)} :: ${match[0]}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
