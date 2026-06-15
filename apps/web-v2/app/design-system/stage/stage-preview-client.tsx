"use client";

/**
 * /design-system/stage — dev-only, non-destructive preview of the elevated
 * Stage (lesson player) per learner-experience/STAGE-SPEC.md.
 *
 * Self-contained: keeps its OWN local preference state (Mood / contrast /
 * Font / Spacing / Sound / functioning level) scoped to a wrapper element, so
 * toggling never mutates the global <html> theme or any real session. The
 * --lx-* tokens + data-tutor accent are demonstrated live; sound is synthesized
 * via the existing Web Audio helper (no audio files). PRODUCTION IS UNTOUCHED.
 */

import * as React from "react";
import { tutorThemeCSSVars } from "@aivo/brand";
import { useChime, type SoundLevel } from "../../design-preview/use-chime";

type Mood = "calm" | "balanced" | "energizing";
type Contrast = "standard" | "high";
type Typeface = "standard" | "dyslexia";
type Spacing = "compact" | "comfortable" | "spacious";
type FL = "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";

type Phase = "listen" | "choose" | "celebrate";

interface FlBits {
  maxChoices: number;
  textWeight: "full" | "reduced" | "icons-primary" | "icons-only" | "none";
  hitTarget: number;
  motionZero: boolean;
}

// Mirror of the canonical FL profile (packages/learner-ui/src/tokens/fl-profiles.ts).
// `maxChoices` and `textWeight` MUST match the canonical values exactly — they
// change what the learner actually sees, so a drift gives a misleading demo and
// is failed by scripts/ci/check-answer-choice-caps.mjs. `hitTarget` (tap-target
// px) is INTENTIONALLY enlarged here so the demo reads on a desktop display; the
// check only requires preview hitTarget >= the canonical value (never smaller).
const FL_BITS: Record<FL, FlBits> = {
  STANDARD: { maxChoices: 5, textWeight: "full", hitTarget: 88, motionZero: false },
  SUPPORTED: { maxChoices: 3, textWeight: "reduced", hitTarget: 92, motionZero: false },
  LOW_VERBAL: { maxChoices: 2, textWeight: "icons-primary", hitTarget: 100, motionZero: false },
  NON_VERBAL: { maxChoices: 2, textWeight: "icons-only", hitTarget: 112, motionZero: true },
  PRE_SYMBOLIC: { maxChoices: 2, textWeight: "none", hitTarget: 120, motionZero: true },
};

// Number Galaxy (Nova) demo beat. Correct option is first so any maxChoices
// cap (>= 2) always includes it.
const CHOICES = [
  { id: "c3", label: "Three", symbol: "✦✦✦", isCorrect: true },
  { id: "c2", label: "Two", symbol: "✦✦", isCorrect: false },
  { id: "c4", label: "Four", symbol: "✦✦✦✦", isCorrect: false },
  { id: "c5", label: "Five", symbol: "✦✦✦✦✦", isCorrect: false },
  { id: "c1", label: "One", symbol: "✦", isCorrect: false },
];

