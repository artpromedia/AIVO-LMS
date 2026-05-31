/* eslint-disable no-restricted-syntax -- self-contained cinematic animation
   surface ported from aivo-ai-learning. Domain accent hues (ELA amber, math
   blue, science green, SEL pink, speech purple, executive cyan) are a fixed
   signature for this sequence; the learner's own palette flows through the
   PixiBrainSphere via visualIdentity props. */
"use client";

/**
 * BrainBuildingSequence (web-v2)
 * ------------------------------
 * Cinematic, multi-stage "watch your child's Brain being built" experience,
 * ported from `aivo-ai-learning/apps/web/src/components/brain/BrainBuildingSequence.tsx`
 * and adapted to web-v2's data model (camelCase `*Detailed` XAI arrays from
 * `state.xaiExplanation`, `@aivo/brand` TUTORS) and design language.
 *
 * Stages auto-advance:
 *   template → domains → accommodations → activation → tutors → complete
 *
 * The `activation` and `complete` stages render the GPU-accelerated
 * PixiBrainSphere (the learner's living brain), so the sequence culminates
 * in the same WebGL brain the learner sees in their Awakening. The final
 * stage hands control back to the caller (`onSequenceComplete`) which
 * reveals the approve / amend gate.
 *
 * Honours `prefers-reduced-motion`: stages still advance but on a faster,
 * motion-free cadence, and the sphere falls back to a static CSS orb.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Brain, Lock, ClipboardList, Undo2, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { TUTORS, type TutorKey } from "@aivo/brand";
import PixiBrainSphere from "./pixi-brain-sphere";

export interface MasteryDecisionDTO {
  domain: string;
  score: number;
  displayLabel: string;
  reasoning: string;
}
export interface AccommodationDecisionDTO {
  accommodation: string;
  displayLabel: string;
  reasoning: string;
  source?: string;
}
export interface TutorDecisionDTO {
  tutorKey: string;
  reasoning: string;
}

export interface BrainBuildingSequenceProps {
  learnerName: string;
  /** Enrolled grade as a number (best-effort; defaults to 6 if unknown). */
  enrolledGrade: number;
  functioningLevel: string;
  masteryDecisions: MasteryDecisionDTO[];
  accommodationDecisions: AccommodationDecisionDTO[];
  tutorDecisions: TutorDecisionDTO[];
  primaryHue: string;
  secondaryHues: string[];
  pulseRate?: "calm" | "steady" | "energetic";
  onSequenceComplete: () => void;
}

type BuildStage =
  | "template"
  | "domains"
  | "accommodations"
  | "activation"
  | "tutors"
  | "complete";

const STAGE_ORDER: BuildStage[] = [
  "template",
  "domains",
  "accommodations",
  "activation",
  "tutors",
  "complete",
];

// Domain accent hues — fixed signature shared with the master→child clone.
const DOMAIN_COLORS: Record<string, string> = {
  ela: "#F59E0B",
  reading: "#F59E0B",
  math: "#3B82F6",
  science: "#10B981",
  sel: "#EC4899",
  social: "#EC4899",
  speech: "#8B5CF6",
  communication: "#8B5CF6",
  executive_function: "#06B6D4",
  history: "#EF4444",
  coding: "#7C3AED",
};

function domainColor(domain: string): string {
  return DOMAIN_COLORS[domain.toLowerCase()] ?? "#8B5CF6";
}

function scoreToGradeEquiv(score: number, enrolled: number): number {
  return Math.round(score * enrolled * 10) / 10;
}

