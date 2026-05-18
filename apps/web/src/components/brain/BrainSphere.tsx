"use client";

interface VisualIdentity {
  primaryHue: string;
  secondaryHues: string[];
  pulseRate: number;
  growthParticles?: { domain: string; color: string; intensity: number }[];
  memoryBank?: { domain: string; type: string; score: number }[];
}

interface BrainSphereProps {
  visualIdentity?: VisualIdentity | null;
  size?: number;
  animate?: boolean;
  className?: string;
}

export default function BrainSphere({
  visualIdentity,
  size = 40,
  animate = true,
  className = "",
}: BrainSphereProps) {
  const primary = visualIdentity?.primaryHue || "#7C3AED";
  const secondaries = visualIdentity?.secondaryHues || ["#6366F1"];
  const allColors = [primary, ...secondaries];
  const pulseSeconds = animate ? Math.max(2, 4 - (visualIdentity?.pulseRate || 1) * 1.5) : 0;

  return (
    <div
      className={`relative rounded-full flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 35%, ${primary}40, ${primary}CC, ${secondaries[0] || primary}88)`,
        boxShadow: `0 0 ${size * 0.4}px ${primary}60, 0 0 ${size * 0.8}px ${primary}30, inset 0 0 ${size * 0.3}px rgba(255,255,255,0.15)`,
        animation: animate ? `brainSphPulse ${pulseSeconds}s ease-in-out infinite` : undefined,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${allColors.map((c, i) => `${c}${i === 0 ? "CC" : "66"} ${(i / allColors.length) * 360}deg`).join(", ")}, ${primary}CC 360deg)`,
          opacity: 0.5,
          animation: animate ? "brainSphRotate 8s linear infinite" : undefined,
        }}
      />
      <div
        className="absolute inset-[15%] rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 40%, rgba(255,255,255,0.3), ${primary}AA, transparent)`,
        }}
      />
      <style jsx>{`
        @keyframes brainSphPulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        @keyframes brainSphRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
