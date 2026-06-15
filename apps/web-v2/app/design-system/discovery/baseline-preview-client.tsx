"use client";

/**
 * /design-system/discovery — dev-only, non-destructive preview of the elevated
 * Baseline ("Discovery Adventure") per learner-experience/BASELINE-SPEC.md.
 *
 * Self-contained: keeps its OWN local preference state (Mood / contrast / Font /
 * Spacing / Sound / functioning level) scoped to a wrapper element, so toggling
 * never mutates the global <html> theme or any real session. The --lx-* tokens +
 * data-tutor accent are demonstrated live across two domain "worlds"; sound is
 * synthesized via the existing Web Audio helper (no audio files).
 *
 * THE BASELINE RULE: a child is NEVER shown right/wrong, a score, a grade, or
 * "failure". Every answer earns a warm acknowledgement; correctness is recorded
 * silently (shown here only in a clearly-labelled dev "engine" caption) and used
 * to adapt + to seed the parent handoff. PRODUCTION IS UNTOUCHED.
 */

import * as React from "react";
import { tutorThemeCSSVars } from "@aivo/brand";
import { useChime, type SoundLevel } from "../../design-preview/use-chime";

type Mood = "calm" | "balanced" | "energizing";
type Contrast = "standard" | "high";
type Typeface = "standard" | "dyslexia";
type Spacing = "compact" | "comfortable" | "spacious";
type FL = "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";

type Phase = "intro" | "item" | "break" | "complete";

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
// px) is INTENTIONALLY enlarged here (matching the sibling stage preview) so the
// demo reads on a desktop display; the check only requires preview hitTarget >=
// the canonical value (never smaller).
const FL_BITS: Record<FL, FlBits> = {
  STANDARD: { maxChoices: 5, textWeight: "full", hitTarget: 88, motionZero: false },
  SUPPORTED: { maxChoices: 3, textWeight: "reduced", hitTarget: 92, motionZero: false },
  LOW_VERBAL: { maxChoices: 2, textWeight: "icons-primary", hitTarget: 100, motionZero: false },
  NON_VERBAL: { maxChoices: 2, textWeight: "icons-only", hitTarget: 112, motionZero: true },
  PRE_SYMBOLIC: { maxChoices: 2, textWeight: "none", hitTarget: 120, motionZero: true },
};

const MOOD_MOTION: Record<Mood, number> = { calm: 0.45, balanced: 1, energizing: 1.2 };

interface Choice {
  id: string;
  label: string;
  symbol: string;
  isCorrect: boolean;
}
interface Item {
  id: string;
  pic: string;
  prompt: string;
  shortPrompt: string;
  choices: Choice[];
}
interface Chapter {
  tutor: "sage" | "nova";
  world: string;
  domain: string;
  hostName: string;
  items: Item[];
}

// Two-chapter demo adventure so the world swap is visible. In every item the
// correct choice is first so any maxChoices cap (>= 2) still includes it — the
// learner never sees which one is "correct".
const CHAPTERS: Chapter[] = [
  {
    tutor: "sage",
    world: "Story Garden",
    domain: "Reading & Language",
    hostName: "Sage",
    items: [
      {
        id: "r1",
        pic: "🐄",
        prompt: "Which animal says “moo”?",
        shortPrompt: "Tap the cow.",
        choices: [
          { id: "r1a", label: "Cow", symbol: "🐄", isCorrect: true },
          { id: "r1b", label: "Dog", symbol: "🐶", isCorrect: false },
          { id: "r1c", label: "Cat", symbol: "🐱", isCorrect: false },
          { id: "r1d", label: "Bird", symbol: "🐦", isCorrect: false },
          { id: "r1e", label: "Frog", symbol: "🐸", isCorrect: false },
        ],
      },
      {
        id: "r2",
        pic: "🎩",
        prompt: "Which word rhymes with “cat”?",
        shortPrompt: "Which one rhymes?",
        choices: [
          { id: "r2a", label: "Hat", symbol: "🎩", isCorrect: true },
          { id: "r2b", label: "Sun", symbol: "☀️", isCorrect: false },
          { id: "r2c", label: "Dog", symbol: "🐶", isCorrect: false },
          { id: "r2d", label: "Cup", symbol: "🥤", isCorrect: false },
          { id: "r2e", label: "Fish", symbol: "🐟", isCorrect: false },
        ],
      },
    ],
  },
  {
    tutor: "nova",
    world: "Number Galaxy",
    domain: "Math",
    hostName: "Nova",
    items: [
      {
        id: "m1",
        pic: "✦✦✦",
        prompt: "How many stars do you see?",
        shortPrompt: "Tap how many.",
        choices: [
          { id: "m1a", label: "Three", symbol: "✦✦✦", isCorrect: true },
          { id: "m1b", label: "Two", symbol: "✦✦", isCorrect: false },
          { id: "m1c", label: "Four", symbol: "✦✦✦✦", isCorrect: false },
          { id: "m1d", label: "Five", symbol: "✦✦✦✦✦", isCorrect: false },
          { id: "m1e", label: "One", symbol: "✦", isCorrect: false },
        ],
      },
      {
        id: "m2",
        pic: "🪐",
        prompt: "Which group has more moons?",
        shortPrompt: "Tap the bigger group.",
        choices: [
          { id: "m2a", label: "Five", symbol: "🌙🌙🌙🌙🌙", isCorrect: true },
          { id: "m2b", label: "Two", symbol: "🌙🌙", isCorrect: false },
          { id: "m2c", label: "One", symbol: "🌙", isCorrect: false },
          { id: "m2d", label: "Three", symbol: "🌙🌙🌙", isCorrect: false },
          { id: "m2e", label: "Four", symbol: "🌙🌙🌙🌙", isCorrect: false },
        ],
      },
    ],
  },
];

