"use client";
import { Sprout, Leaf, TreePine, Star, Trophy, type LucideIcon } from "lucide-react";

interface ProgressPathProps {
  progress: number;
  totalSteps: number;
  currentStep: number;
  accentColor: string;
  beatsUntilBreak?: number;
}

const LANDMARKS: LucideIcon[] = [Sprout, Leaf, TreePine, Star, Trophy];

export function ProgressPath({
  progress,
  totalSteps,
  currentStep,
  accentColor,
  beatsUntilBreak,
}: ProgressPathProps) {
  const steps = Math.min(totalSteps, 5);
  const points = Array.from({ length: steps }, (_, i) => ({
    x: (i / (steps - 1 || 1)) * 100,
    active: i <= Math.floor(progress * (steps - 1)),
    current: i === Math.floor(progress * (steps - 1)),
    Icon: LANDMARKS[i % LANDMARKS.length],
  }));

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1 w-48 relative h-8">
        <div className="absolute top-1/2 left-0 right-0 h-1 rounded-full bg-white/20 -translate-y-1/2">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress * 100}%`, backgroundColor: accentColor }}
          />
        </div>
        {points.map((p, i) => (
          <div
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 flex flex-col items-center"
            style={{ left: `${p.x}%` }}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-500 ${
                p.current
                  ? "scale-125 animate-pulse"
                  : p.active
                    ? "scale-100"
                    : "scale-75 opacity-50"
              }`}
              style={{
                backgroundColor: p.active ? accentColor : "rgba(255,255,255,0.2)",
                boxShadow: p.current ? `0 0 12px ${accentColor}` : "none",
              }}
            >
              <p.Icon
                className={`w-3.5 h-3.5 ${p.active ? "text-white" : "text-white/60"}`}
                strokeWidth={2.5}
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>
      {beatsUntilBreak !== undefined && beatsUntilBreak > 0 && (
        <p className="text-[10px] text-white/40 font-bold">
          {beatsUntilBreak} {beatsUntilBreak === 1 ? "beat" : "beats"} until break
        </p>
      )}
    </div>
  );
}
