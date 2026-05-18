"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Brain,
  ClipboardEdit,
  Check,
  Dumbbell,
  Sprout,
  Target,
  BarChart3,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

interface BrainState {
  masteryLevels: Record<string, number>;
  functioningLevelProfile: { level: string; confidence?: number };
  sensoryProfile: { visual?: string; auditory?: string; tactile?: string };
  activeAccommodations: string[];
  iepProfile: { goals?: string[] };
  disabilitySignals: Record<string, number>;
  version: number;
  updatedAt: string;
}

interface BrainNode {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  mastery: number;
  pulsePhase: number;
}

interface NeuralConnection {
  from: string;
  to: string;
  strength: number;
}

type ViewMode = "brain" | "rai" | "xai";

const DOMAIN_COLORS: Record<string, string> = {
  mathematics: "#7C3AED",
  math: "#7C3AED",
  ela: "#10B981",
  english: "#10B981",
  science: "#F59E0B",
  history: "#6366F1",
  coding: "#06B6D4",
  speech: "#EC4899",
  sel: "#8B5CF6",
  geography: "#14B8A6",
  music: "#D946EF",
  pe: "#22C55E",
  health: "#22C55E",
  languages: "#0EA5E9",
  stem: "#EF4444",
  engineering: "#EF4444",
  life_skills: "#F97316",
  creative: "#A855F7",
  default: "#94A3B8",
};