const MOOD_MOTION: Record<Mood, number> = { calm: 0.45, balanced: 1, energizing: 1.2 };

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="lx-ctrl-group">
      <span className="lx-ctrl-label" id={`lbl-${label}`}>
        {label}
      </span>
      <div className="lx-seg" role="group" aria-labelledby={`lbl-${label}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StagePreview() {
  const [mood, setMood] = React.useState<Mood>("balanced");
  const [contrast, setContrast] = React.useState<Contrast>("standard");
  const [typeface, setTypeface] = React.useState<Typeface>("standard");
  const [spacing, setSpacing] = React.useState<Spacing>("comfortable");
  const [sound, setSound] = React.useState<SoundLevel>("soft");
  const [fl, setFl] = React.useState<FL>("STANDARD");

  const [phase, setPhase] = React.useState<Phase>("listen");
  const [tutorState, setTutorState] = React.useState<
    "idle" | "speaking" | "thinking" | "encouraging" | "celebrating"
  >("idle");
  const [picked, setPicked] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ tone: "correct" | "retry"; text: string } | null>(
    null,
  );
  const [hintOpen, setHintOpen] = React.useState(false);
  const [breakOpen, setBreakOpen] = React.useState(false);
  const [live, setLive] = React.useState("");

  const bits = FL_BITS[fl];
  const motion = contrast === "high" || bits.motionZero ? 0 : MOOD_MOTION[mood];
  const visibleChoices = CHOICES.slice(0, bits.maxChoices);
  const chime = useChime(sound);

  // High contrast strips the per-tutor accent (sensory supremacy). Because the
  // accent vars are applied inline on the root, neutralize them here in JS —
  // an inline style always beats a stylesheet override on the same element.
  const tutorVars =
    contrast === "high"
      ? {
          "--tutor-accent": "#000000",
          "--tutor-accent-soft": "#ffffff",
          "--tutor-accent-ink": "#000000",
        }
      : tutorThemeCSSVars("nova");

  const announce = (msg: string) => setLive(msg);

  // Break dialog: Esc to close + move focus into the dialog on open.
  const breakRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!breakOpen) return;
    breakRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBreakOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [breakOpen]);

  function playNarration() {
    setTutorState("speaking");
    announce("Nova says: How many stars do you see?");
    window.setTimeout(() => {
      setTutorState((s) => (s === "speaking" ? "idle" : s));
      setPhase("choose");
    }, 600);
  }

  function pick(id: string, correct: boolean) {
    setPicked(id);
    if (correct) {
      setTutorState("celebrating");
      setFeedback({ tone: "correct", text: "You figured out the tricky one!" });
      announce("Correct. You figured out the tricky one.");
      chime.correct();
      window.setTimeout(() => {
        setPhase("celebrate");
        chime.complete();
        announce("Lesson complete. You earned 15 XP.");
      }, 700);
    } else {
      setTutorState("encouraging");
      setFeedback({ tone: "retry", text: "Not quite — want to try again together?" });
      announce("Let's try that again together.");
      window.setTimeout(() => {
        setPicked(null);
        setFeedback(null);
        setTutorState("idle");
      }, 1400);
    }
  }

  function restart() {
    setPhase("listen");
    setTutorState("idle");
    setPicked(null);
    setFeedback(null);
    setHintOpen(false);
    announce("Lesson restarted.");
  }

  const steps = [
    { key: "listen", label: "Listen" },
    { key: "choose", label: "Choose" },
    { key: "celebrate", label: "Check" },
  ];
  const stepIndex = phase === "listen" ? 0 : phase === "choose" ? 1 : 2;

  const showText = bits.textWeight !== "none" && bits.textWeight !== "icons-only";
  const showSymbolOnly = bits.textWeight === "icons-only" || bits.textWeight === "none";

  return (
    <main
      className="lx-stage"
      data-tutor="nova"
      data-lx-mood={mood}
      data-lx-contrast={contrast}
      data-lx-typeface={typeface}
      data-lx-spacing={spacing}
      data-lx-fl={fl}
      data-lx-motion={motion === 0 ? "0" : "1"}
      data-lx-textweight={bits.textWeight}
      style={
        {
          ...tutorVars,
          "--lx-motion": String(motion),
        } as React.CSSProperties
      }
    >
      <div className="lx-stage-shell">
        <header className="lx-header">
          <span className="lx-pill">Dev-only preview · /design-system/stage</span>
          <h1>The Stage — elevated lesson player</h1>
          <p>
            Spec preview for Task #5, Step 1. A robot host with a world, a forgiving Listen → Choose
            → Check journey, and every preference honored. Nothing in production has changed — review
            and approve before Phase 2. Mood is decoupled from contrast (§11 Option A).
          </p>
        </header>

        <section className="lx-controls" aria-label="Preview preference controls">
          <Segmented
            label="Mood"
            value={mood}
            onChange={setMood}
            options={[
              { value: "calm", label: "Calm" },
              { value: "balanced", label: "Balanced" },
              { value: "energizing", label: "Energizing" },
            ]}
          />
          <Segmented
            label="Contrast"
            value={contrast}
            onChange={setContrast}
            options={[
              { value: "standard", label: "Standard" },
              { value: "high", label: "High contrast" },
            ]}
          />
          <Segmented
            label="Font"
            value={typeface}
            onChange={setTypeface}
            options={[
              { value: "standard", label: "Standard" },
              { value: "dyslexia", label: "Dyslexia" },
            ]}
          />
          <Segmented
            label="Spacing"
            value={spacing}
            onChange={setSpacing}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
              { value: "spacious", label: "Spacious" },
            ]}
          />
          <Segmented
            label="Sound"
            value={sound}
            onChange={setSound}
            options={[
              { value: "off", label: "Off" },
              { value: "soft", label: "Soft" },
              { value: "on", label: "On" },
            ]}
          />
          <Segmented
            label="Functioning level"
            value={fl}
            onChange={(v) => {
              setFl(v);
              restart();
            }}
            options={[
              { value: "STANDARD", label: "Standard" },
              { value: "SUPPORTED", label: "Supported" },
              { value: "LOW_VERBAL", label: "Low-verbal" },
              { value: "NON_VERBAL", label: "Non-verbal" },
              { value: "PRE_SYMBOLIC", label: "Pre-symbolic" },
            ]}
          />
        </section>

        <p className="lx-note">
          Functioning level caps choices at {bits.maxChoices} and grows targets; Non-verbal &
          Pre-symbolic remove all motion. Calm turns motion down ({MOOD_MOTION.calm}×); Energizing
          turns it up ({MOOD_MOTION.energizing}×) — contrast is unchanged across moods.
        </p>

        {/* ---- the board ---- */}
        <div className="lx-board">
          {/* world ambient — decorative */}
          <div className="lx-ambient" aria-hidden="true">
            <div className="lx-orbit" />
            <span className="lx-star" style={{ top: "14%", left: "12%" }}>
              ✦
            </span>
            <span className="lx-star" style={{ top: "30%", left: "78%" }}>
              ✦
            </span>
            <span className="lx-star" style={{ top: "62%", left: "22%" }}>
              ◯
            </span>
            <span className="lx-star" style={{ top: "72%", left: "64%" }}>
              ✦
            </span>
          </div>

          {/* progress path (hidden for non-verbal / pre-symbolic) */}
          {!bits.motionZero || fl === "LOW_VERBAL" ? (
            <div className="lx-path" aria-label={`Beat ${stepIndex + 1} of ${steps.length}`}>
              {steps.map((s, i) => (
                <React.Fragment key={s.key}>
                  <span className="lx-path-label" aria-hidden={i !== stepIndex}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <span className="lx-path-step" data-done={i < stepIndex} />}
                </React.Fragment>
              ))}
            </div>
          ) : null}

          {/* host + narration */}
          {phase !== "celebrate" && (
            <div className="lx-host-row">
              <div className="lx-host" data-state={tutorState} aria-hidden="true">
                {motion === 0 ? (
                  // reduced-motion / high-contrast fallback = static reduced SVG
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/images/tutors/nova-reduced.svg" alt="" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/images/tutors/nova.png" alt="" />
                )}
              </div>

              <div className="lx-host-bubble">
                <div className="lx-narration">
                  <p className="lx-narration-text">
                    {fl === "PRE_SYMBOLIC" || fl === "NON_VERBAL"
                      ? "Tap the stars."
                      : "Let's count the stars together. How many stars do you see?"}
                  </p>
                  <div className="lx-audio-row">
                    <button
                      type="button"
                      className="lx-btn lx-btn-primary lx-btn-big"
                      onClick={playNarration}
                    >
                      ▶ Play sound
                    </button>
                    <button type="button" className="lx-btn lx-btn-ghost" onClick={playNarration}>
                      ↻ Again
                    </button>
                  </div>
                </div>

                {/* choices appear once we're choosing (or always for audio-first FLs) */}
                {(phase === "choose" || bits.textWeight === "none" || bits.textWeight === "icons-only") && (
                  <div style={{ marginTop: "1rem" }}>
                    <div
                      className="lx-choices"
                      role="group"
                      aria-label="Answer choices"
                    >
                      {visibleChoices.map((c) => {
                        const status =
                          picked === c.id ? (c.isCorrect ? "correct" : "retry") : undefined;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className="lx-choice"
                            data-status={status}
                            style={{ ["--hit" as string]: `${bits.hitTarget}px` }}
                            aria-label={c.label}
                            onClick={() => pick(c.id, c.isCorrect)}
                          >
                            <span className="lx-choice-symbol" aria-hidden="true">
                              {c.symbol}
                            </span>
                            {!showSymbolOnly && <span>{c.label}</span>}
                            {status === "correct" && (
                              <span className="lx-choice-mark" aria-hidden="true">
                                ✓ Correct
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {feedback && (
                      <p className="lx-feedback" data-tone={feedback.tone}>
                        {feedback.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* celebration moment */}
          {phase === "celebrate" && (
            <div className="lx-celebrate">
              <div className="lx-celebrate-badge" aria-hidden="true">
                🎉
              </div>
              <h2 style={{ color: "var(--lx-ink)", margin: "0.5rem 0 0" }}>
                Lesson complete — nice work!
              </h2>
              <div className="lx-xp">
                <span className="lx-sparkle" aria-hidden="true">
                  ✦
                </span>
                +15 XP
                <span className="lx-sparkle" aria-hidden="true">
                  ✦
                </span>
              </div>
              <div style={{ marginTop: "1.25rem" }}>
                <button type="button" className="lx-btn lx-btn-primary" onClick={restart}>
                  Play again
                </button>
              </div>
            </div>
          )}

          {/* MY WORDS support rail — always reachable */}
          {phase !== "celebrate" && (
            <div className="lx-rail" aria-label="My words — support">
              <span className="lx-rail-title">My words</span>
              <button type="button" onClick={() => setHintOpen((h) => !h)}>
                💡 Help
              </button>
              <button type="button" onClick={playNarration}>
                ↻ Again
              </button>
              <button type="button" onClick={() => pick("c3", true)}>
                ✓ I know this
              </button>
              <button type="button" onClick={() => setBreakOpen(true)}>
                ☁ Take a break
              </button>
            </div>
          )}

          {hintOpen && phase !== "celebrate" && (
            <p className="lx-note" role="status">
              Hint: count each star out loud — one, two, three.
            </p>
          )}
        </div>

        {/* break cloud */}
        {breakOpen && (
          <div
            className="lx-modal-scrim"
            role="dialog"
            aria-modal="true"
            aria-label="Take a break"
            onClick={(e) => {
              if (e.target === e.currentTarget) setBreakOpen(false);
            }}
          >
            <div className="lx-modal" ref={breakRef} tabIndex={-1}>
              <div aria-hidden="true" style={{ fontSize: "2.5rem" }}>
                ☁️
              </div>
              <h3>Breaks are good</h3>
              <p>Take your time. Your lesson is saved — come back whenever you're ready.</p>
              <div className="lx-break-opts">
                <button type="button" className="lx-break-opt">
                  <span aria-hidden="true">🌬️</span> Breathe
                </button>
                <button type="button" className="lx-break-opt">
                  <span aria-hidden="true">🎧</span> Listen
                </button>
                <button type="button" className="lx-break-opt">
                  <span aria-hidden="true">🤸</span> Stretch
                </button>
                <button type="button" className="lx-break-opt">
                  <span aria-hidden="true">🤫</span> Quiet
                </button>
              </div>
              <button
                type="button"
                className="lx-btn lx-btn-primary"
                onClick={() => setBreakOpen(false)}
              >
                I'm ready
              </button>
            </div>
          </div>
        )}

        {/* polite live region — every beat/result announced */}
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          {live}
        </div>
      </div>
    </main>
  );
}
