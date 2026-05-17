"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { Brain, Star, FileText, Check, Lock, ClipboardList, Undo2, Dumbbell, Sprout, Target, BarChart3, RefreshCw } from "lucide-react";
import { subjectIcon } from "@/lib/subject-icons";

interface MasteryDecision {
  domain: string;
  score: number;
  display_label: string;
  reasoning: string;
  source: string;
  raw_score?: string;
  difficulty?: string;
}

interface AccommodationDecision {
  accommodation: string;
  display_label: string;
  reasoning: string;
  source: string;
  removable: boolean;
}

interface TutorDecision {
  tutor_key: string;
  reasoning: string;
  source: string;
}

interface XaiExplanation {
  summary: string;
  mastery_decisions: MasteryDecision[];
  accommodation_decisions: AccommodationDecision[];
  tutor_decisions: TutorDecision[];
}

interface BrainBuildingProps {
  learnerName: string;
  gradeLevel: string;
  functioningLevel: string;
  masteryLevels: Record<string, number>;
  xaiExplanation: XaiExplanation;
  activeTutors: string[];
  activeAccommodations: string[];
  onSequenceComplete: () => void;
}

type BuildStage = "template" | "domains" | "accommodations" | "goals" | "activation" | "tutors" | "complete";

const STAGE_ORDER: BuildStage[] = ["template", "domains", "accommodations", "goals", "activation", "tutors", "complete"];

