"use client";
import type { Beat, SensoryAdaptations } from "./types";

interface StageContentProps {
  beat: Beat | null;
  adaptations: SensoryAdaptations;
  phase: string;
}

export function StageContent({ beat, adaptations, phase }: StageContentProps) {
  if (!beat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse vi-text-muted text-lg font-body">Preparing the stage...</div>
      </div>
    );
  }

  const maxElements = adaptations.maxOnScreenElements;
  const visuals = beat.visuals.slice(0, maxElements);
  const speed = adaptations.animationSpeed;

  const getAnimClass = (anim?: string) => {
    if (adaptations.motionReduced) return "animate-fade-in";
    switch (anim) {
      case "bounce": return "animate-bounce-in";
      case "slide_in": return "animate-slide-up";
      case "pulse": return "animate-pulse-gentle";
      case "float": return "animate-float";
      case "glow": return "animate-glow";
      default: return "animate-fade-in";
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 relative"
      style={{ filter: `saturate(${adaptations.colorSaturation}%)` }}>

      {visuals.map((el, i) => (
        <div
          key={el.id}
          className={`${getAnimClass(el.animation)} transition-all`}
          style={{
            animationDelay: `${i * (200 / speed)}ms`,
            animationDuration: `${600 / speed}ms`,
          }}
        >
          {el.type === "card" && (
            <div
              className={`vi-card px-6 py-5 max-w-md text-center
                ${adaptations.contrastBoost ? "vi-surface-soft" : ""}
                ${adaptations.pulseAttention ? "animate-pulse-gentle" : ""}
              `}
              style={{
                ...(el.color ? { borderColor: el.color } : {}),
                borderWidth: adaptations.boldOutlines ? 3 : 2,
              }}
            >
              {el.emoji && <div className="text-5xl mb-3">{el.emoji}</div>}
              <p className={`text-slate-900 font-heading font-extrabold leading-relaxed ${
                adaptations.contrastBoost ? "text-xl" : "text-lg"
              }`}>
                {el.content}
              </p>
            </div>
          )}

          {el.type === "text" && (
            <p className={`text-slate-800 font-body text-center max-w-lg leading-relaxed
              ${adaptations.contrastBoost ? "text-xl font-bold" : "text-lg"}
            `}>
              {el.content}
            </p>
          )}

          {el.type === "shape" && (
            <div className="flex items-center justify-center">
              <div
                className={`w-24 h-24 rounded-2xl vi-card border-2 flex items-center justify-center text-4xl
                  ${adaptations.pulseAttention ? "animate-pulse-gentle" : ""}
                `}
                style={el.color ? { backgroundColor: `${el.color}1A`, borderColor: el.color } : undefined}
              >
                {el.emoji || el.content}
              </div>
            </div>
          )}

          {el.type === "manipulative" && (
            <div className="flex gap-3 flex-wrap justify-center">
              {el.content.split(",").map((part, j) => (
                <div
                  key={j}
                  className={`w-16 h-16 rounded-xl vi-card border-2 vi-border flex items-center justify-center text-2xl cursor-pointer hover:scale-110 active:scale-95 transition-transform
                    ${adaptations.pulseAttention ? "animate-pulse-gentle" : ""}
                  `}
                  style={el.color ? { borderColor: el.color } : undefined}
                >
                  {part.trim()}
                </div>
              ))}
            </div>
          )}

          {el.type === "diagram" && (
            <div className="vi-card p-6 max-w-sm">
              {el.emoji && <div className="text-4xl text-center mb-2">{el.emoji}</div>}
              <p className="text-slate-800 font-body text-center">{el.content}</p>
            </div>
          )}

          {el.type === "image" && (
            <div className="vi-card overflow-hidden max-w-sm">
              {el.emoji && <div className="text-6xl text-center py-6">{el.emoji}</div>}
              {el.content && <p className="text-slate-800 font-body text-center px-4 pb-3">{el.content}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
