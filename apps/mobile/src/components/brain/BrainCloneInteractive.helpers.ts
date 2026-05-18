/**
 * Pure helpers for `BrainCloneInteractive` (mobile).
 *
 * Mirrors `apps/web/src/components/brain/BrainCloneInteractive.helpers.ts`
 * so web and mobile share the same status bands, grade math, and slot
 * mapping. Keep the two files in lock-step when changing logic.
 */

export interface RegionStatus {
  band: "strong" | "approaching" | "gap" | "unknown";
  fill: string;
  ring: string;
  label: string;
  description: string;
}

export function gradeToNumber(g: string | number | null | undefined): number {
  if (g === null || g === undefined) return 6;
  const raw = String(g).trim().toLowerCase();
  if (raw === "k" || raw.startsWith("kinder")) return 0;
  if (raw === "pk" || raw.startsWith("pre")) return 0;
  const m = raw.match(/-?\d+/);
  if (!m) return 6;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : 6;
}

export function formatGrade(enrolled: number): string {
  if (!Number.isFinite(enrolled)) return "—";
  if (enrolled <= 0) return "K";
  return String(enrolled);
}

export function statusFor(mastery: number, enrolled: number): RegionStatus {
  if (!Number.isFinite(mastery) || mastery <= 0) {
    return {
      band: "unknown",
      fill: "rgba(148,163,184,0.35)",
      ring: "rgba(148,163,184,0.7)",
      label: "Not yet measured",
      description: "Complete a learning session in this area to start tracking.",
    };
  }
  const equivalent = mastery * Math.max(enrolled, 1);
  const gap = enrolled - equivalent;
  const enrolledLabel = formatGrade(enrolled);
  if (gap <= 0.25) {
    return {
      band: "strong",
      fill: "rgba(16,185,129,0.55)",
      ring: "rgba(16,185,129,0.95)",
      label: "On or above grade",
      description: `Performing at grade ${equivalent.toFixed(1)} against an enrolled grade of ${enrolledLabel}.`,
    };
  }
  if (gap <= 1.5) {
    return {
      band: "approaching",
      fill: "rgba(245,158,11,0.55)",
      ring: "rgba(245,158,11,0.95)",
      label: "Approaching grade",
      description: `Performing at grade ${equivalent.toFixed(1)} — about ${gap.toFixed(1)} years below enrolled.`,
    };
  }
  return {
    band: "gap",
    fill: "rgba(244,114,182,0.55)",
    ring: "rgba(236,72,153,0.95)",
    label: "Gap — focus area",
    description: `Performing at grade ${equivalent.toFixed(1)} — ${gap.toFixed(1)} years below enrolled. Tutors are calibrated to teach here.`,
  };
}

export function pulseSecondsFor(mastery: number): number {
  if (!Number.isFinite(mastery) || mastery <= 0) return 0;
  const clamped = Math.max(0, Math.min(1, mastery));
  return 1.6 + (1 - clamped) * 2.4;
}

export const DOMAIN_TO_SLOT: Record<string, string> = {
  executive_function: "prefrontal",
  exec: "prefrontal",
  ef: "prefrontal",
  science: "frontal-occipital",
  stem: "frontal-occipital",
  math: "parietal",
  mathematics: "parietal",
  ela: "temporal",
  english: "temporal",
  reading: "temporal",
  literacy: "temporal",
  speech: "speech",
  communication: "speech",
  language: "speech",
  sel: "limbic",
  social: "limbic",
  social_emotional: "limbic",
};

export function domainToSlot(domain: string): string | null {
  const key = (domain || "").toLowerCase().replace(/[\s-]+/g, "_");
  return DOMAIN_TO_SLOT[key] ?? null;
}

export const DEFAULT_LABELS: Record<string, string> = {
  prefrontal: "Executive Function",
  "frontal-occipital": "Science",
  parietal: "Math",
  temporal: "Reading",
  speech: "Communication",
  limbic: "Social-Emotional",
};