const TOTAL_ITEMS = CHAPTERS.reduce((n, c) => n + c.items.length, 0);

// Warm acknowledgements — rotated, NEVER "correct"/"wrong".
const ACKS = [
  "Nice thinking!",
  "Got it — let's keep exploring.",
  "Thanks for sharing that.",
  "Great — on we go!",
];

const SUPPORTS = [
  { icon: "🔊", label: "Read-aloud on" },
  { icon: "🕊️", label: "No timers" },
  { icon: "✓", label: "Not a test" },
];

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
  const groupId = React.useId();
  return (
    <div className="lx-ctrl-group">
      <span className="lx-ctrl-label" id={groupId}>
        {label}
      </span>
      <div className="lx-seg" role="group" aria-labelledby={groupId}>
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

export function BaselinePreview() {
  const [mood, setMood] = React.useState<Mood>("balanced");
  const [contrast, setContrast] = React.useState<Contrast>("standard");
  const [typeface, setTypeface] = React.useState<Typeface>("standard");
  const [spacing, setSpacing] = React.useState<Spacing>("comfortable");
  const [sound, setSound] = React.useState<SoundLevel>("soft");
  const [fl, setFl] = React.useState<FL>("STANDARD");
  const [simulateStruggle, setSimulateStruggle] = React.useState(false);

  const [phase, setPhase] = React.useState<Phase>("intro");
  const [chapterIdx, setChapterIdx] = React.useState(0);
  const [itemIdx, setItemIdx] = React.useState(0);
  const [answered, setAnswered] = React.useState(0);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [ack, setAck] = React.useState<string | null>(null);
  const [engine, setEngine] = React.useState<string | null>(null);
  const [frustrationOpen, setFrustrationOpen] = React.useState(false);
  const [hostState, setHostState] = React.useState<
    "idle" | "speaking" | "thinking" | "encouraging" | "celebrating" | "resting"
  >("idle");
  const [breakReturn, setBreakReturn] = React.useState<Phase>("item");
  const [listeningMode, setListeningMode] = React.useState(false);
  const [live, setLive] = React.useState("");

  const bits = FL_BITS[fl];
  const motion = contrast === "high" || bits.motionZero ? 0 : MOOD_MOTION[mood];
  const chime = useChime(sound);

  const chapter = CHAPTERS[chapterIdx];
  const item = chapter.items[itemIdx];
  const visibleChoices = item.choices.slice(0, bits.maxChoices);
  const showSymbolOnly = bits.textWeight === "icons-only" || bits.textWeight === "none";

  // High contrast strips the per-tutor accent (sensory supremacy). In high
  // contrast we DON'T apply the inline per-tutor accent at all, so the CSS
  // `[data-lx-contrast="high"]` rule supplies neutral accent tokens (inline
  // styles would otherwise beat the stylesheet). Keeps hex out of TS too.
  const tutorVars: Record<string, string> =
    contrast === "high" ? {} : tutorThemeCSSVars(chapter.tutor);

  const announce = (msg: string) => setLive(msg);

  // Break dialog: Esc to close + move focus into the dialog on open.
  const breakRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (phase !== "break") return;
    breakRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhase(breakReturn);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, breakReturn]);

  function start() {
    setPhase("item");
    setChapterIdx(0);
    setItemIdx(0);
    setAnswered(0);
    setPicked(null);
    setAck(null);
    setEngine(null);
    setHostState("speaking");
    announce(`${CHAPTERS[0].hostName} says: ${CHAPTERS[0].items[0].prompt}`);
  }

  function playPrompt() {
    setHostState("speaking");
    announce(`${chapter.hostName} says: ${item.prompt}`);
    window.setTimeout(() => setHostState((s) => (s === "speaking" ? "idle" : s)), 600);
  }

  function advance() {
    const nextAnswered = answered + 1;
    setAnswered(nextAnswered);
    setPicked(null);
    setAck(null);
    setEngine(null);

    // more items in this chapter?
    if (itemIdx + 1 < chapter.items.length) {
      setItemIdx((i) => i + 1);
      setHostState("speaking");
      return;
    }
    // chapter boundary → next world, with a natural rest first
    if (chapterIdx + 1 < CHAPTERS.length) {
      setBreakReturn("item");
      setChapterIdx((c) => c + 1);
      setItemIdx(0);
      setHostState("resting" as never);
      setPhase("break");
      announce("Time for a quick rest before the next world.");
      return;
    }
    // adventure complete
    setPhase("complete");
    setHostState("celebrating");
    chime.complete();
    announce("Adventure complete. Look what we discovered about how you learn.");
  }

  function pick(choice: Choice) {
    if (picked) return;
    setPicked(choice.id);
    chime.correct(); // neutral, warm "received" tone — not a score
    const message = ACKS[answered % ACKS.length];
    setAck(message);
    setHostState("encouraging");
    announce(`Got it. ${message}`);

    // dev-only engine caption — invisible to a real learner. Demonstrates the
    // adaptive engine reacting WITHOUT ever surfacing right/wrong to the child.
    setEngine(
      `recorded · the engine will pick a ${choice.isCorrect ? "slightly harder" : "slightly gentler"} next item (the learner never sees this)`,
    );

    // struggle signal → meet it with care, never shame
    if (simulateStruggle && !choice.isCorrect) {
      window.setTimeout(() => {
        setFrustrationOpen(true);
        setHostState("encouraging");
        announce("Want a quick break, or try a different way?");
      }, 700);
      return;
    }

    window.setTimeout(advance, 950);
  }

  function skip() {
    if (picked) return;
    setAck("That's okay — let's try the next one.");
    setEngine("skipped · recorded as no-response, no penalty (the learner never sees this)");
    setHostState("encouraging");
    announce("Skipped. That's okay — on we go.");
    window.setTimeout(advance, 850);
  }

  function chooseFrustration(kind: "break" | "listen" | "keep") {
    setFrustrationOpen(false);
    if (kind === "break") {
      setBreakReturn("item");
      setPhase("break");
    } else if (kind === "listen") {
      setListeningMode(true);
      announce("Switched to listening — I'll read everything out loud.");
      window.setTimeout(advance, 600);
    } else {
      window.setTimeout(advance, 300);
    }
  }

  function restart() {
    setPhase("intro");
    setChapterIdx(0);
    setItemIdx(0);
    setAnswered(0);
    setPicked(null);
    setAck(null);
    setEngine(null);
    setFrustrationOpen(false);
    setListeningMode(false);
    setHostState("idle");
    announce("Adventure reset.");
  }

  const hostImg = motion === 0 ? `/images/tutors/${chapter.tutor}-reduced.svg` : `/images/tutors/${chapter.tutor}.png`;

  const showAmbient = chapter.tutor === "nova";

  return (
    <main
      className="lx-adv"
      data-tutor={chapter.tutor}
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
      <div className="lx-adv-shell">
        <header className="lx-header">
          <span className="lx-pill">Dev-only preview · /design-system/discovery</span>
          <h1>The Discovery Adventure — elevated baseline</h1>
          <p>
            Spec preview for Task #6, Step 1. A friendly robot host, a chaptered adventure across
            domain worlds, and one hard rule: <strong>no wrong answers, no scores, no grades — ever,
            anywhere a child can see</strong>. Every answer earns a warm acknowledgement; correctness
            is recorded silently to adapt and to seed the parent handoff. Nothing in production has
            changed — review and approve before Phase 2. Mood is decoupled from contrast (§11 Option A).
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
          <Segmented
            label="Simulate struggle"
            value={simulateStruggle ? "on" : "off"}
            onChange={(v) => setSimulateStruggle(v === "on")}
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
          />
        </section>

        <p className="lx-note">
          Functioning level caps choices at {bits.maxChoices} and grows targets; Non-verbal &
          Pre-symbolic remove all motion and text. Calm turns motion down ({MOOD_MOTION.calm}×);
          Energizing turns it up ({MOOD_MOTION.energizing}×) — contrast is unchanged across moods.
          “Simulate struggle” shows how a frustration signal is met with care (break / listen / keep
          going), never shame.
        </p>

        {/* ---- the board ---- */}
        <div className="lx-board">
          {showAmbient && (
            <div className="lx-ambient" aria-hidden="true">
              <div className="lx-orbit" />
              <span className="lx-star" style={{ top: "14%", left: "12%" }}>✦</span>
              <span className="lx-star" style={{ top: "30%", left: "78%" }}>✦</span>
              <span className="lx-star" style={{ top: "62%", left: "22%" }}>◯</span>
              <span className="lx-star" style={{ top: "72%", left: "64%" }}>✦</span>
            </div>
          )}

          {/* adventure path (hidden for non-verbal / pre-symbolic) */}
          {phase !== "intro" && phase !== "complete" && !bits.motionZero && (
            <div className="lx-path" aria-label={`Item ${answered + 1} of ${TOTAL_ITEMS}`}>
              {Array.from({ length: TOTAL_ITEMS }).map((_, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="lx-path-step" data-done={i <= answered} />}
                </React.Fragment>
              ))}
              <span className="lx-path-label">
                {chapter.world} · {Math.min(answered + 1, TOTAL_ITEMS)} of {TOTAL_ITEMS}
              </span>
            </div>
          )}

          {/* ---------- INTRO ---------- */}
          {phase === "intro" && (
            <div className="lx-host-row">
              <div className="lx-host" data-state="speaking" aria-hidden="true">
                <img src={hostImg} alt="" />
              </div>
              <div className="lx-host-bubble">
                <p className="lx-eyebrow">A friendly check-in with {chapter.hostName}</p>
                <div className="lx-narration">
                  <p className="lx-prompt">
                    Ready to start your adventure? Let's find your starting point — this isn't a test,
                    and you can take a break any time.
                  </p>
                  <div className="lx-chips" style={{ marginBottom: "1rem" }}>
                    {SUPPORTS.map((s) => (
                      <span key={s.label} className="lx-chip">
                        <span aria-hidden="true">{s.icon}</span> {s.label}
                      </span>
                    ))}
                  </div>
                  <div className="lx-audio-row">
                    <button type="button" className="lx-btn lx-btn-primary lx-btn-big" onClick={start}>
                      Start your adventure
                    </button>
                    <button type="button" className="lx-btn lx-btn-ghost" onClick={playPrompt}>
                      ▶ Hear it again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------- ITEM ---------- */}
          {phase === "item" && (
            <div className="lx-host-row">
              <div className="lx-host" data-state={hostState} aria-hidden="true">
                <img src={hostImg} alt="" />
              </div>
              <div className="lx-host-bubble">
                <p className="lx-eyebrow">
                  With {chapter.hostName} · {chapter.world}
                </p>
                <div className="lx-narration">
                  {!showSymbolOnly && (
                    <div className="lx-prompt-pic" aria-hidden="true">
                      {item.pic}
                    </div>
                  )}
                  <p className="lx-prompt">
                    {bits.textWeight === "none" || bits.textWeight === "icons-only"
                      ? item.shortPrompt
                      : item.prompt}
                  </p>
                  <div className="lx-audio-row">
                    <button
                      type="button"
                      className="lx-btn lx-btn-primary lx-btn-big"
                      onClick={playPrompt}
                      aria-label="Play the question"
                    >
                      <span aria-hidden="true">▶</span>
                      <span className="lx-btn-text">Play sound</span>
                    </button>
                    <button
                      type="button"
                      className="lx-btn lx-btn-ghost"
                      onClick={playPrompt}
                      aria-label="Play it again"
                    >
                      <span aria-hidden="true">↻</span>
                      <span className="lx-btn-text">Again</span>
                    </button>
                  </div>

                  <div style={{ marginTop: "1rem" }}>
                    <div className="lx-choices" role="group" aria-label="Answer choices">
                      {visibleChoices.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="lx-choice"
                          data-status={picked === c.id ? "chosen" : undefined}
                          style={{ ["--hit" as string]: `${bits.hitTarget}px` }}
                          aria-label={c.label}
                          onClick={() => pick(c)}
                        >
                          <span className="lx-choice-symbol" aria-hidden="true">
                            {c.symbol}
                          </span>
                          {!showSymbolOnly && <span>{c.label}</span>}
                          {picked === c.id && (
                            <span className="lx-choice-mark" aria-hidden="true">
                              ✓ Chosen
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {ack && <p className="lx-ack">{ack}</p>}
                    {engine && (
                      <p className="lx-engine">
                        <strong>Engine view (hidden from the learner):</strong> {engine}
                      </p>
                    )}

                    {frustrationOpen && (
                      <div className="lx-frustration" role="group" aria-label="Support options">
                        <p>Want a quick break, or try a different way?</p>
                        <div className="lx-frustration-opts">
                          <button
                            type="button"
                            className="lx-btn lx-btn-ghost"
                            onClick={() => chooseFrustration("break")}
                          >
                            ☁ Take a break
                          </button>
                          <button
                            type="button"
                            className="lx-btn lx-btn-ghost"
                            onClick={() => chooseFrustration("listen")}
                          >
                            🎧 Listen instead
                          </button>
                          <button
                            type="button"
                            className="lx-btn lx-btn-primary"
                            onClick={() => chooseFrustration("keep")}
                          >
                            Keep going
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------- MY WORDS rail (during items) ---------- */}
          {phase === "item" && (
            <div className="lx-rail" aria-label="My words — support">
              <span className="lx-rail-title">My words{listeningMode ? " · listening on" : ""}</span>
              <button
                type="button"
                aria-label="Help"
                onClick={() => announce("Hint: take your time, there's no rush.")}
              >
                <span aria-hidden="true">💡</span>
                <span className="lx-rail-text">Help</span>
              </button>
              <button type="button" aria-label="Play it again" onClick={playPrompt}>
                <span aria-hidden="true">↻</span>
                <span className="lx-rail-text">Again</span>
              </button>
              <button type="button" aria-label="Skip this one" onClick={skip}>
                <span aria-hidden="true">⏭</span>
                <span className="lx-rail-text">Skip</span>
              </button>
              <button
                type="button"
                aria-label="Take a break"
                onClick={() => {
                  setBreakReturn("item");
                  setPhase("break");
                }}
              >
                <span aria-hidden="true">☁</span>
                <span className="lx-rail-text">Take a break</span>
              </button>
            </div>
          )}

          {/* ---------- COMPLETE (learner = strengths-first, no numbers) ---------- */}
          {phase === "complete" && (
            <div className="lx-discover">
              <div className="lx-discover-badge" aria-hidden="true">
                🎉
              </div>
              <h2 style={{ color: "var(--lx-ink)", margin: "0.5rem 0 0" }}>
                Look what we discovered about how you learn!
              </h2>
              <ul className="lx-strengths">
                <li>
                  <span aria-hidden="true">🔊</span> You love hearing the question — listening helps you
                  most.
                </li>
                <li>
                  <span aria-hidden="true">🖼️</span> Pictures with words make new ideas click for you.
                </li>
                <li>
                  <span aria-hidden="true">⭐</span> You take your time and keep trying — that's a
                  superpower.
                </li>
              </ul>

              {/* Parent handoff — the ONLY place numbers appear, framed as starting
                  points, and on a separate (adult) surface in production. */}
              <div className="lx-handoff">
                <span className="lx-handoff-badge">For grown-ups</span>
                <h3>Where lessons will start</h3>
                <p className="lx-handoff-note">
                  These are starting points, not grades or scores — and they're never shown to your
                  child. In production this lives on the parent route.
                </p>
                <div className="lx-handoff-rows">
                  <div className="lx-handoff-row">
                    <span className="lx-handoff-label">Reading &amp; Language</span>
                    <span className="lx-handoff-start">Starting at: on grade</span>
                  </div>
                  <div className="lx-handoff-row">
                    <span className="lx-handoff-label">Math</span>
                    <span className="lx-handoff-start">Starting at: building</span>
                  </div>
                  <div className="lx-handoff-row">
                    <span className="lx-handoff-label">Supports</span>
                    <span className="lx-handoff-start">Read-aloud + extra time on</span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "1.25rem" }}>
                <button type="button" className="lx-btn lx-btn-primary" onClick={restart}>
                  Play again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------- break cloud ---------- */}
        {phase === "break" && (
          <div
            className="lx-modal-scrim"
            role="dialog"
            aria-modal="true"
            aria-label="Take a break"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPhase(breakReturn);
            }}
          >
            <div className="lx-modal" ref={breakRef} tabIndex={-1}>
              <div aria-hidden="true" style={{ fontSize: "2.5rem" }}>
                ☁️
              </div>
              <h3>Breaks are good</h3>
              <p>Take your time. Your adventure is saved — come back whenever you're ready.</p>
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
                onClick={() => {
                  setPhase(breakReturn);
                  setHostState("speaking");
                }}
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