const DOMAIN_COLORS: Record<string, { fill: string; text: string; bg: string; border: string }> = {
  ela: { fill: "#F59E0B", text: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  math: { fill: "#3B82F6", text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  science: { fill: "#10B981", text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  sel: { fill: "#EC4899", text: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200" },
  speech: { fill: "#8B5CF6", text: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  executive_function: { fill: "#06B6D4", text: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
  social: { fill: "#EC4899", text: "text-pink-600", bg: "bg-pink-50", border: "border-pink-200" },
  communication: { fill: "#8B5CF6", text: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  history: { fill: "#EF4444", text: "text-rose-600", bg: "bg-rose-50", border: "border-rose-200" },
  coding: { fill: "#7C3AED", text: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
};

const DOMAIN_LABELS: Record<string, string> = {
  ela: "Reading",
  math: "Math",
  science: "Science",
  sel: "Social-Emotional",
  speech: "Communication",
  executive_function: "Executive Function",
  social: "Social Skills",
  communication: "Communication",
  history: "History",
  coding: "Coding",
};

function scoreToGradeEquiv(score: number, enrolledGrade: number): number {
  return Math.round(score * enrolledGrade * 10) / 10;
}

function formatFL(fl: string): string {
  return fl.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function BrainBuildingSequence({
  learnerName,
  gradeLevel,
  functioningLevel,
  masteryLevels,
  xaiExplanation,
  activeTutors,
  activeAccommodations,
  onSequenceComplete,
}: BrainBuildingProps) {
  const [currentStage, setCurrentStage] = useState<BuildStage>("template");
  const [stageProgress, setStageProgress] = useState(0);
  const [domainsRevealed, setDomainsRevealed] = useState(0);
  const [accommodationsRevealed, setAccommodationsRevealed] = useState(0);
  const [goalsRevealed, setGoalsRevealed] = useState(0);
  const [tutorsRevealed, setTutorsRevealed] = useState(0);
  const [activationPulse, setActivationPulse] = useState(false);
  const [stageVisible, setStageVisible] = useState(true);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enrolled = parseInt(gradeLevel || "6") || 6;
  const masteryDecisions = xaiExplanation?.mastery_decisions || [];
  const accommodationDecisions = xaiExplanation?.accommodation_decisions || [];
  const tutorDecisions = xaiExplanation?.tutor_decisions || [];

  const advanceStage = useCallback(() => {
    const idx = STAGE_ORDER.indexOf(currentStage);
    if (idx < STAGE_ORDER.length - 1) {
      setStageVisible(false);
      setTimeout(() => {
        setCurrentStage(STAGE_ORDER[idx + 1]);
        setStageProgress(0);
        setStageVisible(true);
      }, 400);
    }
  }, [currentStage]);

  useEffect(() => {
    if (currentStage === "template") {
      autoTimerRef.current = setTimeout(() => advanceStage(), 3500);
    }
    return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, [currentStage, advanceStage]);

  useEffect(() => {
    if (currentStage === "domains") {
      const total = masteryDecisions.length;
      if (domainsRevealed < total) {
        const timer = setTimeout(() => setDomainsRevealed(d => d + 1), 1200);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => advanceStage(), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentStage, domainsRevealed, masteryDecisions.length, advanceStage]);

  useEffect(() => {
    if (currentStage === "accommodations") {
      const total = accommodationDecisions.length;
      if (total === 0) {
        const timer = setTimeout(() => advanceStage(), 2000);
        return () => clearTimeout(timer);
      }
      if (accommodationsRevealed < total) {
        const timer = setTimeout(() => setAccommodationsRevealed(a => a + 1), 800);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => advanceStage(), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentStage, accommodationsRevealed, accommodationDecisions.length, advanceStage]);

  useEffect(() => {
    if (currentStage === "goals") {
      const total = masteryDecisions.filter(m => m.score < 0.9).length;
      if (total === 0) {
        const timer = setTimeout(() => advanceStage(), 2000);
        return () => clearTimeout(timer);
      }
      if (goalsRevealed < total) {
        const timer = setTimeout(() => setGoalsRevealed(g => g + 1), 1000);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => advanceStage(), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentStage, goalsRevealed, masteryDecisions, advanceStage]);

  useEffect(() => {
    if (currentStage === "activation") {
      setActivationPulse(true);
      const timer = setTimeout(() => advanceStage(), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStage, advanceStage]);

  useEffect(() => {
    if (currentStage === "tutors") {
      const total = tutorDecisions.length;
      if (total === 0) {
        const timer = setTimeout(() => advanceStage(), 2000);
        return () => clearTimeout(timer);
      }
      if (tutorsRevealed < total) {
        const timer = setTimeout(() => setTutorsRevealed(t => t + 1), 800);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => advanceStage(), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentStage, tutorsRevealed, tutorDecisions.length, advanceStage]);

  const stageIdx = STAGE_ORDER.indexOf(currentStage);
  const overallProgress = ((stageIdx) / (STAGE_ORDER.length - 1)) * 100;

  return (
    <div
      className="min-h-screen text-white overflow-hidden"
      style={{
        // The build sequence is intentionally cinematic/dark across all
        // tiers, but we tint the deep-space base with the active tier's
        // sky tone so K-5 reads as a softer aurora and 9-12 as cooler
        // editorial. Falls back to the original violet/slate gradient
        // when --tier-sky isn't set (e.g. preview routes without a
        // TierThemeProvider).
        backgroundImage:
          "radial-gradient(ellipse at top, color-mix(in srgb, var(--tier-sky, #3F2D6E) 55%, transparent), transparent 70%), linear-gradient(to bottom right, #1a0a3e, #0f172a, #0c1222)",
        backgroundColor: "#0c1222",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-white">
              <Brain className="w-5 h-5" strokeWidth={2.5} aria-hidden />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg">Building {learnerName}&apos;s Brain</h1>
              <p className="text-white/40 text-xs font-body">Real-time construction from assessment data</p>
            </div>
          </div>
          {currentStage !== "complete" && (
            <button
              onClick={() => {
                if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
                setCurrentStage("complete");
              }}
              className="text-white/30 hover:text-white/50 text-xs font-body transition"
            >
              Skip animation
            </button>
          )}
        </div>

        <div className="w-full bg-white/10 rounded-full h-1.5 mb-6 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 transition-all duration-1000"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        <div className={`transition-all duration-400 ${stageVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {currentStage === "template" && (
            <StageTemplate
              learnerName={learnerName}
              gradeLevel={enrolled}
              functioningLevel={functioningLevel}
            />
          )}

          {currentStage === "domains" && (
            <StageDomains
              learnerName={learnerName}
              enrolled={enrolled}
              masteryDecisions={masteryDecisions}
              domainsRevealed={domainsRevealed}
            />
          )}

          {currentStage === "accommodations" && (
            <StageAccommodations
              learnerName={learnerName}
              accommodationDecisions={accommodationDecisions}
              accommodationsRevealed={accommodationsRevealed}
            />
          )}

          {currentStage === "goals" && (
            <StageGoals
              learnerName={learnerName}
              enrolled={enrolled}
              masteryDecisions={masteryDecisions}
              goalsRevealed={goalsRevealed}
            />
          )}

          {currentStage === "activation" && (
            <StageActivation
              learnerName={learnerName}
              activationPulse={activationPulse}
            />
          )}

          {currentStage === "tutors" && (
            <StageTutors
              learnerName={learnerName}
              tutorDecisions={tutorDecisions}
              masteryLevels={masteryLevels}
              enrolled={enrolled}
              tutorsRevealed={tutorsRevealed}
            />
          )}

          {currentStage === "complete" && (
            <StageComplete
              learnerName={learnerName}
              onContinue={onSequenceComplete}
            />
          )}
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {STAGE_ORDER.slice(0, -1).map((stage, i) => (
            <div
              key={stage}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                i < stageIdx ? "bg-emerald-400" :
                i === stageIdx ? "bg-cyan-400 scale-125" :
                "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StageTemplate({ learnerName, gradeLevel, functioningLevel }: {
  learnerName: string; gradeLevel: number; functioningLevel: string;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 300); }, []);

  return (
    <div className="text-center py-8">
      <div className={`transition-all duration-1000 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}>
        <div className="relative mx-auto w-48 h-48 mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-purple-400/40 animate-spin" style={{ animationDuration: "20s" }} />
          <div className="absolute inset-4 rounded-full border border-dashed border-cyan-400/30 animate-spin" style={{ animationDuration: "15s", animationDirection: "reverse" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-16 h-16 text-white animate-pulse" strokeWidth={1.5} aria-hidden />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full mb-4 border border-white/20">
          <span className="text-purple-300 font-heading font-bold text-sm">
            Grade {gradeLevel} Brain Template — {formatFL(functioningLevel)}
          </span>
        </div>

        <p className="text-white/50 font-body text-sm max-w-md mx-auto">
          Selecting a baseline Brain template for {learnerName}&apos;s grade level and learning profile.
        </p>
      </div>
    </div>
  );
}

function GradeLadder({ domain, score, enrolled, label, color, revealed }: {
  domain: string; score: number; enrolled: number; label: string; color: string; revealed: boolean;
}) {
  const gradeEquiv = scoreToGradeEquiv(score, enrolled);
  const gap = Math.round((enrolled - gradeEquiv) * 10) / 10;
  const fillPct = Math.max(5, (gradeEquiv / enrolled) * 100);

  return (
    <div className={`bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 transition-all duration-700 ${
      revealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
    }`}>
      <div className="flex items-center gap-3 mb-3">
        {(() => { const I = subjectIcon(domain); return <I className="w-5 h-5" style={{ color }} strokeWidth={2.5} aria-hidden />; })()}
        <span className="font-heading font-bold text-sm text-white">{label}</span>
      </div>

      <div className="flex items-end gap-3 mb-2">
        <div className="flex-1">
          <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-1000 delay-300"
              style={{
                width: revealed ? `${fillPct}%` : "0%",
                backgroundColor: color,
              }}
            />
            <div className="absolute right-1 top-0 h-full flex items-center">
              <div className="w-0.5 h-3 bg-white/40" />
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-white/30">K</span>
            <span className="text-[10px] text-white/30">Grade {enrolled}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60 font-body">
          Level: <span className="font-bold text-white">{gradeEquiv}</span>
        </span>
        <span className="text-white/60 font-body">
          Enrolled: <span className="font-bold text-white">{enrolled}</span>
        </span>
        {gap > 0 && (
          <span className="text-amber-400/80 font-body font-semibold">
            Gap: {gap}yr
          </span>
        )}
      </div>
    </div>
  );
}

function StageDomains({ learnerName, enrolled, masteryDecisions, domainsRevealed }: {
  learnerName: string; enrolled: number; masteryDecisions: MasteryDecision[]; domainsRevealed: number;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-xl text-white mb-1">Assessment Results</h2>
        <p className="text-white/40 text-sm font-body">Loading domain scores from the Baseline Assessment</p>
      </div>

      <div className="grid gap-3">
        {masteryDecisions.map((m, i) => (
          <GradeLadder
            key={m.domain}
            domain={m.domain}
            score={m.score}
            enrolled={enrolled}
            label={m.display_label || DOMAIN_LABELS[m.domain] || m.domain}
            color={DOMAIN_COLORS[m.domain]?.fill || "#8B5CF6"}
            revealed={i < domainsRevealed}
          />
        ))}
      </div>

      {domainsRevealed >= masteryDecisions.length && (
        <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/10 animate-fadeIn">
          <p className="text-white/60 text-sm font-body text-center">
            {learnerName} is enrolled in Grade {enrolled}. Their Brain will deliver content at their actual functioning level per subject, not at Grade {enrolled} across the board. As mastery improves, the delivery level rises automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function StageAccommodations({ learnerName, accommodationDecisions, accommodationsRevealed }: {
  learnerName: string; accommodationDecisions: AccommodationDecision[]; accommodationsRevealed: number;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-xl text-white mb-1">Learning Preferences & Accommodations</h2>
        <p className="text-white/40 text-sm font-body">Configuring personalized supports based on evidence</p>
      </div>

      {accommodationDecisions.length === 0 ? (
        <div className="text-center py-8">
          <Star className="w-12 h-12 mx-auto mb-3 text-amber-400 fill-amber-300" strokeWidth={2} aria-hidden />
          <p className="text-white/50 font-body">No additional accommodations needed at this level.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {accommodationDecisions.map((a, i) => (
            <div
              key={a.accommodation}
              className={`bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 transition-all duration-500 ${
                i < accommodationsRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-heading font-bold text-sm text-white mb-1">
                    {a.display_label}
                  </p>
                  <p className="text-white/40 text-xs font-body leading-relaxed">
                    {a.reasoning}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                  a.source === "iep" ? "bg-amber-500/20 text-amber-300" :
                  a.source === "parent_assessment" ? "bg-purple-500/20 text-purple-300" :
                  "bg-blue-500/20 text-blue-300"
                }`}>
                  {a.source === "iep" ? "From IEP" : a.source === "parent_assessment" ? "Parent Reported" : "From Assessment"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {accommodationsRevealed >= accommodationDecisions.length && accommodationDecisions.length > 0 && (
        <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm font-body text-center">
            These accommodations will be applied to every lesson, tutor session, and activity automatically. You can adjust these at any time from your parent dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

function StageGoals({ learnerName, enrolled, masteryDecisions, goalsRevealed }: {
  learnerName: string; enrolled: number; masteryDecisions: MasteryDecision[]; goalsRevealed: number;
}) {
  const domainsWithGaps = masteryDecisions.filter(m => m.score < 0.9);

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-xl text-white mb-1">Goal Mapping & Learning Paths</h2>
        <p className="text-white/40 text-sm font-body">Plotting the step-by-step journey for each domain</p>
      </div>

      {domainsWithGaps.length === 0 ? (
        <div className="text-center py-8">
          <Star className="w-12 h-12 mx-auto mb-3 text-amber-400 fill-amber-300" strokeWidth={2} aria-hidden />
          <p className="text-white/50 font-body">All domains are performing at or near grade level!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {domainsWithGaps.map((m, i) => {
            const gradeEquiv = scoreToGradeEquiv(m.score, enrolled);
            const gap = Math.round((enrolled - gradeEquiv) * 10) / 10;
            const steps = Math.max(2, Math.ceil(gap * 2));
            const revealed = i < goalsRevealed;
            const color = DOMAIN_COLORS[m.domain]?.fill || "#8B5CF6";

            return (
              <div
                key={m.domain}
                className={`bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 transition-all duration-700 ${
                  revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {(() => { const I = subjectIcon(m.domain); return <I className="w-4 h-4" style={{ color }} strokeWidth={2.5} aria-hidden />; })()}
                  <span className="font-heading font-bold text-sm text-white">
                    {m.display_label || DOMAIN_LABELS[m.domain] || m.domain}
                  </span>
                  <span className="text-white/30 text-xs font-body ml-auto">
                    Grade {gradeEquiv} → Grade {enrolled}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2"
                    style={{ borderColor: color, backgroundColor: `${color}30`, color }}
                  >
                    {gradeEquiv}
                  </div>
                  {Array.from({ length: steps }).map((_, si) => (
                    <div key={si} className="flex items-center gap-1.5">
                      <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: `${color}40` }} />
                      <div
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border border-white/20"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${color}60` }} />
                      </div>
                    </div>
                  ))}
                  <div className="w-6 h-0.5 rounded-full" style={{ backgroundColor: `${color}40` }} />
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2"
                    style={{ borderColor: "#F59E0B", backgroundColor: "#F59E0B20", color: "#F59E0B" }}
                  >
                    {enrolled}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {goalsRevealed >= domainsWithGaps.length && domainsWithGaps.length > 0 && (
        <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm font-body text-center">
            {learnerName}&apos;s Brain has planned a step-by-step path for every subject. Content will be delivered at their actual level, targeting their enrolled grade objectives.
          </p>
        </div>
      )}
    </div>
  );
}

function StageActivation({ learnerName, activationPulse }: {
  learnerName: string; activationPulse: boolean;
}) {
  return (
    <div className="text-center py-8">
      <div className="relative mx-auto w-48 h-48 mb-6">
        <div className={`absolute inset-0 rounded-full transition-all duration-1000 ${
          activationPulse ? "bg-gradient-to-br from-purple-500/30 to-cyan-500/30 scale-110" : "bg-white/5 scale-100"
        }`} />
        <div className={`absolute inset-4 rounded-full transition-all duration-700 ${
          activationPulse ? "bg-gradient-to-br from-purple-500/40 to-emerald-500/40 scale-105" : "bg-white/5 scale-100"
        }`} />
        <div className={`absolute inset-8 rounded-full transition-all duration-500 ${
          activationPulse ? "bg-gradient-to-br from-cyan-500/50 to-purple-500/50 scale-100" : "bg-white/5 scale-100"
        }`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className={`text-white transition-all duration-500 ${activationPulse ? "scale-110" : "scale-100"}`} style={{ width: 64, height: 64 }} strokeWidth={1.5} aria-hidden />
        </div>
        {activationPulse && (
          <>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-purple-400/30"
                style={{
                  animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                  animationDelay: `${i * 0.6}s`,
                }}
              />
            ))}
          </>
        )}
      </div>

      <h2 className="font-heading font-bold text-xl text-white mb-2">System Activation</h2>
      <p className="text-white/50 text-sm font-body mb-4">
        Initializing {learnerName}&apos;s Brain — saving snapshot and activating learning engine
      </p>

      <div className="flex items-center justify-center gap-4 text-xs text-white/40 font-body">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" aria-hidden /> Encrypted (AES-256)
        </div>
        <div className="flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" aria-hidden /> Brain v1.0
        </div>
        <div className="flex items-center gap-1.5">
          <Undo2 className="w-3.5 h-3.5" aria-hidden /> Full rollback available
        </div>
      </div>

      <div className="mt-6 bg-white/5 rounded-xl p-4 border border-white/10">
        <p className="text-white/60 text-sm font-body text-center">
          {learnerName}&apos;s Brain is now active. It will update after every learning session. All changes are versioned. You can roll back to any previous state at any time. Your child&apos;s Brain data is encrypted and you can export or delete it at any time.
        </p>
      </div>
    </div>
  );
}

function StageTutors({ learnerName, tutorDecisions, masteryLevels, enrolled, tutorsRevealed }: {
  learnerName: string; tutorDecisions: TutorDecision[]; masteryLevels: Record<string, number>; enrolled: number; tutorsRevealed: number;
}) {
  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-xl text-white mb-1">Tutor Connections</h2>
        <p className="text-white/40 text-sm font-body">Calibrating each AI tutor to {learnerName}&apos;s levels</p>
      </div>

      <div className="grid gap-3">
        {tutorDecisions.map((t, i) => {
          const tutor = TUTORS[t.tutor_key as TutorKey];
          if (!tutor) return null;
          const domainScore = masteryLevels[tutor.domain?.toLowerCase() || ""] || 0.5;
          const teachLevel = scoreToGradeEquiv(domainScore, enrolled);
          const revealed = i < tutorsRevealed;

          return (
            <div
              key={t.tutor_key}
              className={`bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10 transition-all duration-700 flex items-center gap-4 ${
                revealed ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
              }`}
            >
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0 shadow-lg" style={{ borderColor: tutor.color }}>
                <Image src={tutor.avatar} alt={tutor.name} width={48} height={48} className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-heading font-bold text-sm text-white">{tutor.name}</span>
                  {tutor.domain && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-semibold">{tutor.domain}</span>
                  )}
                </div>
                <p className="text-white/40 text-xs font-body truncate">{t.reasoning}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-white/30 font-body">Teaches at</p>
                <p className="font-heading font-bold text-sm" style={{ color: tutor.color }}>
                  Grade {teachLevel}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {tutorsRevealed >= tutorDecisions.length && (
        <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/60 text-sm font-body text-center">
            Every tutor reads {learnerName}&apos;s Brain before each session. They know the exact level to teach at, which accommodations to apply, and which skills to target next.
          </p>
        </div>
      )}
    </div>
  );
}

function StageComplete({ learnerName, onContinue }: {
  learnerName: string; onContinue: () => void;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 300); }, []);

  return (
    <div className={`text-center py-8 transition-all duration-700 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
      <div className="relative mx-auto w-32 h-32 mb-6">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className="w-16 h-16 text-white" strokeWidth={1.5} aria-hidden />
        </div>
      </div>

      <h2 className="font-heading font-bold text-2xl text-white mb-2">
        {learnerName}&apos;s Brain is Ready
      </h2>
      <p className="text-white/50 text-sm font-body mb-8 max-w-md mx-auto">
        The Brain has been built from {learnerName}&apos;s assessment data. Review the details below and decide what happens next.
      </p>

      <button
        onClick={onContinue}
        className="px-8 py-4 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-heading font-bold text-lg shadow-xl hover:scale-105 active:scale-95 transition-transform"
      >
        Review & Decide
      </button>
    </div>
  );
}
