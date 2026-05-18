"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./BrainPersonalizationAnimation.module.css";

type BrainPersonalizationAnimationProps = {
  learnerName?: string;
  durationMs?: number;
  nextHref?: string;
  autoAdvance?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
};

const progressSteps = ["Analyzing profile", "Preparing model", "Personalizing subjects", "Ready"];

const trustItems = [
  { icon: "lock", label: "Encrypted setup" },
  { icon: "shield", label: "Private learner space" },
  { icon: "history", label: "Versioned and reversible" },
];

const learnerTokens = ["Reading", "Math", "Focus", "IEP", "Creativity"];

function Icon({ name }: { name: string }) {
  if (name === "lock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 10V8a5 5 0 0 1 10 0v2" />
        <rect x="5" y="10" width="14" height="10" rx="2.5" />
        <path d="M12 14v2.5" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 19 6v5c0 4.5-2.7 8.4-7 10-4.3-1.6-7-5.5-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    );
  }

  if (name === "history") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12a8 8 0 1 0 2.35-5.65" />
        <path d="M4 4v5h5" />
        <path d="M12 8v5l3 2" />
      </svg>
    );
  }

  if (name === "soundOff") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        <path d="m18 9 3 3-3 3" />
        <path d="m21 9-3 3 3 3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M17 9.5a4 4 0 0 1 0 5" />
      <path d="M19.5 7a7.5 7.5 0 0 1 0 10" />
    </svg>
  );
}

