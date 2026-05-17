"use client";
/**
 * BrainCloneInteractive
 * ---------------------
 * Stylised SVG brain visualisation for the parent dashboard. The brain is
 * divided into six regions, each anchored to a learning domain, and is
 * driven entirely by data already exposed by `/api/brain/{learnerId}`
 * (no new endpoints).
 *
 *  - Region colour reflects the gap between the learner's current
 *    grade-equivalent in that domain and the grade they're enrolled in
 *    (green = at/above, amber = approaching, red = gap > 1.5 yrs, slate =
 *    no data yet).
 *  - Region pulse rate scales with mastery — stronger domains pulse
 *    faster, communicating "active growth" at a glance.
 *  - Hover (or focus) reveals a tooltip with the per-domain metric
 *    breakdown; click/Enter opens a slide-in detail panel with the
 *    accommodations and tutors that flow into that domain.
 *  - Keyboard: Tab walks regions, Enter / Space drills in, Esc closes
 *    the panel.
 *  - The component honours `prefers-reduced-motion` (no pulse anim) and
 *    inherits tier accent colours via `var(--tier-primary)` so it sits
 *    correctly on K-5, 6-8, and 9-12 backgrounds.
 *
 * Usage on the parent dashboard home: `<BrainCloneInteractive variant="card" />`
 * Usage on the per-learner brain page: `<BrainCloneInteractive variant="full" />`
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Brain, Flame, Star, TrendingUp, Sparkles, X } from "lucide-react";
import {
  DOMAIN_TO_SLOT,
  gradeToNumber,
  pulseSecondsFor,
  statusFor as statusForPure,
  type RegionStatus,
} from "./BrainCloneInteractive.helpers";

export interface BrainRegionDatum {
  /** Stable id used for keyboard nav and aria. */
  id: string;
  /** The domain key as stored on the brain state (e.g. "math", "ela"). */
  domain: string;
  /** Human-readable label shown in tooltips and panels. */
  label: string;
  /** Mastery score in 0..1 (matches `brainState.masteryLevels`). */
  mastery: number;
  /** Last-activity ISO timestamp, optional. */
  lastActivity?: string | null;
  /** Accommodations that affect this domain. */
  accommodations?: string[];
  /** Tutors recommended for this domain. */
  tutors?: string[];
}

export interface BrainCloneMetrics {
  streakDays?: number;
  totalXp?: number;
  /** +/- mastery delta vs. previous week, in 0..1 units (0.05 = +5pp). */
  masteryDeltaWeek?: number;
  nextMilestone?: string;
  badgeCount?: number;
}

export interface BrainCloneInteractiveProps {
  /** Display variant — compact card for dashboard tiles, full for the standalone page. */
  variant?: "card" | "full";
  /** Learner display name used in aria labels and the panel header. */
  learnerName: string;
  /** Enrolled grade (numeric or "K"/"PK"). Used to compute gap. */
  enrolledGrade?: string | number | null;
  regions: BrainRegionDatum[];
  metrics?: BrainCloneMetrics;
  /** Optional click-through to the full brain page from the card variant. */
  onOpenFull?: () => void;
}

interface Region {
  id: string;
  domain: string;
  label: string;
  mastery: number;
  lastActivity?: string | null;
  accommodations: string[];
  tutors: string[];
  /** SVG path for the region shape. */
  d: string;
  /** Centroid for tooltip anchoring. */
  cx: number;
  cy: number;
  /** Anchor for the floating label outside the brain silhouette. */
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "end" | "middle";
}

