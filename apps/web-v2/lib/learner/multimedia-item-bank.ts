import { readFileSync } from "node:fs";
import { join } from "node:path";

export type MultimediaSurfaceType = "video" | "audio";

export type MultimediaAsset = {
  id: string;
  kind: "video" | "audio" | "captions";
  src: string;
  alt?: string;
  mimeType?: string;
  language?: string;
  label?: string;
  default?: boolean;
};

export type MultimediaFixtureItem = {
  id: string;
  subject: "math" | "ela" | "science";
  skillId: string;
  surfaceType: MultimediaSurfaceType;
  prompt: string;
  expectedAnswer?: string;
  choices?: string[];
  hint?: string;
  scaffold?: string;
  assets: MultimediaAsset[];
  captionText: string;
  captionPath: string;
};

type GeneratedFixtureBank = {
  generatedAt: string;
  itemsBySubject: Record<"math" | "ela" | "science", MultimediaFixtureItem[]>;
};

let cached: GeneratedFixtureBank | null = null;

function loadFixtureBank(): GeneratedFixtureBank {
  if (cached) return cached;
  const candidatePaths = [
    join(process.cwd(), "apps/web-v2/lib/learner/multimedia-item-bank.generated.json"),
    join(process.cwd(), "lib/learner/multimedia-item-bank.generated.json"),
  ];
  let raw: string | null = null;
  for (const path of candidatePaths) {
    try {
      raw = readFileSync(path, "utf8");
      break;
    } catch {
      // try next path
    }
  }
  if (!raw) {
    throw new Error(
      "multimedia fixture import missing; run pnpm item-bank:import-multimedia-fixtures",
    );
  }
  cached = JSON.parse(raw) as GeneratedFixtureBank;
  return cached;
}

function normalizeSubject(
  subjectSlug: string,
): keyof GeneratedFixtureBank["itemsBySubject"] | null {
  if (subjectSlug === "math") return "math";
  if (subjectSlug === "science") return "science";
  if (subjectSlug === "reading" || subjectSlug === "writing" || subjectSlug === "ela") return "ela";
  return null;
}

function stableIndex(seed: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return size === 0 ? 0 : hash % size;
}

export function pickMultimediaFixtureForSubject(
  subjectSlug: string,
  seed: string,
): MultimediaFixtureItem | null {
  const subject = normalizeSubject(subjectSlug);
  if (!subject) return null;
  const bank = loadFixtureBank();
  const items = bank.itemsBySubject[subject] ?? [];
  if (items.length === 0) return null;
  return items[stableIndex(seed, items.length)] ?? null;
}