function formatFL(fl: string): string {
  return fl.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BrainBuildingSequence({
  learnerName,
  enrolledGrade,
  functioningLevel,
  masteryDecisions,
  accommodationDecisions,
  tutorDecisions,
  primaryHue,
  secondaryHues,
  pulseRate = "steady",
  onSequenceComplete,
}: BrainBuildingSequenceProps) {
  const t = useTranslations("brain_clone");
  const [currentStage, setCurrentStage] = useState<BuildStage>("template");
  const [domainsRevealed, setDomainsRevealed] = useState(0);
  const [accommodationsRevealed, setAccommodationsRevealed] = useState(0);
  const [tutorsRevealed, setTutorsRevealed] = useState(0);
  const [activationPulse, setActivationPulse] = useState(false);
  const [stageVisible, setStageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enrolled = enrolledGrade > 0 ? enrolledGrade : 6;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Reduced-motion shortens every dwell so the sequence still completes.
  const ms = useCallback((normal: number) => (reducedMotion ? Math.min(700, normal) : normal), [reducedMotion]);

  const advanceStage = useCallback(() => {
    const idx = STAGE_ORDER.indexOf(currentStage);
    if (idx < STAGE_ORDER.length - 1) {
      setStageVisible(false);
      setTimeout(() => {
        setCurrentStage(STAGE_ORDER[idx + 1]);
        setStageVisible(true);
      }, 350);
    }
  }, [currentStage]);

  useEffect(() => {
    if (currentStage === "template") {
      autoTimerRef.current = setTimeout(() => advanceStage(), ms(3200));
    }
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [currentStage, advanceStage, ms]);

  useEffect(() => {
    if (currentStage !== "domains") return;
    const total = masteryDecisions.length;
    if (total === 0) {
      const x = setTimeout(() => advanceStage(), ms(1500));
      return () => clearTimeout(x);
    }
    if (domainsRevealed < total) {
      const x = setTimeout(() => setDomainsRevealed((d) => d + 1), ms(1100));
      return () => clearTimeout(x);
    }
    const x = setTimeout(() => advanceStage(), ms(1800));
    return () => clearTimeout(x);
  }, [currentStage, domainsRevealed, masteryDecisions.length, advanceStage, ms]);

  useEffect(() => {
    if (currentStage !== "accommodations") return;
    const total = accommodationDecisions.length;
    if (total === 0) {
      const x = setTimeout(() => advanceStage(), ms(1800));
      return () => clearTimeout(x);
    }
    if (accommodationsRevealed < total) {
      const x = setTimeout(() => setAccommodationsRevealed((a) => a + 1), ms(800));
      return () => clearTimeout(x);
    }
    const x = setTimeout(() => advanceStage(), ms(1800));
    return () => clearTimeout(x);
  }, [currentStage, accommodationsRevealed, accommodationDecisions.length, advanceStage, ms]);

  useEffect(() => {
    if (currentStage !== "activation") return;
    setActivationPulse(true);
    const x = setTimeout(() => advanceStage(), ms(3200));
    return () => clearTimeout(x);
  }, [currentStage, advanceStage, ms]);

  useEffect(() => {
    if (currentStage !== "tutors") return;
    const total = tutorDecisions.length;
    if (total === 0) {
      const x = setTimeout(() => advanceStage(), ms(1800));
      return () => clearTimeout(x);
    }
    if (tutorsRevealed < total) {
      const x = setTimeout(() => setTutorsRevealed((t2) => t2 + 1), ms(800));
      return () => clearTimeout(x);
    }
    const x = setTimeout(() => advanceStage(), ms(1800));
    return () => clearTimeout(x);
  }, [currentStage, tutorsRevealed, tutorDecisions.length, advanceStage, ms]);

  const stageIdx = STAGE_ORDER.indexOf(currentStage);
  const overallProgress = (stageIdx / (STAGE_ORDER.length - 1)) * 100;

  const sphereLabel = t("clone_child_label", { name: learnerName });

  return (
    <div
      className="bbs-root"
      style={{ "--bbs-primary": primaryHue } as React.CSSProperties}
    >
      <header className="bbs-header">
        <div className="bbs-badge" aria-hidden="true">
          <Brain className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="bbs-title">{t("building_title", { name: learnerName })}</h1>
          <p className="bbs-subtitle">{t("building_subtitle")}</p>
        </div>
        {currentStage !== "complete" && (
          <button
            type="button"
            onClick={() => {
              if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
              setCurrentStage("complete");
            }}
            className="bbs-skip"
          >
            {t("clone_skip")}
          </button>
        )}
      </header>

      <div className="bbs-progress" aria-hidden="true">
        <div className="bbs-progress-fill" style={{ width: `${overallProgress}%` }} />
      </div>

      <div className={`bbs-stage ${stageVisible ? "is-visible" : ""}`} aria-live="polite">
        {currentStage === "template" && (
          <div className="bbs-center">
            <div className="bbs-template-rings">
              <span className="bbs-ring bbs-ring-1" />
              <span className="bbs-ring bbs-ring-2" />
              <Brain className="bbs-template-brain" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <p className="bbs-pill">
              {t("building_template_pill", {
                grade: enrolled,
                level: formatFL(functioningLevel),
              })}
            </p>
            <p className="bbs-muted">{t("building_template_caption", { name: learnerName })}</p>
          </div>
        )}

        {currentStage === "domains" && (
          <div>
            <div className="bbs-stage-head">
              <h2 className="bbs-h2">{t("building_domains_title")}</h2>
              <p className="bbs-muted">{t("building_domains_caption")}</p>
            </div>
            <div className="bbs-grid">
              {masteryDecisions.map((m, i) => {
                const grade = scoreToGradeEquiv(m.score, enrolled);
                const gap = Math.round((enrolled - grade) * 10) / 10;
                const fillPct = Math.max(5, (grade / enrolled) * 100);
                const color = domainColor(m.domain);
                const revealed = i < domainsRevealed;
                return (
                  <div key={m.domain} className={`bbs-card ${revealed ? "is-in" : ""}`}>
                    <div className="bbs-card-head">
                      <span className="bbs-dot" style={{ background: color }} />
                      <span className="bbs-card-title">{m.displayLabel || m.domain}</span>
                    </div>
                    <div className="bbs-bar">
                      <div
                        className="bbs-bar-fill"
                        style={{ width: revealed ? `${fillPct}%` : "0%", background: color }}
                      />
                    </div>
                    <div className="bbs-card-meta">
                      <span>{t("building_level", { grade })}</span>
                      <span>{t("building_enrolled", { grade: enrolled })}</span>
                      {gap > 0 && <span className="bbs-gap">{t("building_gap", { years: gap })}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentStage === "accommodations" && (
          <div>
            <div className="bbs-stage-head">
              <h2 className="bbs-h2">{t("building_accommodations_title")}</h2>
              <p className="bbs-muted">{t("building_accommodations_caption")}</p>
            </div>
            {accommodationDecisions.length === 0 ? (
              <div className="bbs-center">
                <Star className="w-12 h-12 bbs-star" strokeWidth={2} aria-hidden="true" />
                <p className="bbs-muted">{t("building_accommodations_none")}</p>
              </div>
            ) : (
              <div className="bbs-grid">
                {accommodationDecisions.map((a, i) => (
                  <div
                    key={a.accommodation}
                    className={`bbs-card ${i < accommodationsRevealed ? "is-in" : ""}`}
                  >
                    <p className="bbs-card-title">{a.displayLabel}</p>
                    <p className="bbs-muted bbs-reason">{a.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentStage === "activation" && (
          <div className="bbs-center">
            <PixiBrainSphere
              primaryHue={primaryHue}
              secondaryHues={secondaryHues}
              pulseRate={pulseRate}
              intensity={activationPulse ? 1 : 0.55}
              size={200}
              ariaLabel={sphereLabel}
              className="bbs-sphere"
            />
            <h2 className="bbs-h2">{t("building_activation_title")}</h2>
            <p className="bbs-muted">{t("building_activation_caption", { name: learnerName })}</p>
            <div className="bbs-chips">
              <span className="bbs-chip">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" /> {t("building_activation_encrypted")}
              </span>
              <span className="bbs-chip">
                <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" /> {t("building_activation_version")}
              </span>
              <span className="bbs-chip">
                <Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> {t("building_activation_rollback")}
              </span>
            </div>
          </div>
        )}

        {currentStage === "tutors" && (
          <div>
            <div className="bbs-stage-head">
              <h2 className="bbs-h2">{t("building_tutors_title")}</h2>
              <p className="bbs-muted">{t("building_tutors_caption", { name: learnerName })}</p>
            </div>
            <div className="bbs-grid">
              {tutorDecisions.map((td, i) => {
                const tutor = TUTORS[td.tutorKey as TutorKey];
                if (!tutor) return null;
                return (
                  <div
                    key={td.tutorKey}
                    className={`bbs-card bbs-tutor ${i < tutorsRevealed ? "is-in" : ""}`}
                  >
                    <span
                      className="bbs-tutor-avatar"
                      style={{ borderColor: tutor.color }}
                    >
                      <Image src={tutor.avatar} alt="" width={44} height={44} />
                    </span>
                    <div className="bbs-tutor-body">
                      <span className="bbs-card-title">{tutor.name}</span>
                      {tutor.domain && <span className="bbs-tutor-domain">{tutor.domain}</span>}
                      <p className="bbs-muted bbs-reason">{td.reasoning}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {currentStage === "complete" && (
          <div className="bbs-center">
            <PixiBrainSphere
              primaryHue={primaryHue}
              secondaryHues={secondaryHues}
              pulseRate={pulseRate}
              intensity={1}
              size={160}
              ariaLabel={sphereLabel}
              className="bbs-sphere"
            />
            <h2 className="bbs-h2 bbs-h2-lg">{t("building_complete_title", { name: learnerName })}</h2>
            <p className="bbs-muted">{t("building_complete_caption", { name: learnerName })}</p>
            <button type="button" onClick={onSequenceComplete} className="bbs-cta">
              {t("building_complete_cta")}
            </button>
          </div>
        )}
      </div>

      <div className="bbs-dots" aria-hidden="true">
        {STAGE_ORDER.slice(0, -1).map((stage, i) => (
          <span
            key={stage}
            className={`bbs-step ${i < stageIdx ? "is-done" : i === stageIdx ? "is-active" : ""}`}
          />
        ))}
      </div>

      <style>{`
        .bbs-root {
          min-height: 70vh;
          max-width: 760px;
          margin: 0 auto;
          padding: 1.25rem 1rem 2.5rem;
          color: #f4f6ff;
          border-radius: 24px;
          background-image:
            radial-gradient(ellipse at top, rgba(63,45,110,0.55), transparent 70%),
            linear-gradient(to bottom right, #1a0a3e, #0f172a, #0c1222);
        }
        .bbs-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
        .bbs-badge {
          width: 40px; height: 40px; border-radius: 9999px; flex-shrink: 0;
          display: grid; place-items: center; color: #fff;
          background: linear-gradient(135deg, #8b5cf6, #06b6d4);
        }
        .bbs-title { font-size: 1.1rem; font-weight: 700; margin: 0; }
        .bbs-subtitle { font-size: 0.78rem; color: rgba(255,255,255,0.45); margin: 0.1rem 0 0; }
        .bbs-skip {
          margin-left: auto; font-size: 0.78rem; color: rgba(255,255,255,0.4);
          background: none; border: none; cursor: pointer;
        }
        .bbs-skip:hover { color: rgba(255,255,255,0.7); }
        .bbs-progress {
          width: 100%; height: 6px; border-radius: 9999px; overflow: hidden;
          background: rgba(255,255,255,0.1); margin-bottom: 1.5rem;
        }
        .bbs-progress-fill {
          height: 100%; border-radius: 9999px; transition: width 900ms ease;
          background: linear-gradient(90deg, #8b5cf6, #06b6d4, #10b981);
        }
        .bbs-stage { opacity: 0; transform: translateY(12px); transition: opacity 350ms ease, transform 350ms ease; }
        .bbs-stage.is-visible { opacity: 1; transform: translateY(0); }
        .bbs-center { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.6rem; padding: 1rem 0; }
        .bbs-sphere { margin-bottom: 0.3rem; }
        .bbs-stage-head { text-align: center; margin-bottom: 1.25rem; }
        .bbs-h2 { font-size: 1.2rem; font-weight: 700; margin: 0; }
        .bbs-h2-lg { font-size: 1.6rem; }
        .bbs-muted { color: rgba(255,255,255,0.55); font-size: 0.9rem; margin: 0.25rem 0 0; max-width: 44ch; line-height: 1.5; }
        .bbs-reason { font-size: 0.82rem; }
        .bbs-pill {
          display: inline-block; margin: 0.5rem 0 0; padding: 0.5rem 1rem;
          border-radius: 9999px; font-weight: 700; font-size: 0.85rem;
          color: #d8c8ff; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
        }
        .bbs-grid { display: grid; gap: 0.7rem; }
        .bbs-card {
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; padding: 0.9rem 1rem;
          opacity: 0; transform: translateX(-10px);
          transition: opacity 600ms ease, transform 600ms ease;
        }
        .bbs-card.is-in { opacity: 1; transform: translateX(0); }
        .bbs-card-head { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.55rem; }
        .bbs-dot { width: 12px; height: 12px; border-radius: 9999px; flex-shrink: 0; }
        .bbs-card-title { font-weight: 700; font-size: 0.92rem; }
        .bbs-bar { width: 100%; height: 16px; border-radius: 9999px; overflow: hidden; background: rgba(255,255,255,0.1); }
        .bbs-bar-fill { height: 100%; border-radius: 9999px; transition: width 1000ms ease 200ms; }
        .bbs-card-meta { display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.78rem; color: rgba(255,255,255,0.6); flex-wrap: wrap; }
        .bbs-gap { color: rgba(251,191,36,0.85); font-weight: 600; }
        .bbs-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.75rem; margin-top: 0.4rem; font-size: 0.72rem; color: rgba(255,255,255,0.5); }
        .bbs-chip { display: inline-flex; align-items: center; gap: 0.3rem; }
        .bbs-star { color: #fbbf24; }
        .bbs-tutor { display: flex; align-items: center; gap: 0.9rem; }
        .bbs-tutor-avatar { width: 44px; height: 44px; border-radius: 9999px; overflow: hidden; border: 2px solid; flex-shrink: 0; display: block; }
        .bbs-tutor-body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
        .bbs-tutor-domain { font-size: 0.7rem; color: rgba(255,255,255,0.45); }
        .bbs-cta {
          margin-top: 0.6rem; padding: 0.9rem 2rem; border: none; border-radius: 9999px;
          font-weight: 700; font-size: 1rem; color: #fff; cursor: pointer;
          background: linear-gradient(90deg, #10b981, #06b6d4);
          box-shadow: 0 14px 40px rgba(6,182,212,0.3);
          transition: transform 200ms ease;
        }
        .bbs-cta:hover { transform: translateY(-1px); }
        .bbs-template-rings { position: relative; width: 180px; height: 180px; display: grid; place-items: center; margin-bottom: 0.4rem; }
        .bbs-ring { position: absolute; border-radius: 9999px; border: 2px dashed rgba(167,139,250,0.4); }
        .bbs-ring-1 { inset: 0; animation: bbsSpin 20s linear infinite; }
        .bbs-ring-2 { inset: 16px; border-color: rgba(6,182,212,0.3); animation: bbsSpin 15s linear infinite reverse; }
        .bbs-template-brain { width: 64px; height: 64px; color: #fff; animation: bbsPulse 2.2s ease-in-out infinite; }
        .bbs-dots { display: flex; justify-content: center; gap: 0.5rem; margin-top: 2rem; }
        .bbs-step { width: 10px; height: 10px; border-radius: 9999px; background: rgba(255,255,255,0.2); transition: all 500ms ease; }
        .bbs-step.is-done { background: #34d399; }
        .bbs-step.is-active { background: #22d3ee; transform: scale(1.3); }
        @keyframes bbsSpin { to { transform: rotate(360deg); } }
        @keyframes bbsPulse { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
        @media (prefers-reduced-motion: reduce) {
          .bbs-ring-1, .bbs-ring-2, .bbs-template-brain { animation: none; }
          .bbs-card { transition-duration: 200ms; }
        }
      `}</style>
    </div>
  );
}