export interface RegionSlot {
  id: string;
  /** SVG path for the region shape. */
  d: string;
  cx: number;
  cy: number;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "end" | "middle";
}

export const REGION_SLOTS: RegionSlot[] = [
  {
    id: "prefrontal",
    d: "M70,90 Q60,60 95,52 Q130,48 145,72 Q155,95 135,110 Q100,118 80,108 Z",
    cx: 105,
    cy: 82,
    labelX: 8,
    labelY: 70,
    labelAnchor: "start",
  },
  {
    id: "frontal-occipital",
    d: "M150,52 Q185,42 215,55 Q245,68 240,98 Q220,118 185,112 Q155,108 145,82 Z",
    cx: 195,
    cy: 80,
    labelX: 312,
    labelY: 60,
    labelAnchor: "end",
  },
  {
    id: "parietal",
    d: "M225,70 Q260,72 268,108 Q260,135 230,138 Q215,128 218,108 Q220,90 225,70 Z",
    cx: 246,
    cy: 105,
    labelX: 312,
    labelY: 110,
    labelAnchor: "end",
  },
  {
    id: "temporal",
    d: "M55,118 Q50,150 80,170 Q115,178 135,162 Q140,140 120,128 Q90,122 55,118 Z",
    cx: 95,
    cy: 148,
    labelX: 8,
    labelY: 160,
    labelAnchor: "start",
  },
  {
    id: "speech",
    d: "M140,120 Q175,118 200,138 Q205,160 180,170 Q150,172 138,158 Q132,140 140,120 Z",
    cx: 170,
    cy: 145,
    labelX: 312,
    labelY: 165,
    labelAnchor: "end",
  },
  {
    id: "limbic",
    d: "M115,150 Q150,148 175,168 Q170,195 140,200 Q108,198 100,180 Q102,162 115,150 Z",
    cx: 140,
    cy: 175,
    labelX: 8,
    labelY: 215,
    labelAnchor: "start",
  },
];

export interface BrainRegionDatum {
  id: string;
  domain: string;
  label: string;
  mastery: number;
  lastActivity?: string | null;
  accommodations?: string[];
  tutors?: string[];
}

export interface ResolvedRegion extends RegionSlot {
  domain: string;
  label: string;
  mastery: number;
  lastActivity: string | null;
  accommodations: string[];
  tutors: string[];
}

/**
 * Map input regions onto fixed slots and fill any unused slots with
 * "not measured" placeholders so the silhouette is always whole.
 */
export function resolveRegions(input: BrainRegionDatum[]): ResolvedRegion[] {
  const usedSlots = new Set<string>();
  const slotById = new Map(REGION_SLOTS.map((s) => [s.id, s] as const));
  const result: ResolvedRegion[] = [];
  for (const r of input) {
    const key = (r.domain || "").toLowerCase().replace(/[\s-]+/g, "_");
    let slotId: string | undefined = DOMAIN_TO_SLOT[key];
    if (!slotId || usedSlots.has(slotId)) {
      const free = REGION_SLOTS.find((s) => !usedSlots.has(s.id));
      if (!free) break;
      slotId = free.id;
    }
    const slot = slotById.get(slotId);
    if (!slot) continue;
    usedSlots.add(slotId);
    result.push({
      ...slot,
      domain: r.domain,
      label: r.label || DEFAULT_LABELS[slotId] || r.domain,
      mastery: r.mastery,
      lastActivity: r.lastActivity ?? null,
      accommodations: r.accommodations ?? [],
      tutors: r.tutors ?? [],
    });
  }
  for (const slot of REGION_SLOTS) {
    if (usedSlots.has(slot.id)) continue;
    result.push({
      ...slot,
      domain: slot.id,
      label: DEFAULT_LABELS[slot.id] ?? slot.id,
      mastery: 0,
      lastActivity: null,
      accommodations: [],
      tutors: [],
    });
  }
  return result;
}