function BrainSvg({ variant, progress }: { variant: "master" | "learner"; progress: number }) {
  const isMaster = variant === "master";
  const fillWidth = isMaster ? 100 : Math.min(100, Math.max(0, progress));

  return (
    <svg
      className={`${styles.brainSvg} ${isMaster ? styles.masterBrainSvg : styles.learnerBrainSvg}`}
      viewBox="0 0 340 240"
      role="img"
      aria-label={isMaster ? "AIVO Master Brain" : "Private learner brain being personalized"}
      style={{ "--brain-fill": fillWidth } as React.CSSProperties}
    >
      <defs>
        <linearGradient id={`brainGradient-${variant}`} x1="12%" y1="22%" x2="88%" y2="86%">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.82" />
          <stop offset="42%" stopColor="#7C3AED" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#FBBF24" stopOpacity={isMaster ? "0.46" : "0.24"} />
        </linearGradient>

        <radialGradient id={`brainGlow-${variant}`} cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.9" />
          <stop offset="52%" stopColor="#7C3AED" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>

        <filter id={`softGlow-${variant}`} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.49 0 0 0 0 0.23 0 0 0 0 0.93 0 0 0 0.72 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <clipPath id={`brainClip-${variant}`}>
          <path d="M78 135c-16-20-13-54 8-76 25-26 72-29 116-12 30-13 72-4 94 20 26 28 28 78 6 106 4 21-8 42-27 51-30 14-69 15-105 7-34 6-78 2-100-20-22-21-24-54 8-76Z" />
        </clipPath>
      </defs>

      <ellipse
        className={styles.brainOuterGlow}
        cx="170"
        cy="130"
        rx="132"
        ry="96"
        fill={`url(#brainGlow-${variant})`}
      />

      <path
        className={isMaster ? styles.masterBrainShell : styles.learnerBrainShell}
        d="M78 135c-16-20-13-54 8-76 25-26 72-29 116-12 30-13 72-4 94 20 26 28 28 78 6 106 4 21-8 42-27 51-30 14-69 15-105 7-34 6-78 2-100-20-22-21-24-54 8-76Z"
        fill="rgba(15, 23, 42, 0.34)"
        stroke={isMaster ? "rgba(34, 211, 238, 0.58)" : "rgba(148, 163, 184, 0.56)"}
        strokeWidth="3"
        strokeDasharray={isMaster ? "0" : "8 10"}
      />

      <g clipPath={`url(#brainClip-${variant})`}>
        <rect
          className={styles.brainFill}
          x="35"
          y="28"
          width="270"
          height="206"
          fill={`url(#brainGradient-${variant})`}
        />
        <circle cx="116" cy="112" r="64" fill="#22D3EE" opacity="0.18" />
        <circle cx="210" cy="126" r="74" fill="#7C3AED" opacity="0.3" />
        <circle cx="246" cy="86" r="46" fill="#FBBF24" opacity={isMaster ? "0.16" : "0.08"} />
      </g>

      <g
        className={isMaster ? styles.masterCircuit : styles.learnerCircuit}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M112 101c23-16 47-14 65 4 18 18 47 21 74 1" />
        <path d="M95 149c31-9 55-2 73 17 19 20 47 22 78 2" />
        <path d="M150 75c8 25 8 54-3 86" />
        <path d="M209 82c-13 24-11 50 5 79" />
      </g>

      <g className={isMaster ? styles.masterNodes : styles.learnerNodes}>
        <circle cx="108" cy="103" r="5" />
        <circle cx="176" cy="105" r="5" />
        <circle cx="250" cy="106" r="5" />
        <circle cx="96" cy="150" r="5" />
        <circle cx="169" cy="166" r="5" />
        <circle cx="246" cy="168" r="5" />
        <circle cx="151" cy="76" r="5" />
        <circle cx="210" cy="83" r="5" />
      </g>

      <path
        className={styles.brainHighlight}
        d="M93 76c19-18 55-25 97-9"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SecureStream() {
  return (
    <div className={styles.streamWrap} aria-hidden="true">
      <div className={styles.streamLine} />
      <div className={`${styles.packet} ${styles.packetOne}`}>01</div>
      <div className={`${styles.packet} ${styles.packetTwo}`}>IEP</div>
      <div className={`${styles.packet} ${styles.packetThree}`}>A+</div>
      <div className={`${styles.packet} ${styles.packetFour}`}>K</div>
      <div className={styles.centerKey}>
        <svg viewBox="0 0 24 24">
          <path d="M7.5 14a4.5 4.5 0 1 1 3.7-1.95L21 12v3h-3v3h-3v-3h-3.8A4.48 4.48 0 0 1 7.5 14Z" />
          <circle cx="7.5" cy="9.5" r="1.2" />
        </svg>
      </div>
    </div>
  );
}

export default function BrainPersonalizationAnimation({
  learnerName,
  durationMs = 9000,
  nextHref,
  autoAdvance = false,
  onComplete,
  onSkip,
}: BrainPersonalizationAnimationProps) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const completedRef = useRef(false);

  useEffect(() => {
    const startedAt = performance.now();

    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const next = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(next);

      if (next >= 100) {
        window.clearInterval(timer);
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [durationMs]);

  useEffect(() => {
    if (progress < 100 || completedRef.current) return;

    completedRef.current = true;
    onComplete?.();

    if (autoAdvance && nextHref) {
      const timeout = window.setTimeout(() => {
        router.push(nextHref);
      }, 650);

      return () => window.clearTimeout(timeout);
    }
  }, [autoAdvance, nextHref, onComplete, progress, router]);

  const stepIndex = useMemo(() => {
    if (progress >= 100) return 3;
    if (progress >= 68) return 2;
    if (progress >= 36) return 1;
    return 0;
  }, [progress]);

  const childProgress = progress < 34 ? 0 : Math.min(100, (progress - 34) * 1.52);
  const ready = progress >= 100;

  const handleSkip = () => {
    setProgress(100);
    onSkip?.();

    if (nextHref) {
      router.push(nextHref);
    }
  };

  return (
    <main className={styles.screen}>
      <div className={styles.ambientOne} aria-hidden="true" />
      <div className={styles.ambientTwo} aria-hidden="true" />
      <div className={styles.gridGlow} aria-hidden="true" />

      <section className={styles.panel} aria-label="AIVO model personalization">
        <button
          className={styles.soundButton}
          type="button"
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          onClick={() => setSoundOn((value) => !value)}
        >
          <Icon name={soundOn ? "sound" : "soundOff"} />
        </button>

        <div className={styles.header}>
          <div className={styles.badge}>
            <span className={styles.badgeSpark} aria-hidden="true">
              ✦
            </span>
            {ready ? "MODEL READY" : "PERSONALIZING MODEL"}
          </div>

          <h1>
            {ready
              ? `${learnerName ? `${learnerName}’s` : "Your child’s"} private learning brain is ready.`
              : `Creating ${learnerName ? `${learnerName}’s` : "your child’s"} private learning brain...`}
          </h1>

          <p>
            AIVO is personalizing lessons, pacing, and support using grade, profile, learning goals,
            and approved family inputs.
          </p>
        </div>

        <div className={styles.brainStage}>
          <div className={styles.brainColumn}>
            <div className={styles.brainCard}>
              <BrainSvg variant="master" progress={100} />
            </div>
            <div className={styles.brainLabel}>AIVO Master Brain</div>
          </div>

          <SecureStream />

          <div className={styles.brainColumn}>
            <div className={`${styles.brainCard} ${styles.learnerCard}`}>
              <BrainSvg variant="learner" progress={childProgress} />
              <div className={styles.tokenRing} aria-hidden="true">
                {learnerTokens.map((token, index) => (
                  <span
                    className={`${styles.learnerToken} ${childProgress > 28 + index * 10 ? styles.tokenVisible : ""}`}
                    key={token}
                  >
                    {token}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.brainLabel}>
              {learnerName ? `${learnerName}’s Private Brain` : "Your Child’s Private Brain"}
            </div>
          </div>
        </div>

        <div className={styles.progressArea}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Model personalization progress"
          >
            <span className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>

          <ol className={styles.steps}>
            {progressSteps.map((step, index) => (
              <li
                key={step}
                className={[
                  styles.step,
                  index < stepIndex ? styles.stepDone : "",
                  index === stepIndex ? styles.stepActive : "",
                ].join(" ")}
              >
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.trustRow} aria-label="Privacy and safety assurances">
          {trustItems.map((item) => (
            <div className={styles.trustItem} key={item.label}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <button className={styles.skipButton} type="button" onClick={handleSkip}>
          Skip animation
        </button>
      </section>
    </main>
  );
}