// Six fixed region slots in a stylised lobe layout. Coordinates are tuned
// for a 320×240 viewBox and are independent of mastery — only colour and
// pulse rate change at runtime.
const REGION_SLOTS: Pick<Region, "id" | "d" | "cx" | "cy" | "labelX" | "labelY" | "labelAnchor">[] = [
  {
    // Prefrontal — Executive Function
    id: "prefrontal",
    d: "M70,90 Q60,60 95,52 Q130,48 145,72 Q155,95 135,110 Q100,118 80,108 Z",
    cx: 105,
    cy: 82,
    labelX: 8,
    labelY: 70,
    labelAnchor: "start",
  },
  {
    // Frontal-occipital — Science
    id: "frontal-occipital",
    d: "M150,52 Q185,42 215,55 Q245,68 240,98 Q220,118 185,112 Q155,108 145,82 Z",
    cx: 195,
    cy: 80,
    labelX: 312,
    labelY: 60,
    labelAnchor: "end",
  },
  {
    // Parietal — Math
    id: "parietal",
    d: "M225,70 Q260,72 268,108 Q260,135 230,138 Q215,128 218,108 Q220,90 225,70 Z",
    cx: 246,
    cy: 105,
    labelX: 312,
    labelY: 110,
    labelAnchor: "end",
  },
  {
    // Temporal — Reading / language
    id: "temporal",
    d: "M55,118 Q50,150 80,170 Q115,178 135,162 Q140,140 120,128 Q90,122 55,118 Z",
    cx: 95,
    cy: 148,
    labelX: 8,
    labelY: 160,
    labelAnchor: "start",
  },
  {
    // Broca / Wernicke — Speech / communication
    id: "speech",
    d: "M140,120 Q175,118 200,138 Q205,160 180,170 Q150,172 138,158 Q132,140 140,120 Z",
    cx: 170,
    cy: 145,
    labelX: 312,
    labelY: 165,
    labelAnchor: "end",
  },
  {
    // Limbic — SEL
    id: "limbic",
    d: "M115,150 Q150,148 175,168 Q170,195 140,200 Q108,198 100,180 Q102,162 115,150 Z",
    cx: 140,
    cy: 175,
    labelX: 8,
    labelY: 215,
    labelAnchor: "start",
  },
];

/**
 * Map a learner-domain key to one of the six visual slots. Falls back to
 * the matching slot index for unknown domains so we always render
 * something rather than crash.
 *
 * Imported from `BrainCloneInteractive.helpers` so the test suite and the
 * component agree on a single source of truth.
 */

const DEFAULT_LABELS: Record<string, string> = {
  prefrontal: "Executive Function",
  "frontal-occipital": "Science",
  parietal: "Math",
  temporal: "Reading",
  speech: "Communication",
  limbic: "Social-Emotional",
};

function statusFor(region: Region, enrolled: number): RegionStatus {
  return statusForPure(region.mastery, enrolled);
}

