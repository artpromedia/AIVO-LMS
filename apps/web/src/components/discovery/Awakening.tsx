"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { ADVENTURE_CHAPTERS, type ChapterResult, type FunctioningLevel } from "./types";

interface AwakeningProps {
  learnerName: string;
  chapterResults: ChapterResult[];
  functioningLevel: FunctioningLevel;
  brainData: any;
  onComplete: () => void;
}

type Phase = "gathering" | "convergence" | "formation" | "memories" | "awakening" | "reveal" | "welcome";

const DOMAIN_COLORS: Record<string, string> = {
  ela: "#10B981",
  math: "#7C3AED",
  science: "#F59E0B",
  sel: "#8B5CF6",
  speech: "#EC4899",
  executive_function: "#06B6D4",
};

const DOMAIN_LABELS: Record<string, string> = {
  ela: "stories and reading",
  math: "numbers and counting",
  science: "science and discovery",
  sel: "feelings and emotions",
  speech: "sounds and words",
  executive_function: "puzzles and patterns",
};

interface Orb {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  domain: string;
  radius: number;
  angle: number;
  speed: number;
  trail: { x: number; y: number; alpha: number }[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface ColorSignature {
  primary: string;
  secondary: string[];
  hues: string[];
}

function computeColorSignatureFromResults(chapterResults: ChapterResult[]): ColorSignature {
  const scored = chapterResults
    .map((r) => ({ domain: r.domain, score: r.total > 0 ? r.correct / r.total : 0 }))
    .sort((a, b) => b.score - a.score);

  const primary = DOMAIN_COLORS[scored[0]?.domain] || "#7C3AED";
  const secondary = scored.slice(1).map((s) => DOMAIN_COLORS[s.domain] || "#6366F1");
  return { primary, secondary, hues: [primary, ...secondary] };
}

function computeColorSignatureFromIdentity(vi: any): ColorSignature {
  const primary = vi.primaryHue || "#7C3AED";
  const secondary = vi.secondaryHues || ["#6366F1"];
  return { primary, secondary, hues: [primary, ...secondary] };
}

function getMostEngagedTutor(chapterResults: ChapterResult[]): TutorKey {
  let best = chapterResults[0];
  for (const r of chapterResults) {
    if (r.total > 0 && r.correct / r.total > (best.total > 0 ? best.correct / best.total : 0)) {
      best = r;
    }
  }
  const ch = ADVENTURE_CHAPTERS.find((c) => c.id === best?.chapterId);
  return (ch?.tutorKey || "nova") as TutorKey;
}

function getStrongestMoments(chapterResults: ChapterResult[]): { domain: string; emoji: string; label: string }[] {
  return chapterResults
    .filter((r) => r.total > 0 && r.correct / r.total >= 0.5)
    .sort((a, b) => (b.correct / b.total) - (a.correct / a.total))
    .slice(0, 3)
    .map((r) => {
      const ch = ADVENTURE_CHAPTERS.find((c) => c.domain === r.domain);
      return {
        domain: r.domain,
        emoji: ch?.landmark.emoji || "📚",
        label: DOMAIN_LABELS[r.domain] || r.domain,
      };
    });
}

const PHASE_TIMING: Record<string, Record<Phase, { start: number; duration: number }>> = {
  STANDARD: {
    gathering: { start: 0, duration: 3000 },
    convergence: { start: 3000, duration: 3000 },
    formation: { start: 6000, duration: 4000 },
    memories: { start: 10000, duration: 3000 },
    awakening: { start: 13000, duration: 3000 },
    reveal: { start: 16000, duration: 4000 },
    welcome: { start: 20000, duration: 5000 },
  },
  SUPPORTED: {
    gathering: { start: 0, duration: 3000 },
    convergence: { start: 3000, duration: 3000 },
    formation: { start: 6000, duration: 4000 },
    memories: { start: 10000, duration: 3000 },
    awakening: { start: 13000, duration: 3000 },
    reveal: { start: 16000, duration: 4000 },
    welcome: { start: 20000, duration: 5000 },
  },
  LOW_VERBAL: {
    gathering: { start: 0, duration: 2000 },
    convergence: { start: 2000, duration: 2000 },
    formation: { start: 4000, duration: 3000 },
    memories: { start: 7000, duration: 2000 },
    awakening: { start: 9000, duration: 2000 },
    reveal: { start: 11000, duration: 2000 },
    welcome: { start: 13000, duration: 2000 },
  },
  NON_VERBAL: {
    gathering: { start: 0, duration: 2000 },
    convergence: { start: 2000, duration: 2000 },
    formation: { start: 4000, duration: 3000 },
    memories: { start: 7000, duration: 0 },
    awakening: { start: 7000, duration: 2000 },
    reveal: { start: 9000, duration: 1000 },
    welcome: { start: 10000, duration: 0 },
  },
  PRE_SYMBOLIC: {
    gathering: { start: 0, duration: 0 },
    convergence: { start: 0, duration: 0 },
    formation: { start: 0, duration: 0 },
    memories: { start: 0, duration: 0 },
    awakening: { start: 0, duration: 0 },
    reveal: { start: 0, duration: 0 },
    welcome: { start: 0, duration: 0 },
  },
};

export default function Awakening({ learnerName, chapterResults, functioningLevel, brainData, onComplete }: AwakeningProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("gathering");
  const [narration, setNarration] = useState("");
  const [showName, setShowName] = useState(false);
  const [showMemory, setShowMemory] = useState(-1);
  const [showBadge, setShowBadge] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const orbsRef = useRef<Orb[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef(0);
  const animFrameRef = useRef(0);
  const phaseRef = useRef<Phase>("gathering");
  const showNameRef = useRef(false);

  const colorSig = useMemo<ColorSignature>(() => {
    const vi = brainData?.visual_identity;
    if (vi?.primaryHue) return computeColorSignatureFromIdentity(vi);
    return computeColorSignatureFromResults(chapterResults);
  }, [chapterResults, brainData]);

  const leadTutor = useMemo(() => getMostEngagedTutor(chapterResults), [chapterResults]);
  const memories = useMemo(() => getStrongestMoments(chapterResults), [chapterResults]);
  const tutorName = TUTORS[leadTutor]?.name || "Nova";
  const timing = PHASE_TIMING[functioningLevel] || PHASE_TIMING.STANDARD;
  const isLowVerbal = functioningLevel === "LOW_VERBAL";
  const isNonVerbal = functioningLevel === "NON_VERBAL";
  const isPreSymbolic = functioningLevel === "PRE_SYMBOLIC";

  const colorSigRef = useRef(colorSig);
  colorSigRef.current = colorSig;

  const initOrbs = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    const startPositions = [
      { x: -50, y: cy },
      { x: cx, y: -50 },
      { x: w + 50, y: cy },
      { x: cx, y: h + 50 },
      { x: -50, y: cy * 0.5 },
      { x: w + 50, y: cy * 1.5 },
    ];
    const chapterEmojis: Record<string, string> = {};
    ADVENTURE_CHAPTERS.forEach((ch) => { chapterEmojis[ch.domain] = ch.landmark.emoji; });

    orbsRef.current = chapterResults.slice(0, isLowVerbal ? 3 : 6).map((r, i) => ({
      x: startPositions[i % startPositions.length].x,
      y: startPositions[i % startPositions.length].y,
      targetX: cx,
      targetY: cy,
      color: DOMAIN_COLORS[r.domain] || "#7C3AED",
      domain: r.domain,
      radius: 18 + (r.correct / Math.max(1, r.total)) * 12,
      angle: (i / chapterResults.length) * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.3,
      trail: [],
    }));
  }, [chapterResults, isLowVerbal]);

  useEffect(() => {
    if (isPreSymbolic) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    initOrbs();
    startTimeRef.current = performance.now();

    const totalDuration = timing.welcome.start + timing.welcome.duration;

    const animate = (now: number) => {
      const t = now - startTimeRef.current;
      const cs = colorSigRef.current;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      let currentPhase: Phase = "gathering";
      if (t >= timing.welcome.start && timing.welcome.duration > 0) currentPhase = "welcome";
      else if (t >= timing.reveal.start) currentPhase = "reveal";
      else if (t >= timing.awakening.start) currentPhase = "awakening";
      else if (t >= timing.memories.start && timing.memories.duration > 0) currentPhase = "memories";
      else if (t >= timing.formation.start) currentPhase = "formation";
      else if (t >= timing.convergence.start) currentPhase = "convergence";

      if (currentPhase !== phaseRef.current) {
        phaseRef.current = currentPhase;
        setPhase(currentPhase);
      }

      const orbs = orbsRef.current;
      const particles = particlesRef.current;

      if (currentPhase === "gathering") {
        const progress = Math.min(1, (t - timing.gathering.start) / timing.gathering.duration);
        orbs.forEach((orb) => {
          const ease = 1 - Math.pow(1 - progress, 3);
          orb.x += (orb.targetX - orb.x) * ease * 0.02;
          orb.y += (orb.targetY - orb.y) * ease * 0.02;

          orb.trail.push({ x: orb.x, y: orb.y, alpha: 0.6 });
          if (orb.trail.length > 30) orb.trail.shift();

          ctx.save();
          orb.trail.forEach((pt, i) => {
            const a = (i / orb.trail.length) * pt.alpha * 0.3;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, orb.radius * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = orb.color + Math.floor(a * 255).toString(16).padStart(2, "0");
            ctx.fill();
          });
          ctx.restore();

          ctx.beginPath();
          ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
          grad.addColorStop(0, orb.color + "FF");
          grad.addColorStop(0.7, orb.color + "88");
          grad.addColorStop(1, orb.color + "00");
          ctx.fillStyle = grad;
          ctx.fill();
        });
      }

      if (currentPhase === "convergence") {
        const progress = Math.min(1, (t - timing.convergence.start) / timing.convergence.duration);
        const orbitRadius = 80 * (1 - progress * 0.7);
        const pulseRate = 0.003 + progress * 0.003;

        orbs.forEach((orb, i) => {
          orb.angle += orb.speed * 0.03;
          const offset = (i / orbs.length) * Math.PI * 2;
          orb.x = cx + Math.cos(orb.angle + offset) * orbitRadius;
          orb.y = cy + Math.sin(orb.angle + offset) * orbitRadius;

          const pulseSize = orb.radius * (1 + 0.15 * Math.sin(t * pulseRate));

          orb.trail.push({ x: orb.x, y: orb.y, alpha: 0.4 });
          if (orb.trail.length > 20) orb.trail.shift();
          orb.trail.forEach((pt, idx) => {
            const a = (idx / orb.trail.length) * 0.2;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pulseSize * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = orb.color + Math.floor(a * 255).toString(16).padStart(2, "0");
            ctx.fill();
          });

          ctx.beginPath();
          ctx.arc(orb.x, orb.y, pulseSize, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, pulseSize);
          grad.addColorStop(0, orb.color + "FF");
          grad.addColorStop(0.6, orb.color + "88");
          grad.addColorStop(1, orb.color + "00");
          ctx.fillStyle = grad;
          ctx.fill();
        });

        if (progress > 0.3) {
          for (let i = 0; i < 2; i++) {
            particles.push({
              x: cx + (Math.random() - 0.5) * 40,
              y: cy + (Math.random() - 0.5) * 40,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              life: 1,
              maxLife: 1,
              color: cs.hues[Math.floor(Math.random() * cs.hues.length)],
              size: 2 + Math.random() * 3,
            });
          }
        }
      }

      if (currentPhase === "formation" || currentPhase === "memories" || currentPhase === "awakening" || currentPhase === "reveal" || currentPhase === "welcome") {
        const formProgress = currentPhase === "formation"
          ? Math.min(1, (t - timing.formation.start) / timing.formation.duration)
          : 1;

        const breathe = Math.sin(t * 0.002) * 0.05;
        const baseRadius = (w < 500 ? w * 0.2 : 100) * formProgress;
        const radius = baseRadius * (1 + breathe);

        let glowIntensity = formProgress * 0.6;
        if (currentPhase === "awakening") {
          const awProgress = Math.min(1, (t - timing.awakening.start) / timing.awakening.duration);
          glowIntensity = 0.6 + awProgress * 0.4;

          if (awProgress > 0.7) {
            const waveRadius = (awProgress - 0.7) / 0.3 * Math.max(w, h);
            ctx.beginPath();
            ctx.arc(cx, cy, waveRadius, 0, Math.PI * 2);
            ctx.strokeStyle = cs.primary + Math.floor((1 - (awProgress - 0.7) / 0.3) * 80).toString(16).padStart(2, "0");
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }

        if (currentPhase === "reveal" || currentPhase === "welcome") {
          glowIntensity = 1;
        }

        const sphereGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
        sphereGrad.addColorStop(0, cs.primary + Math.floor(glowIntensity * 200).toString(16).padStart(2, "0"));
        cs.secondary.forEach((c, i) => {
          const stop = 0.3 + (i / cs.secondary.length) * 0.4;
          sphereGrad.addColorStop(stop, c + Math.floor(glowIntensity * 150).toString(16).padStart(2, "0"));
        });
        sphereGrad.addColorStop(1, cs.primary + "00");

        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();

        const innerGrad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 0, cx, cy, radius);
        innerGrad.addColorStop(0, "#FFFFFF" + Math.floor(glowIntensity * 100).toString(16).padStart(2, "0"));
        innerGrad.addColorStop(0.5, cs.primary + Math.floor(glowIntensity * 200).toString(16).padStart(2, "0"));
        innerGrad.addColorStop(1, cs.primary + Math.floor(glowIntensity * 120).toString(16).padStart(2, "0"));

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = innerGrad;
        ctx.fill();

        const auroraAngle = t * 0.0005;
        for (let i = 0; i < cs.hues.length; i++) {
          const a = auroraAngle + (i / cs.hues.length) * Math.PI * 2;
          const ax = cx + Math.cos(a) * radius * 0.6;
          const ay = cy + Math.sin(a) * radius * 0.6;
          const aGrad = ctx.createRadialGradient(ax, ay, 0, ax, ay, radius * 0.5);
          aGrad.addColorStop(0, cs.hues[i] + Math.floor(glowIntensity * 60).toString(16).padStart(2, "0"));
          aGrad.addColorStop(1, cs.hues[i] + "00");
          ctx.beginPath();
          ctx.arc(ax, ay, radius * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = aGrad;
          ctx.fill();
        }

        if (formProgress > 0.8 && !showNameRef.current) {
          showNameRef.current = true;
          setShowName(true);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.015;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.life * 180).toString(16).padStart(2, "0");
        ctx.fill();
      }

      if (currentPhase === "formation" || currentPhase === "memories" || currentPhase === "awakening") {
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 60 + Math.random() * 40;
          particles.push({
            x: cx + Math.cos(angle) * dist,
            y: cy + Math.sin(angle) * dist,
            vx: Math.cos(angle) * 0.5,
            vy: Math.sin(angle) * 0.5,
            life: 1,
            maxLife: 1,
            color: cs.hues[Math.floor(Math.random() * cs.hues.length)],
            size: 1.5 + Math.random() * 2,
          });
        }
      }

      if (t < totalDuration) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [initOrbs, timing, isPreSymbolic]);

  useEffect(() => {
    if (isPreSymbolic || isNonVerbal) return;

    const narrations: { time: number; text: string }[] = [];

    if (isLowVerbal) {
      narrations.push(
        { time: timing.convergence.start + 500, text: "Something amazing is happening..." },
        { time: timing.formation.start + 1500, text: `Look, ${learnerName}! This is yours!` },
        { time: timing.awakening.start + 500, text: `Your Brain is awake, ${learnerName}!` },
      );
    } else {
      narrations.push(
        { time: timing.convergence.start + 500, text: "Something amazing is happening..." },
        { time: timing.formation.start + 2000, text: `This is your Brain, ${learnerName}. It learned so much about you today.` },
        { time: timing.memories.start + 200, text: memories.length > 0 ? `It remembers every ${memories[0]?.label}...` : "" },
        { time: timing.memories.start + 1500, text: memories.length > 1 ? `Every ${memories[1]?.label}...` : "" },
        { time: timing.memories.start + 2500, text: memories.length > 2 ? `And how you feel about learning...` : "" },
        { time: timing.awakening.start + 1000, text: `Your Brain is awake, ${learnerName}. And it is going to grow with you.` },
        { time: timing.reveal.start + 1000, text: `Every time we learn together, your Brain gets smarter. It will always be yours.` },
      );
    }

    const timers = narrations
      .filter((n) => n.text)
      .map((n) => setTimeout(() => setNarration(n.text), n.time));

    return () => timers.forEach(clearTimeout);
  }, [timing, learnerName, memories, isLowVerbal, isNonVerbal, isPreSymbolic]);

  useEffect(() => {
    if (isPreSymbolic) return;
    if (timing.memories.duration > 0) {
      const memTimers = memories.map((_, i) =>
        setTimeout(() => setShowMemory(i), timing.memories.start + i * 1500)
      );
      return () => memTimers.forEach(clearTimeout);
    }
  }, [timing, memories, isPreSymbolic]);

  useEffect(() => {
    if (isPreSymbolic) return;
    const badgeTimer = setTimeout(() => setShowBadge(true), timing.reveal.start + 2000);
    const btnTimer = setTimeout(() => {
      setShowButton(true);
    }, (timing.welcome.start || timing.reveal.start) + (timing.welcome.duration || 2000));
    return () => { clearTimeout(badgeTimer); clearTimeout(btnTimer); };
  }, [timing, isPreSymbolic]);

  if (isPreSymbolic) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-cyan-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-6xl mb-6">🧠</div>
          <h2 className="text-2xl font-heading font-bold text-slate-900 mb-3">
            {learnerName}&apos;s Brain Profile is Ready
          </h2>
          <p className="text-slate-600 font-body leading-relaxed mb-6">
            We have built a Brain profile for {learnerName} based on your observations. {learnerName}&apos;s learning will happen through activities you do together. Your dashboard will show daily activity suggestions.
          </p>
          <button
            onClick={onComplete}
            className="px-8 py-3 bg-gradient-to-r from-primary to-purple-600 text-white font-heading font-bold rounded-xl hover:shadow-lg transition"
          >
            View Dashboard
          </button>
        </div>
      </div>
    );
  }

  const leadTutorData = TUTORS[leadTutor];

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: "#1A1A2E" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {phase === "gathering" && (
          <div className="absolute inset-0 flex items-center justify-center">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-white/20"
                style={{
                  left: `${(i * 37 + 13) % 100}%`,
                  top: `${(i * 41 + 7) % 100}%`,
                  animation: `twinkle ${3 + (i % 4)}s ease-in-out infinite`,
                  animationDelay: `${(i * 0.2) % 3}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        {showName && (
          <div
            className="transition-all duration-2000"
            style={{
              opacity: 1,
              transform: "translateY(-120px)",
            }}
          >
            <h1
              className="text-4xl md:text-5xl font-heading font-bold text-white/90 tracking-wide"
              style={{
                textShadow: `0 0 40px ${colorSig.primary}80, 0 0 80px ${colorSig.primary}40`,
              }}
            >
              {learnerName}
            </h1>
          </div>
        )}

        {phase === "memories" && timing.memories.duration > 0 && (
          <div className="absolute" style={{ top: "calc(50% + 10px)" }}>
            {memories.map((mem, i) => (
              <div
                key={mem.domain}
                className="flex items-center gap-3 mb-2 transition-all duration-700"
                style={{
                  opacity: showMemory >= i ? 1 : 0,
                  transform: `scale(${showMemory >= i ? 1 : 0.5})`,
                }}
              >
                <span className="text-3xl">{mem.emoji}</span>
                <span className="text-white/50 text-sm font-body italic">{mem.label}</span>
              </div>
            ))}
          </div>
        )}

        {!isNonVerbal && narration && (
          <div
            className="absolute bottom-32 left-1/2 -translate-x-1/2 max-w-md px-6"
            key={narration}
          >
            <div className="bg-black/30 backdrop-blur-xl rounded-2xl px-6 py-4 flex items-start gap-3">
              {leadTutorData && (
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: leadTutorData.color }}>
                  <Image src={leadTutorData.avatar} alt={tutorName} width={40} height={40} className="object-cover" />
                </div>
              )}
              <div>
                <p className="text-[10px] font-heading font-bold text-white/40 uppercase mb-1">{tutorName}</p>
                <p className="text-white/80 text-sm font-body leading-relaxed animate-fadeIn">{narration}</p>
              </div>
            </div>
          </div>
        )}

        {showBadge && (
          <div
            className="absolute transition-all duration-1000"
            style={{
              bottom: showButton ? "160px" : "140px",
              opacity: showBadge ? 1 : 0,
              transform: `scale(${showBadge ? 1 : 0})`,
            }}
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur border border-amber-500/30 rounded-2xl px-5 py-3">
              <span className="text-2xl">🏅</span>
              <div>
                <p className="text-sm font-heading font-bold text-amber-400">Baseline Complete</p>
                <p className="text-[10px] text-white/40">Your first badge!</p>
              </div>
            </div>
          </div>
        )}

        {showButton && (
          <div className="absolute bottom-16 pointer-events-auto">
            <div className="text-center mb-4">
              <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2 mb-3 justify-center">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-[11px] text-amber-300 font-semibold">
                  Your parent will review your Brain before your learning begins
                </p>
              </div>
            </div>
            <button
              onClick={onComplete}
              className="px-10 py-4 rounded-full text-white text-lg font-heading font-bold shadow-2xl bg-gradient-to-r from-amber-400 to-orange-500 shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all"
            >
              All Done! 🎉
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