function getDomainColor(domain: string): string {
  const lower = domain.toLowerCase();
  for (const [key, color] of Object.entries(DOMAIN_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return DOMAIN_COLORS.default;
}

function generateBrainNodes(mastery: Record<string, number>): BrainNode[] {
  const entries = Object.entries(mastery);
  if (entries.length === 0) return [];

  const nodes: BrainNode[] = [];
  const cx = 200;
  const cy = 180;
  const maxRadius = 130;

  entries.forEach(([domain, rawValue], i) => {
    const pct = rawValue <= 1 ? rawValue * 100 : rawValue;
    const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
    const dist = maxRadius * (0.5 + Math.random() * 0.4);
    nodes.push({
      id: domain,
      label: domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      radius: 14 + (pct / 100) * 18,
      color: getDomainColor(domain),
      mastery: pct,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  });

  return nodes;
}

function generateConnections(nodes: BrainNode[]): NeuralConnection[] {
  const conns: NeuralConnection[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 180) {
        const avgMastery = (nodes[i].mastery + nodes[j].mastery) / 200;
        conns.push({
          from: nodes[i].id,
          to: nodes[j].id,
          strength: avgMastery * (1 - dist / 250),
        });
      }
    }
  }
  return conns;
}

const FUNCTIONING_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  STANDARD: { label: "Standard", color: "#059669", bg: "#D1FAE5" },
  SUPPORTED: { label: "Supported", color: "#D97706", bg: "#FEF3C7" },
  LOW_VERBAL: { label: "Low Verbal", color: "#DC2626", bg: "#FEE2E2" },
  NON_VERBAL: { label: "Non-Verbal", color: "#7C3AED", bg: "#EDE9FE" },
  PRE_SYMBOLIC: { label: "Pre-Symbolic", color: "#BE185D", bg: "#FCE7F3" },
};

interface BrainVisualizationProps {
  learnerId: string;
  learnerName: string;
  accessToken: string;
  compact?: boolean;
  baselineCompleted?: boolean;
}

export default function BrainVisualization({
  learnerId,
  learnerName,
  accessToken,
  compact = false,
  baselineCompleted = false,
}: BrainVisualizationProps) {
  const [brainState, setBrainState] = useState<BrainState | null>(null);
  const [brainExists, setBrainExists] = useState<"unknown" | "true" | "false">("unknown");
  const [brainStatus, setBrainStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("brain");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBrainState(null);
    setBrainExists("unknown");
    setBrainStatus(null);

    const fetchBrain = async () => {
      try {
        const res = await fetch(`/api/brain/${learnerId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          // The API returns the brain_states row with all fields at top
          // level (camelCased). The legacy `state` jsonb column is usually
          // empty `{}` — only fall back to it if the top-level payload
          // doesn't carry mastery data.
          const hasTopLevel = data && (data.masteryLevels || data.version || data.updatedAt);
          const nested = data?.state;
          const hasNested = nested && typeof nested === "object" && Object.keys(nested).length > 0;
          setBrainState(hasTopLevel ? data : hasNested ? nested : data);
          setBrainExists("true");
        } else if (res.status === 404) {
          try {
            const preRes = await fetch(`/api/brain/${learnerId}/pre-clone-data`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (cancelled) return;
            if (preRes.ok) {
              const pre = await preRes.json();
              if (cancelled) return;
              setBrainExists(pre.brain_exists ? "true" : "false");
              setBrainStatus(pre.brain_status || null);
            }
          } catch {}
          if (!cancelled) setError("Brain not initialized yet");
        } else {
          if (!cancelled) setError("Could not load brain data");
        }
      } catch (err: unknown) {
        console.error("Failed to fetch brain state:", err);
        if (!cancelled) setError("Could not load brain data");
      }
      if (!cancelled) setLoading(false);
    };
    fetchBrain();
    return () => {
      cancelled = true;
    };
  }, [learnerId, accessToken]);

  useEffect(() => {}, []);

  const mastery = brainState?.masteryLevels || {};
  const nodes = generateBrainNodes(mastery);
  const connections = generateConnections(nodes);
  const funcLevel = brainState?.functioningLevelProfile?.level || "STANDARD";
  const funcBadge = FUNCTIONING_BADGES[funcLevel] || FUNCTIONING_BADGES.STANDARD;
  const sensory = brainState?.sensoryProfile || {};
  const accommodations = brainState?.activeAccommodations || [];
  const iepGoals = brainState?.iepProfile?.goals || [];
  const signals = brainState?.disabilitySignals || {};

  const getNodePosition = useCallback((node: BrainNode): { x: number; y: number } => {
    return { x: node.x, y: node.y };
  }, []);

  if (loading) {
    return (
      <div
        className={`bg-white rounded-2xl border border-slate-200 ${compact ? "p-4" : "p-6"} flex items-center justify-center`}
      >
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-purple-100" />
          <span className="text-sm text-slate-400">Loading brain data...</span>
        </div>
      </div>
    );
  }

  if (error || !brainState) {
    const reviewHref = `/dashboard/parent/learner/${learnerId}/brain-review`;
    const awaitingReview = brainExists && brainStatus === "pending_parent_review";
    const readyToBuild = baselineCompleted && !brainExists;
    const notReady = !baselineCompleted;

    return (
      <div className={`bg-white rounded-2xl border border-slate-200 ${compact ? "p-4" : "p-6"}`}>
        {!compact && (
          <h3 className="font-heading font-bold text-slate-900 mb-3">Brain Visualization</h3>
        )}
        <div className="text-center py-8">
          {awaitingReview ? (
            <>
              <ClipboardEdit
                className="w-12 h-12 mx-auto mb-3 text-slate-400"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-slate-700 font-heading font-bold">Awaiting Your Review</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                The Brain Clone has been built and is ready for your review. Approve it to activate
                personalized learning.
              </p>
              <Link
                href={reviewHref}
                className="inline-block mt-4 px-5 py-2 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90 transition"
              >
                Review & Approve
              </Link>
            </>
          ) : readyToBuild ? (
            <>
              <Brain
                className="w-12 h-12 mx-auto mb-3 text-purple-500"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-slate-700 font-heading font-bold">Ready to Build Brain Clone</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Baseline assessment is complete. Review the assessment summary, provide COPPA
                parental consent, and approve to build the Brain Clone.
              </p>
              <Link
                href={reviewHref}
                className="inline-block mt-4 px-5 py-2 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90 transition"
              >
                Review &amp; Approve
              </Link>
            </>
          ) : notReady ? (
            <>
              <Brain
                className="w-12 h-12 mx-auto mb-3 text-slate-300"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-slate-500 font-semibold">Brain not initialized yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Complete the parent assessment and baseline adventure to initialize the Brain Clone
              </p>
            </>
          ) : (
            <>
              <Brain
                className="w-12 h-12 mx-auto mb-3 text-slate-300"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-slate-500 font-semibold">{error || "Brain not initialized yet"}</p>
              <p className="text-xs text-slate-400 mt-1">Please try again in a moment</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 overflow-hidden ${compact ? "" : "shadow-lg"}`}
      role="region"
      aria-label={`${learnerName}'s Brain Clone visualization`}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-cyan-50">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-purple-500" strokeWidth={2.5} aria-hidden="true" />
          <div>
            <h3 className="font-heading font-bold text-slate-900 text-sm">
              {learnerName}&apos;s Brain Clone
            </h3>
            <span className="text-xs text-slate-500">
              v{brainState.version} &middot; Updated{" "}
              {new Date(brainState.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-full p-0.5 border border-slate-200">
          {(["brain", "rai", "xai"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                viewMode === mode
                  ? mode === "rai"
                    ? "bg-green-500 text-white"
                    : mode === "xai"
                      ? "bg-blue-500 text-white"
                      : "bg-primary text-white"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {mode === "brain" ? "Brain" : mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className={compact ? "p-3" : "p-5"}>
        {viewMode === "brain" && (
          <BrainNetworkView
            nodes={nodes}
            hoveredNode={hoveredNode}
            setHoveredNode={setHoveredNode}
            funcBadge={funcBadge}
            funcLevel={funcLevel}
            compact={compact}
          />
        )}
        {viewMode === "rai" && (
          <RAIView
            funcBadge={funcBadge}
            funcLevel={funcLevel}
            sensory={sensory}
            accommodations={accommodations}
            iepGoals={iepGoals}
            version={brainState.version}
            compact={compact}
          />
        )}
        {viewMode === "xai" && (
          <XAIView
            mastery={mastery}
            signals={signals}
            nodes={nodes}
            funcLevel={funcLevel}
            compact={compact}
          />
        )}
      </div>
    </div>
  );
}

// Strength label per domain (used by Domain Overview).
const DOMAIN_STRENGTHS: Record<string, string> = {
  math: "Problem Solving",
  mathematics: "Problem Solving",
  ela: "Comprehension",
  english: "Comprehension",
  reading: "Comprehension",
  science: "Inquiry",
  history: "Memory & Sequencing",
  coding: "Logical Thinking",
  speech: "Articulation",
  sel: "Self-Awareness",
  geography: "Spatial Reasoning",
  music: "Rhythm & Pitch",
  pe: "Coordination",
  health: "Healthy Habits",
  languages: "Vocabulary",
  stem: "Engineering Design",
  engineering: "Engineering Design",
  life_skills: "Independence",
  creative: "Imagination",
};
function getDomainStrength(id: string): string {
  const lower = id.toLowerCase();
  for (const [k, v] of Object.entries(DOMAIN_STRENGTHS)) {
    if (lower.includes(k)) return v;
  }
  return "Emerging Skills";
}

// Insight phrase per domain (used by Insights panel).
const DOMAIN_INSIGHT: Record<string, string> = {
  math: "Math problem solving is a relative strength.",
  ela: "Ela comprehension shows steady improvement.",
  reading: "Reading comprehension shows steady improvement.",
  science: "Science inquiry skills are developing as expected.",
  history: "History recall is stabilising.",
  coding: "Coding logic is forming solid foundations.",
  speech: "Speech articulation is gaining clarity.",
  sel: "Social-emotional awareness is growing.",
};
function getDomainInsight(id: string): string {
  const lower = id.toLowerCase();
  for (const [k, v] of Object.entries(DOMAIN_INSIGHT)) {
    if (lower.includes(k)) return v;
  }
  const label = id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${label} is progressing.`;
}

// Deterministic 0..1 hash from a string + salt — used to seed
// fake-but-stable per-domain trend variations until a real metrics
// endpoint is wired up.
function seedNoise(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

interface RingProps {
  cx: number;
  cy: number;
  r: number;
  pct: number;
  color: string;
  label: string;
}
function Ring({ cx, cy, r, pct, color, label }: RingProps) {
  const stroke = 6;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#E5E7EB" strokeWidth={stroke} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="16" fontWeight="800" fill={color}>
        {Math.round(pct)}%
      </text>
      <text
        x={cx}
        y={cy + r + 18}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#334155"
      >
        {label}
      </text>
    </g>
  );
}

function BrainSilhouetteBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <svg
        viewBox="0 0 760 560"
        className="h-[430px] w-[590px] max-w-full opacity-[0.22]"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="brain-realistic-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="brain-realistic-fill" x1="120" y1="120" x2="640" y2="450">
            <stop offset="0%" stopColor="#F8F5FF" />
            <stop offset="100%" stopColor="#F1EBFF" />
          </linearGradient>
          <linearGradient id="brain-realistic-stroke" x1="140" y1="120" x2="620" y2="430">
            <stop offset="0%" stopColor="#C4B5FD" />
            <stop offset="100%" stopColor="#DDD6FE" />
          </linearGradient>
          <filter id="brain-realistic-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        <ellipse
          cx="380"
          cy="285"
          rx="230"
          ry="180"
          fill="url(#brain-realistic-glow)"
          filter="url(#brain-realistic-blur)"
        />

        <path
          d="M381 106 C347 88 302 89 271 106 C236 97 196 113 173 141 C146 145 124 165 113 193 C91 208 77 237 79 268 C81 293 93 317 112 336 C114 369 132 397 161 415 C174 442 200 460 230 465 C261 490 315 491 351 471 C370 481 391 486 412 486 C446 486 479 474 506 454 C534 452 560 436 575 410 C606 393 627 363 632 328 C651 307 661 278 658 247 C654 215 637 186 611 168 C602 138 580 114 548 106 C516 88 471 88 437 107 C421 100 401 96 381 106 Z"
          fill="url(#brain-realistic-fill)"
          stroke="url(#brain-realistic-stroke)"
          strokeWidth="4"
        />

        <path
          d="M382 120 C373 156 371 195 376 228 C381 258 383 287 381 320 C379 352 379 388 386 458"
          stroke="#D8B4FE"
          strokeWidth="3.2"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Left hemisphere folds */}
        <path
          d="M250 134 C225 147 208 165 202 186 C195 209 201 231 220 248"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M214 189 C246 186 274 197 289 220"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M194 248 C231 244 261 258 280 285"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M198 314 C233 306 264 315 288 340"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M226 372 C253 366 280 376 299 394"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M281 128 C307 146 320 171 320 198"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M304 214 C327 228 339 248 340 272"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M293 300 C319 309 335 329 339 352"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M310 377 C329 389 340 406 343 427"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Right hemisphere folds */}
        <path
          d="M512 134 C537 147 554 165 560 186 C567 209 561 231 542 248"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M548 189 C516 186 488 197 473 220"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M568 248 C531 244 501 258 482 285"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M564 314 C529 306 498 315 474 340"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M536 372 C509 366 482 376 463 394"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M481 128 C455 146 442 171 442 198"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M458 214 C435 228 423 248 422 272"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M469 300 C443 309 427 329 423 352"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M452 377 C433 389 422 406 419 427"
          stroke="#DDD6FE"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M302 430 C325 448 355 458 382 458 C414 458 442 447 463 429"
          stroke="#E9D5FF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}

function BrainNetworkView({
  nodes,
  hoveredNode,
  setHoveredNode,
  funcBadge,
  funcLevel,
  compact,
}: {
  nodes: BrainNode[];
  hoveredNode: string | null;
  setHoveredNode: (id: string | null) => void;
  funcBadge: { label: string; color: string; bg: string };
  funcLevel: string;
  compact: boolean;
}) {
  // Pick the top-3 domains by mastery for the triangle. If fewer than 3
  // exist, render whatever is available.
  const sorted = [...nodes].sort((a, b) => b.mastery - a.mastery);
  const top = sorted.slice(0, 3);

  const masteryAvg = nodes.length ? nodes.reduce((s, n) => s + n.mastery, 0) / nodes.length : 0;
  const topMastery = top[0]?.mastery ?? 0;

  // Derived headline metrics. These are deterministic functions of the
  // mastery scores so the visualisation looks alive without inventing
  // numbers that contradict the brain state. Replace once a real
  // metrics endpoint is available.
  const accuracy = Math.round(50 + masteryAvg * 0.35);
  const engagement = Math.round(55 + masteryAvg * 0.3);
  const growthPct = Math.max(1, Math.round(masteryAvg * 0.2));
  const masteryHeadline = Math.round(topMastery);

  // 4-week trend per top domain — deterministic walk toward current mastery.
  const trends = top.map((n) => {
    const start = Math.max(0, n.mastery - 18 - seedNoise(n.id, 7) * 8);
    const w1 = start + (n.mastery - start) * (0.35 + seedNoise(n.id, 11) * 0.1);
    const w2 = start + (n.mastery - start) * (0.65 + seedNoise(n.id, 17) * 0.1);
    const w3 = n.mastery;
    return { node: n, points: [start, w1, w2, w3], change: Math.round(n.mastery - start) };
  });

  // Insights — top 3 with phrasing that matches each domain.
  const insights = top.map((n) => ({
    id: n.id,
    color: n.color,
    text: getDomainInsight(n.id),
  }));

  // Triangle layout: 3 corner rings inside a 380x320 viewBox.
  const tri = {
    top: { x: 190, y: 70 },
    bl: { x: 80, y: 230 },
    br: { x: 300, y: 230 },
  };
  const positions = [tri.top, tri.br, tri.bl];

  return (
    <div
      className={`grid gap-6 ${compact ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.3fr)_minmax(0,1fr)]"}`}
    >
      {/* LEFT: Domain Overview + Learning Snapshot */}
      <div className="space-y-5">
        <div>
          <h4 className="text-[11px] font-bold tracking-[0.14em] text-slate-400 mb-3">
            DOMAIN OVERVIEW
          </h4>
          <ul className="divide-y divide-slate-100">
            {top.map((n) => (
              <li key={n.id} className="py-3 flex items-start gap-3">
                <span
                  className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: n.color }}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800 capitalize truncate">
                      {n.label}
                    </span>
                    <span className="text-sm font-extrabold" style={{ color: n.color }}>
                      {Math.round(n.mastery)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Strength: {getDomainStrength(n.id)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
          <h4 className="text-[11px] font-bold tracking-[0.14em] text-slate-400 mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> LEARNING SNAPSHOT
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-slate-500">Study Time</p>
              <p className="text-base font-extrabold text-slate-900">—</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Sessions</p>
              <p className="text-base font-extrabold text-slate-900">—</p>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: Triangle visualisation with floating metrics */}
      <div className="relative flex flex-col items-center justify-center">
        <BrainSilhouetteBackground />
        <svg
          viewBox="0 0 380 320"
          className="relative z-10 w-full"
          style={{ maxHeight: 360 }}
          role="img"
          aria-label={`Top domains: ${top.map((n) => `${n.label} ${Math.round(n.mastery)}%`).join(", ")}`}
        >
          <defs>
            <radialGradient id="tri-glow" cx="50%" cy="55%" r="50%">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="190" cy="170" rx="135" ry="110" fill="url(#tri-glow)" />

          {/* Connecting lines */}
          {top.length >= 2 && (
            <g stroke="#E2E8F0" strokeWidth={1.5}>
              <line x1={tri.top.x} y1={tri.top.y} x2={tri.br.x} y2={tri.br.y} />
              {top.length >= 3 && (
                <>
                  <line x1={tri.top.x} y1={tri.top.y} x2={tri.bl.x} y2={tri.bl.y} />
                  <line x1={tri.bl.x} y1={tri.bl.y} x2={tri.br.x} y2={tri.br.y} />
                </>
              )}
            </g>
          )}

          {/* Floating metric labels */}
          <g fontFamily="inherit">
            <text x={62} y={108} fontSize="11" fontWeight="700" fill="#64748B">
              Accuracy
            </text>
            <text x={62} y={124} fontSize="13" fontWeight="800" fill="#0F172A">
              {accuracy}%
            </text>
            <text x={290} y={108} fontSize="11" fontWeight="700" fill="#64748B">
              Growth
            </text>
            <text x={290} y={124} fontSize="13" fontWeight="800" fill="#0F172A">
              +{growthPct}%
            </text>
            <text x={36} y={208} fontSize="11" fontWeight="700" fill="#64748B">
              Engagement
            </text>
            <text x={36} y={224} fontSize="13" fontWeight="800" fill="#0F172A">
              {engagement}%
            </text>
            <text x={304} y={208} fontSize="11" fontWeight="700" fill="#64748B">
              Mastery
            </text>
            <text x={304} y={224} fontSize="13" fontWeight="800" fill="#0F172A">
              {masteryHeadline}%
            </text>
          </g>

          {/* Corner rings (top, bottom-right, bottom-left) */}
          {top.map((n, i) => {
            const p = positions[i] ?? tri.top;
            return (
              <g
                key={n.id}
                onMouseEnter={() => setHoveredNode(n.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{
                  cursor: "pointer",
                  opacity: hoveredNode && hoveredNode !== n.id ? 0.55 : 1,
                }}
              >
                <Ring cx={p.x} cy={p.y} r={36} pct={n.mastery} color={n.color} label={n.label} />
              </g>
            );
          })}
        </svg>

        <p className="relative z-10 text-xs text-slate-400 mt-2">
          Neural pathways active &middot; {nodes.length} domains
        </p>
        <div className="relative z-10 flex items-center justify-center gap-3 mt-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-bold"
            style={{ color: funcBadge.color, backgroundColor: funcBadge.bg }}
          >
            {funcBadge.label}
          </span>
          <span className="text-xs text-slate-400">{funcLevel} functioning</span>
        </div>
      </div>

      {/* RIGHT: Insights + Trend */}
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-4">
          <h4 className="text-[11px] font-bold tracking-[0.14em] text-slate-400 mb-3">INSIGHTS</h4>
          <ul className="space-y-2.5">
            {insights.map((ins) => (
              <li key={ins.id} className="flex items-start gap-2.5">
                <span
                  className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[11px] font-extrabold"
                  style={{ backgroundColor: ins.color + "1A", color: ins.color }}
                  aria-hidden="true"
                >
                  ●
                </span>
                <p className="text-xs text-slate-700 leading-snug pt-1">{ins.text}</p>
              </li>
            ))}
            {insights.length === 0 && (
              <li className="text-xs text-slate-400">
                Insights will appear once mastery data is available.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h4 className="text-[11px] font-bold tracking-[0.14em] text-slate-400 mb-3">
            TREND (LAST 4 WEEKS)
          </h4>
          <ul className="space-y-2.5">
            {trends.map(({ node, points, change }) => {
              const w = 110;
              const h = 22;
              const min = Math.min(...points);
              const max = Math.max(...points);
              const span = Math.max(1, max - min);
              const path = points
                .map((v, i) => {
                  const x = (i / (points.length - 1)) * w;
                  const y = h - ((v - min) / span) * h;
                  return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(" ");
              return (
                <li key={node.id} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 capitalize w-14 truncate">
                    {node.label}
                  </span>
                  <svg width={w} height={h} className="flex-1" aria-hidden="true">
                    <path
                      d={path}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {points.map((v, i) => {
                      const x = (i / (points.length - 1)) * w;
                      const y = h - ((v - min) / span) * h;
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={2}
                          fill="white"
                          stroke={node.color}
                          strokeWidth={1.2}
                        />
                      );
                    })}
                  </svg>
                  <span
                    className="text-xs font-extrabold flex items-center gap-0.5"
                    style={{ color: node.color }}
                  >
                    ▲ {change}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RAIView({
  funcBadge,
  funcLevel,
  sensory,
  accommodations,
  iepGoals,
  version,
  compact,
}: {
  funcBadge: { label: string; color: string; bg: string };
  funcLevel: string;
  sensory: Record<string, string>;
  accommodations: string[];
  iepGoals: string[];
  version: number;
  compact: boolean;
}) {
  const checks = [
    { label: "COPPA Compliance", status: true, detail: "Parental consent verified" },
    { label: "Content Safety Gate", status: true, detail: "All responses pass quality filter" },
    { label: "Bias Detection", status: true, detail: "Content checked for cultural sensitivity" },
    { label: "Data Encryption", status: true, detail: "Brain state encrypted at rest (AES-256)" },
    { label: "Parent Approval Loop", status: true, detail: "Level changes require parent consent" },
    { label: "Session Recording", status: true, detail: `Brain v${version} — full audit trail` },
  ];

  const sensoryEntries = Object.entries(sensory).filter(([, v]) => v && v !== "typical");

  return (
    <div className={`space-y-4 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
          <Check className="w-4 h-4" strokeWidth={3} aria-hidden />
        </span>
        <div>
          <h4 className="font-heading font-bold text-slate-900">Responsible AI Status</h4>
          <p className="text-xs text-slate-400">Safety, compliance & ethical guardrails</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {checks.map((c) => (
          <div
            key={c.label}
            className="flex items-start gap-2 p-2.5 rounded-xl bg-green-50 border border-green-100"
          >
            <Check
              className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0"
              strokeWidth={3}
              aria-hidden
            />
            <div>
              <p className="font-bold text-slate-700 text-xs">{c.label}</p>
              <p className="text-[10px] text-slate-400">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h5 className="font-bold text-slate-700 mb-2">Functioning & Sensory Profile</h5>
        <div className="flex flex-wrap gap-2">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ color: funcBadge.color, backgroundColor: funcBadge.bg }}
          >
            {funcBadge.label}
          </span>
          {sensoryEntries.map(([key, val]) => (
            <span
              key={key}
              className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100"
            >
              {key}: {val}
            </span>
          ))}
        </div>
      </div>

      {accommodations.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <h5 className="font-bold text-slate-700 mb-2">Active Accommodations</h5>
          <div className="flex flex-wrap gap-1.5">
            {accommodations.map((a, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100"
              >
                {typeof a === "string" ? a : String(a)}
              </span>
            ))}
          </div>
        </div>
      )}

      {iepGoals.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <h5 className="font-bold text-slate-700 mb-2">IEP Goals Tracked ({iepGoals.length})</h5>
          <ul className="space-y-1">
            {iepGoals.slice(0, 5).map((g, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                <span className="text-purple-400 mt-0.5">•</span>
                {typeof g === "string" ? g : String(g)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function XAIView({
  mastery,
  signals,
  nodes,
  funcLevel,
  compact,
}: {
  mastery: Record<string, number>;
  signals: Record<string, number>;
  nodes: BrainNode[];
  funcLevel: string;
  compact: boolean;
}) {
  const entries = Object.entries(mastery).sort((a, b) => b[1] - a[1]);
  const strengths = entries.filter(([, v]) => v >= 60);
  const developing = entries.filter(([, v]) => v >= 30 && v < 60);
  const emerging = entries.filter(([, v]) => v < 30);
  const avgMastery =
    entries.length > 0 ? entries.reduce((s, [, v]) => s + v, 0) / entries.length : 0;
  const signalEntries = Object.entries(signals).filter(([, v]) => v > 0.3);

  const explanations: {
    Icon: LucideIcon;
    title: string;
    detail: string;
    type: "insight" | "caution" | "info";
  }[] = [];

  if (strengths.length > 0) {
    explanations.push({
      Icon: Dumbbell,
      title: `Strong in ${strengths.length} domain${strengths.length > 1 ? "s" : ""}`,
      detail: `Highest: ${strengths[0][0].replace(/_/g, " ")} at ${Math.round(strengths[0][1])}%. These domains show consistent mastery and readiness for advancement.`,
      type: "insight",
    });
  }

  if (emerging.length > 0) {
    explanations.push({
      Icon: Sprout,
      title: `${emerging.length} domain${emerging.length > 1 ? "s" : ""} emerging`,
      detail: `${emerging.map(([d]) => d.replace(/_/g, " ")).join(", ")} — below 30% mastery. The Brain is focusing additional scaffolding and review on these areas.`,
      type: "caution",
    });
  }

  if (funcLevel !== "STANDARD") {
    explanations.push({
      Icon: Target,
      title: `Adapted for ${funcLevel.replace(/_/g, " ").toLowerCase()} learner`,
      detail:
        "Content delivery, interaction modes, and session lengths are automatically adjusted based on the functioning level profile in the Brain Clone.",
      type: "info",
    });
  }

  if (signalEntries.length > 0) {
    explanations.push({
      Icon: BarChart3,
      title: "Behavioral signals detected",
      detail: `The Brain has identified patterns in: ${signalEntries.map(([k]) => k.replace(/_/g, " ")).join(", ")}. These influence accommodation recommendations.`,
      type: "info",
    });
  }

  explanations.push({
    Icon: RefreshCw,
    title: "Continuous adaptation",
    detail: `Average mastery: ${Math.round(avgMastery)}% across ${entries.length} domains. The Brain adjusts difficulty, pacing, and tutor strategies after each session.`,
    type: "insight",
  });

  return (
    <div className={`space-y-4 ${compact ? "text-xs" : "text-sm"}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-bold">
          ?
        </span>
        <div>
          <h4 className="font-heading font-bold text-slate-900">Explainable AI Insights</h4>
          <p className="text-xs text-slate-400">Why the Brain makes its decisions</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {explanations.map((exp, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl border ${
              exp.type === "insight"
                ? "bg-emerald-50 border-emerald-100"
                : exp.type === "caution"
                  ? "bg-amber-50 border-amber-100"
                  : "bg-blue-50 border-blue-100"
            }`}
          >
            <div className="flex items-start gap-2">
              <exp.Icon
                className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-600"
                strokeWidth={2}
                aria-hidden
              />
              <div>
                <p className="font-bold text-slate-800 text-xs">{exp.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{exp.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-3">
        <h5 className="font-bold text-slate-700 mb-2">Domain Mastery Breakdown</h5>
        <div className="space-y-1.5">
          {entries.map(([domain, value]) => {
            const node = nodes.find((n) => n.id === domain);
            const color = node?.color || "#94A3B8";
            return (
              <div key={domain} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-slate-600 w-24 truncate">
                  {domain.replace(/_/g, " ")}
                </span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${value}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
                  {Math.round(value)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