export default function BrainCloneInteractive({
  variant = "card",
  learnerName,
  enrolledGrade,
  regions: regionsInput,
  metrics,
  onOpenFull,
}: BrainCloneInteractiveProps) {
  const reactId = useId();
  const tooltipId = `${reactId}-tooltip`;
  const enrolled = gradeToNumber(enrolledGrade);

  // Honour reduced motion at runtime (avoids hydration mismatch by
  // defaulting to "motion" on the server and updating after mount).
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Map each input domain into its visual slot, deduplicating so two
  // input keys don't collide on the same lobe.
  const regions: Region[] = useMemo(() => {
    const usedSlots = new Set<string>();
    const slotById = new Map(REGION_SLOTS.map((s) => [s.id, s]));
    const result: Region[] = [];
    for (const r of regionsInput) {
      const key = (r.domain || "").toLowerCase().replace(/[\s-]+/g, "_");
      let slotId = DOMAIN_TO_SLOT[key];
      if (!slotId || usedSlots.has(slotId)) {
        // Fall back to the next free slot in declared order.
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
    // Fill remaining slots with placeholder "not yet measured" regions so
    // the silhouette is always whole.
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
  }, [regionsInput]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Close the slide-in panel on Escape.
  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeId]);

  const isCard = variant === "card";
  const widthClass = isCard ? "max-w-full" : "max-w-2xl";

  const activeRegion = activeId ? regions.find((r) => r.id === activeId) ?? null : null;
  const activeStatus = activeRegion ? statusFor(activeRegion, enrolled) : null;

  return (
    <div className={`relative w-full ${widthClass}`} data-variant={variant}>
      <div
        className="relative rounded-2xl overflow-hidden border"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--tier-primary, #7C3AED) 22%, transparent), transparent 70%), color-mix(in srgb, var(--tier-surface, #FFFCF4) 92%, transparent)",
          borderColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 28%, transparent)",
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 320 240"
          role="img"
          aria-label={`${learnerName}'s Brain Clone — interactive map of learning domains`}
          className="w-full h-auto"
          style={{ maxHeight: isCard ? 220 : 360 }}
          aria-describedby={hoveredId ? tooltipId : undefined}
        >
          <defs>
            <radialGradient id={`${reactId}-glow`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="var(--tier-primary, #7C3AED)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--tier-primary, #7C3AED)" stopOpacity="0" />
            </radialGradient>
            <filter id={`${reactId}-soft`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {/* Ambient glow behind the silhouette */}
          <ellipse cx="160" cy="125" rx="140" ry="95" fill={`url(#${reactId}-glow)`} />

          {/* Brain silhouette — single soft outline that all regions live inside */}
          <path
            d="M60,120 Q40,80 80,55 Q110,38 150,42 Q195,32 235,55 Q275,80 270,125 Q278,170 240,195 Q205,215 160,210 Q115,215 80,195 Q42,170 60,120 Z"
            fill="color-mix(in srgb, var(--tier-surface, #FFFCF4) 88%, var(--tier-primary, #7C3AED) 6%)"
            stroke="color-mix(in srgb, var(--tier-primary, #7C3AED) 38%, transparent)"
            strokeWidth="1.5"
          />
          {/* Central fissure for visual fidelity */}
          <path
            d="M160,46 Q156,120 162,210"
            fill="none"
            stroke="color-mix(in srgb, var(--tier-primary, #7C3AED) 30%, transparent)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />

          {regions.map((region) => {
            const status = statusFor(region, enrolled);
            const isHover = hoveredId === region.id;
            const isActive = activeId === region.id;
            const pulse = pulseSecondsFor(region.mastery);
            const animate = !reducedMotion && pulse > 0;
            return (
              <g
                key={region.id}
                role="button"
                tabIndex={0}
                aria-label={`${region.label}: ${status.label}. ${status.description} Press Enter to open details.`}
                aria-pressed={isActive}
                onMouseEnter={() => setHoveredId(region.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === region.id ? null : cur))}
                onFocus={() => setHoveredId(region.id)}
                onBlur={() => setHoveredId((cur) => (cur === region.id ? null : cur))}
                onClick={() => setActiveId(region.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveId(region.id);
                  }
                }}
                style={{ cursor: "pointer", outline: "none" }}
                className="bci-region"
                data-region={region.id}
              >
                <path
                  d={region.d}
                  fill={status.fill}
                  stroke={status.ring}
                  strokeWidth={isHover || isActive ? 2.5 : 1.5}
                  style={{
                    transformOrigin: `${region.cx}px ${region.cy}px`,
                    animation: animate ? `bciPulse ${pulse.toFixed(2)}s ease-in-out infinite` : undefined,
                    transition: "stroke-width 200ms ease, filter 200ms ease",
                    filter: isHover || isActive ? "brightness(1.1) saturate(1.1)" : undefined,
                  }}
                />
                {/* Centroid dot — boosts the "neural node" feel */}
                <circle
                  cx={region.cx}
                  cy={region.cy}
                  r={isHover || isActive ? 4 : 3}
                  fill={status.ring}
                  opacity={status.band === "unknown" ? 0.4 : 0.95}
                />
                {/* Connector + outside label */}
                <line
                  x1={region.cx}
                  y1={region.cy}
                  x2={region.labelAnchor === "end" ? region.labelX - 4 : region.labelX + 4}
                  y2={region.labelY - 4}
                  stroke="color-mix(in srgb, var(--tier-primary, #7C3AED) 35%, transparent)"
                  strokeWidth="0.75"
                  strokeDasharray="1.5 2"
                />
                <text
                  x={region.labelX}
                  y={region.labelY}
                  textAnchor={region.labelAnchor}
                  fontSize="10"
                  fontWeight="700"
                  fill="var(--tier-text, #292F3D)"
                  style={{ pointerEvents: "none" }}
                >
                  {region.label}
                </text>
                <text
                  x={region.labelX}
                  y={region.labelY + 12}
                  textAnchor={region.labelAnchor}
                  fontSize="9"
                  fill="var(--tier-text-soft, #5C5067)"
                  style={{ pointerEvents: "none" }}
                >
                  {status.band === "unknown"
                    ? "no data"
                    : `Gr ${(region.mastery * Math.max(enrolled, 1)).toFixed(1)}`}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover tooltip — positioned in the corner so it never obscures the brain */}
        {hoveredId && (
          <div
            id={tooltipId}
            role="status"
            aria-live="polite"
            className="absolute bottom-3 left-3 right-3 md:right-auto md:max-w-xs rounded-xl px-3 py-2 text-xs shadow-lg pointer-events-none"
            style={{
              backgroundColor: "color-mix(in srgb, var(--tier-surface, #FFFCF4) 96%, transparent)",
              color: "var(--tier-text, #292F3D)",
              border: "1px solid color-mix(in srgb, var(--tier-primary, #7C3AED) 28%, transparent)",
            }}
          >
            {(() => {
              const r = regions.find((x) => x.id === hoveredId);
              if (!r) return null;
              const s = statusFor(r, enrolled);
              return (
                <>
                  <div className="font-bold mb-0.5 flex items-center gap-1.5">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.ring }}
                      aria-hidden="true"
                    />
                    {r.label}
                  </div>
                  <div className="opacity-80">{s.description}</div>
                  {r.lastActivity && (
                    <div className="opacity-60 mt-0.5">
                      Last activity: {new Date(r.lastActivity).toLocaleDateString()}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Metrics strip */}
      {metrics && (
        <div
          className={`mt-3 grid gap-2 ${isCard ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}
          aria-label="Key metrics"
        >
          <MetricCell icon={<Flame className="w-4 h-4" aria-hidden="true" />} label="Streak">
            {metrics.streakDays != null ? `${metrics.streakDays} day${metrics.streakDays === 1 ? "" : "s"}` : "—"}
          </MetricCell>
          <MetricCell icon={<Star className="w-4 h-4" aria-hidden="true" />} label="XP">
            {metrics.totalXp != null ? metrics.totalXp.toLocaleString() : "—"}
          </MetricCell>
          {!isCard && (
            <MetricCell icon={<TrendingUp className="w-4 h-4" aria-hidden="true" />} label="This week">
              {metrics.masteryDeltaWeek != null
                ? `${metrics.masteryDeltaWeek >= 0 ? "+" : ""}${(metrics.masteryDeltaWeek * 100).toFixed(0)} pp`
                : "—"}
            </MetricCell>
          )}
          {!isCard && (
            <MetricCell icon={<Sparkles className="w-4 h-4" aria-hidden="true" />} label="Next milestone">
              <span className="truncate inline-block max-w-full align-bottom">
                {metrics.nextMilestone || "Keep practising"}
              </span>
            </MetricCell>
          )}
        </div>
      )}

      {/* Open-full CTA on the card variant */}
      {isCard && onOpenFull && (
        <button
          type="button"
          onClick={onOpenFull}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition focus:outline-none focus-visible:ring-2"
          style={{
            backgroundColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 14%, transparent)",
            color: "var(--tier-primary, #7C3AED)",
            border: "1px solid color-mix(in srgb, var(--tier-primary, #7C3AED) 38%, transparent)",
          }}
        >
          <Brain className="w-3.5 h-3.5" aria-hidden="true" />
          View full brain
        </button>
      )}

      {/* Slide-in detail panel */}
      {activeRegion && activeStatus && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${activeRegion.label} details`}
          className="absolute inset-0 z-10 flex items-end md:items-center justify-center pointer-events-none"
        >
          {/* Soft scrim */}
          <div
            className="absolute inset-0 pointer-events-auto"
            style={{ backgroundColor: "color-mix(in srgb, var(--tier-bg, #FFFAEF) 70%, transparent)" }}
            onClick={() => setActiveId(null)}
            aria-hidden="true"
          />
          <div
            className="relative pointer-events-auto m-3 max-w-md w-full rounded-2xl shadow-xl p-4"
            style={{
              backgroundColor: "var(--tier-surface, #FFFCF4)",
              color: "var(--tier-text, #292F3D)",
              border: "1px solid color-mix(in srgb, var(--tier-primary, #7C3AED) 32%, transparent)",
            }}
          >
            <div className="flex items-start justify-between mb-2 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: activeStatus.ring }}
                    aria-hidden="true"
                  />
                  <h4 className="font-heading font-bold text-base">{activeRegion.label}</h4>
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--tier-text-soft, #5C5067)" }}>
                  {activeStatus.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveId(null)}
                aria-label="Close details"
                className="rounded-full p-1.5 transition focus:outline-none focus-visible:ring-2"
                style={{ color: "var(--tier-text-soft, #5C5067)" }}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm mb-3">{activeStatus.description}</p>
            {activeRegion.lastActivity && (
              <p className="text-xs mb-2" style={{ color: "var(--tier-text-soft, #5C5067)" }}>
                Last activity: {new Date(activeRegion.lastActivity).toLocaleString()}
              </p>
            )}
            {activeRegion.accommodations.length > 0 && (
              <div className="mb-3">
                <h5 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--tier-text-soft, #5C5067)" }}>
                  Accommodations affecting this area
                </h5>
                <ul className="flex flex-wrap gap-1.5">
                  {activeRegion.accommodations.map((a) => (
                    <li
                      key={a}
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 12%, transparent)",
                        color: "var(--tier-primary, #7C3AED)",
                      }}
                    >
                      {a.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {activeRegion.tutors.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--tier-text-soft, #5C5067)" }}>
                  Recommended tutors
                </h5>
                <ul className="flex flex-wrap gap-1.5">
                  {activeRegion.tutors.map((tName) => (
                    <li
                      key={tName}
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 12%, transparent)",
                        color: "var(--tier-primary, #7C3AED)",
                      }}
                    >
                      {tName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes bciPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.04);
            opacity: 1;
          }
        }
        .bci-region:focus-visible path:first-of-type {
          outline: 2px solid var(--tier-primary, #7C3AED);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .bci-region path {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function MetricCell({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2"
      style={{
        backgroundColor: "color-mix(in srgb, var(--tier-surface, #FFFCF4) 92%, transparent)",
        border: "1px solid color-mix(in srgb, var(--tier-primary, #7C3AED) 16%, transparent)",
      }}
    >
      <span
        className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
        style={{
          backgroundColor: "color-mix(in srgb, var(--tier-primary, #7C3AED) 14%, transparent)",
          color: "var(--tier-primary, #7C3AED)",
        }}
      >
        {icon}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--tier-text-soft, #5C5067)" }}>
          {label}
        </span>
        <span className="text-sm font-bold truncate" style={{ color: "var(--tier-text, #292F3D)" }}>
          {children}
        </span>
      </span>
    </div>
  );
}

/**
 * Pure data helpers exported for unit tests + adapter use elsewhere.
 */
export const _internal = {
  REGION_SLOTS,
  DOMAIN_TO_SLOT,
  DEFAULT_LABELS,
  gradeToNumber,
  statusFor,
  pulseSecondsFor,
};
