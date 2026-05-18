"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./BrainVisualizationPanel.module.css";

type TabKey = "brain" | "rai" | "xai";
type StatusKey = "profile" | "ahead" | "onTrack" | "needsSupport" | "pending";

type Subject = {
  id: string;
  name: string;
  grade: string;
  level: number | null;
  status: StatusKey;
  labelX: string;
  labelY: string;
  regionClass: string;
  description: string;
  strengths: string[];
  support: string[];
  recommendation: string;
};

const statusText: Record<StatusKey, string> = {
  profile: "Profile",
  ahead: "Ahead",
  onTrack: "On track",
  needsSupport: "Needs support",
  pending: "Pending",
};

const subjects: Subject[] = [
  {
    id: "overall",
    name: "Overall",
    grade: "Gr 5.1",
    level: 5.1,
    status: "profile",
    labelX: "5%",
    labelY: "12%",
    regionClass: styles.regionOverall,
    description:
      "The overall profile combines active subject performance, learner engagement, assessment history, and adaptive learning behavior.",
    strengths: [
      "Consistent engagement",
      "Strong pattern recognition",
      "Responds well to visual scaffolds",
    ],
    support: ["Longer independent practice", "More multi-step explanation work"],
    recommendation: "Continue balanced adaptive practice across Reading, Math, and Science.",
  },
  {
    id: "science",
    name: "Science",
    grade: "Gr 5.1",
    level: 5.1,
    status: "onTrack",
    labelX: "68%",
    labelY: "8%",
    regionClass: styles.regionScience,
    description:
      "Science reflects concept mastery, observation, cause-and-effect reasoning, and use of grade-level science vocabulary.",
    strengths: ["Concept recognition", "Visual science activities", "Cause-and-effect reasoning"],
    support: ["Scientific explanation writing", "Vocabulary precision"],
    recommendation:
      "Continue grade-level science practice with visual simulations and short explanation prompts.",
  },
  {
    id: "math",
    name: "Math",
    grade: "Gr 5.4",
    level: 5.4,
    status: "ahead",
    labelX: "72%",
    labelY: "38%",
    regionClass: styles.regionMath,
    description:
      "Math reflects number sense, procedural fluency, reasoning, and multi-step problem solving.",
    strengths: ["Computation fluency", "Pattern recognition", "Multi-step problem solving"],
    support: ["Explaining reasoning in writing", "Checking work before submission"],
    recommendation:
      "Move Jayden into enrichment practice with applied word problems and challenge tasks.",
  },
  {
    id: "reading",
    name: "Reading",
    grade: "Gr 4.7",
    level: 4.7,
    status: "needsSupport",
    labelX: "7%",
    labelY: "48%",
    regionClass: styles.regionReading,
    description:
      "Reading reflects vocabulary, comprehension, fluency, inference, and stamina during literacy activities.",
    strengths: ["Vocabulary recognition", "Story recall", "Literal comprehension"],
    support: ["Multi-step inference", "Reading stamina", "Evidence-based responses"],
    recommendation:
      "Assign 15 minutes of adaptive reading focused on inference, short evidence prompts, and stamina.",
  },
  {
    id: "communication",
    name: "Communication",
    grade: "No data",
    level: null,
    status: "pending",
    labelX: "64%",
    labelY: "68%",
    regionClass: styles.regionCommunication,
    description:
      "Communication will reflect expressive language, receptive understanding, discussion participation, and clarity of response.",
    strengths: [],
    support: [],
    recommendation:
      "Collect more communication data through guided discussion, oral response, or short written reflection.",
  },
  {
    id: "social-emotional",
    name: "Social-Emotional",
    grade: "No data",
    level: null,
    status: "pending",
    labelX: "6%",
    labelY: "72%",
    regionClass: styles.regionSocialEmotional,
    description:
      "Social-emotional data will reflect focus, confidence, frustration tolerance, task persistence, and learning regulation.",
    strengths: [],
    support: [],
    recommendation:
      "Collect more data through check-ins, focus activities, and reflection prompts.",
  },
];

const raiItems = [
  ["COPPA Compliance", "Parental consent verified", "Consent checkpoint active"],
  [
    "Content Safety Gate",
    "Responses pass safety and quality filters",
    "Age-appropriate output only",
  ],
  ["Bias Detection", "Content checked for cultural sensitivity", "Inclusive examples enabled"],
  ["Data Encryption", "Brain state encrypted at rest and in transit", "AES-256 · TLS"],
  ["Parent Approval Loop", "Level changes require parent approval", "No silent grade jumps"],
  ["Session Recording", "Audit trail saved for review", "Versioned model state"],
];

const xaiFactors = [
  ["Inference accuracy", "35% influence", 72, styles.toneAmber],
  ["Reading stamina", "25% influence", 58, styles.toneAmber],
  ["Vocabulary recall", "20% influence", 84, styles.toneGreen],
  ["Response confidence", "12% influence", 64, styles.toneBlue],
  ["Recent growth trend", "8% influence", 52, styles.tonePurple],
] as const;

function BrainIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.1 4.2c-2.3-.5-4.4 1.2-4.4 3.6v.4A4.4 4.4 0 0 0 4 11.6c0 1.3.55 2.45 1.42 3.25A3.85 3.85 0 0 0 10.1 19V4.2Z" />
      <path d="M13.9 4.2c2.3-.5 4.4 1.2 4.4 3.6v.4A4.4 4.4 0 0 1 20 11.6c0 1.3-.55 2.45-1.42 3.25A3.85 3.85 0 0 1 13.9 19V4.2Z" />
      <path d="M10.1 8H8.4M10.1 12H7.8M13.9 8h1.7M13.9 12h2.3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4.2 4.2L19 6.8" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

function StatusPill({ status }: { status: StatusKey }) {
  return (
    <span className={`${styles.statusPill} ${styles[`status_${status}`]}`}>
      {statusText[status]}
    </span>
  );
}

function BrainAtlasSvg() {
  return (
    <svg
      className={styles.brainSvg}
      viewBox="0 0 720 520"
      role="img"
      aria-label="Proper brain silhouette showing subject grade zones"
    >
      <defs>
        <clipPath id="brainSilhouetteClip">
          <path d="M360 72 C332 39 283 31 248 55 C220 26 167 37 145 73 C106 78 76 114 82 153 C52 176 48 224 75 254 C51 294 77 350 125 357 C141 404 197 428 241 399 C273 432 331 429 360 390 C389 429 447 432 479 399 C523 428 579 404 595 357 C643 350 669 294 645 254 C672 224 668 176 638 153 C644 114 614 78 575 73 C553 37 500 26 472 55 C437 31 388 39 360 72Z" />
        </clipPath>

        <linearGradient id="brainBase" x1="120" y1="90" x2="610" y2="430">
          <stop offset="0%" stopColor="#FCF8FF" />
          <stop offset="55%" stopColor="#F8F2FF" />
          <stop offset="100%" stopColor="#FFF8EA" />
        </linearGradient>

        <radialGradient id="brainGlow" cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.18" />
          <stop offset="62%" stopColor="#8B5CF6" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="360" cy="264" r="252" fill="url(#brainGlow)" />

      <g clipPath="url(#brainSilhouetteClip)">
        <rect x="0" y="0" width="720" height="520" fill="url(#brainBase)" />

        <path
          className={`${styles.brainRegion} ${styles.regionReading}`}
          d="M119 136 C188 84 303 86 357 163 C348 240 272 287 150 274 C104 233 95 181 119 136Z"
        />
        <path
          className={`${styles.brainRegion} ${styles.regionScience}`}
          d="M366 158 C421 84 545 88 605 156 C623 222 586 293 472 298 C401 289 361 239 366 158Z"
        />
        <path
          className={`${styles.brainRegion} ${styles.regionMath}`}
          d="M426 267 C516 238 596 277 604 357 C576 404 510 424 455 396 C416 361 405 316 426 267Z"
        />
        <path
          className={`${styles.brainRegion} ${styles.regionOverall}`}
          d="M131 279 C229 264 309 300 316 382 C280 415 205 418 154 380 C120 350 109 315 131 279Z"
        />
        <path
          className={`${styles.brainRegion} ${styles.regionCommunication}`}
          d="M300 354 C361 330 429 345 466 394 C443 436 378 448 334 421 C308 405 295 384 300 354Z"
        />
        <path
          className={`${styles.brainRegion} ${styles.regionSocialEmotional}`}
          d="M178 358 C236 329 302 344 334 390 C314 430 251 446 203 421 C179 407 168 383 178 358Z"
        />
      </g>

      <path
        className={styles.brainOuter}
        d="M360 72 C332 39 283 31 248 55 C220 26 167 37 145 73 C106 78 76 114 82 153 C52 176 48 224 75 254 C51 294 77 350 125 357 C141 404 197 428 241 399 C273 432 331 429 360 390 C389 429 447 432 479 399 C523 428 579 404 595 357 C643 350 669 294 645 254 C672 224 668 176 638 153 C644 114 614 78 575 73 C553 37 500 26 472 55 C437 31 388 39 360 72Z"
      />

      <path className={styles.brainDivider} d="M360 88 C347 159 349 297 363 404" />
      <path className={styles.brainSulci} d="M160 156 C223 117 307 134 338 204" />
      <path className={styles.brainSulci} d="M135 225 C218 203 301 235 326 308" />
      <path className={styles.brainSulci} d="M156 314 C225 300 283 327 299 378" />
      <path className={styles.brainSulci} d="M554 156 C491 117 407 134 376 204" />
      <path className={styles.brainSulci} d="M585 225 C502 203 419 235 394 308" />
      <path className={styles.brainSulci} d="M564 314 C495 300 437 327 421 378" />
    </svg>
  );
}

function BrainTab() {
  const [selectedId, setSelectedId] = useState("reading");

  const selected = useMemo(
    () => subjects.find((subject) => subject.id === selectedId) ?? subjects[0],
    [selectedId],
  );

  const activeSubjects = subjects.filter((subject) => subject.level !== null);
  const average =
    activeSubjects.reduce((total, subject) => total + Number(subject.level), 0) /
    activeSubjects.length;

  const strongest = activeSubjects.reduce((best, subject) =>
    Number(subject.level) > Number(best.level) ? subject : best,
  );

  const focus = activeSubjects.reduce((lowest, subject) =>
    Number(subject.level) < Number(lowest.level) ? subject : lowest,
  );

  const progress =
    selected.level === null ? 0 : Math.min(100, Math.max(0, (selected.level / 6) * 100));

  return (
    <div className={styles.tabBody}>
      <div className={styles.introBlock}>
        <p className={styles.eyebrow}>Learning Map</p>
        <p>
          Estimated grade-level performance by subject. Select a subject to see the current level,
          status, and next learning step.
        </p>
      </div>

      <div className={styles.learningGrid}>
        <section className={styles.brainMapCard}>
          <div className={styles.brainCanvas}>
            <BrainAtlasSvg />

            {subjects.map((subject) => (
              <button
                key={subject.id}
                type="button"
                className={`${styles.subjectCallout} ${styles[`status_${subject.status}`]} ${
                  selected.id === subject.id ? styles.subjectCalloutActive : ""
                }`}
                style={
                  {
                    "--x": subject.labelX,
                    "--y": subject.labelY,
                  } as CSSProperties
                }
                onClick={() => setSelectedId(subject.id)}
                aria-pressed={selected.id === subject.id}
              >
                <span>{subject.name}</span>
                <small>{subject.grade}</small>
                <StatusPill status={subject.status} />
              </button>
            ))}
          </div>

          <div className={styles.summaryGrid}>
            <article>
              <i className={styles.dotPurple} />
              <p>Average level</p>
              <strong>Gr {average.toFixed(1)}</strong>
              <span>Active domains</span>
            </article>

            <article>
              <i className={styles.dotGreen} />
              <p>Strongest area</p>
              <strong>{strongest.name}</strong>
              <span>{strongest.grade}</span>
            </article>

            <article>
              <i className={styles.dotAmber} />
              <p>Focus area</p>
              <strong>{focus.name}</strong>
              <span>{focus.grade}</span>
            </article>

            <article>
              <i className={styles.dotBlue} />
              <p>Coverage</p>
              <strong>
                {activeSubjects.length} of {subjects.length}
              </strong>
              <span>{subjects.length - activeSubjects.length} pending</span>
            </article>
          </div>
        </section>

        <aside className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <p className={styles.eyebrow}>Selected Subject</p>
              <h2>{selected.name}</h2>
            </div>
            <StatusPill status={selected.status} />
          </div>

          <p className={styles.detailDescription}>{selected.description}</p>

          <div className={styles.estimateGrid}>
            <div>
              <p>Current estimate</p>
              <strong>{selected.grade}</strong>
            </div>
            <div>
              <p>Expected</p>
              <strong>Gr 5</strong>
            </div>
          </div>

          <div className={styles.gradeTrack}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className={styles.insightGrid}>
            <div>
              <h3>Strengths</h3>
              {selected.strengths.length > 0 ? (
                <ul>
                  {selected.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>More learner activity is needed.</p>
              )}
            </div>

            <div>
              <h3>Needs support</h3>
              {selected.support.length > 0 ? (
                <ul>
                  {selected.support.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No support pattern detected yet.</p>
              )}
            </div>
          </div>

          <div className={styles.nextStep}>
            <SparkIcon />
            <div>
              <h3>Next step</h3>
              <p>{selected.recommendation}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RaiTab() {
  return (
    <div className={styles.tabBody}>
      <section className={`${styles.heroNotice} ${styles.raiHero}`}>
        <span>
          <CheckIcon />
        </span>
        <div>
          <h2>Responsible AI Status</h2>
          <p>
            Safety, consent, privacy, and ethical guardrails are active for this private learning
            brain.
          </p>
        </div>
        <strong>All systems protected</strong>
      </section>

      <div className={styles.raiGrid}>
        {raiItems.map(([title, description, detail]) => (
          <article key={title}>
            <CheckIcon />
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
              <span>{detail}</span>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.twoColumnGrid}>
        <section className={styles.secondaryCard}>
          <p className={styles.eyebrow}>RAI Audit Trail</p>
          <div className={styles.stackList}>
            <article>
              <strong>Parent consent verified</strong>
              <span>4/11/2026</span>
            </article>
            <article>
              <strong>Learning brain v1 created</strong>
              <span>4/11/2026</span>
            </article>
            <article>
              <strong>Safety filters active for all tutor responses</strong>
              <span>Today</span>
            </article>
          </div>
        </section>

        <section className={styles.secondaryCard}>
          <p className={styles.eyebrow}>Parent Controls</p>
          <div className={styles.stackList}>
            <article>
              <strong>Review model changes</strong>
              <span>Required before grade-level promotion</span>
            </article>
            <article>
              <strong>Export audit record</strong>
              <span>Downloadable for IEP meetings</span>
            </article>
            <article>
              <strong>Rollback brain version</strong>
              <span>Return to prior approved model state</span>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

function XaiTab() {
  return (
    <div className={styles.tabBody}>
      <section className={`${styles.heroNotice} ${styles.xaiHero}`}>
        <span>?</span>
        <div>
          <h2>Explainable AI Insights</h2>
          <p>
            Why did AIVO recommend adaptive reading practice? This explains the signals behind the
            decision in parent-friendly language.
          </p>
        </div>
        <strong>Confidence: High</strong>
      </section>

      <div className={styles.twoColumnGrid}>
        <section className={styles.secondaryCard}>
          <p className={styles.eyebrow}>Decision Explanation</p>
          <h2>Reading support recommended</h2>
          <p>
            AIVO identified a gap between the expected grade level and the current reading estimate.
            The recommendation is based on inference accuracy, time-on-task, and recent assessment
            responses.
          </p>

          <div className={styles.factorList}>
            {xaiFactors.map(([label, influence, value, tone]) => (
              <article key={label}>
                <div>
                  <strong>{label}</strong>
                  <span>{influence}</span>
                </div>
                <div className={styles.factorTrack}>
                  <span className={tone} style={{ width: `${value}%` }} />
                </div>
              </article>
            ))}
          </div>

          <div className={styles.nextStep}>
            <SparkIcon />
            <div>
              <h3>Recommended next step</h3>
              <p>
                15-minute adaptive reading session focused on multi-step inference and evidence
                prompts.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.secondaryCard}>
          <p className={styles.eyebrow}>Domain Mastery Breakdown</p>
          <div className={styles.domainList}>
            {subjects.map((subject) => (
              <article key={subject.id}>
                <div>
                  <strong>{subject.name}</strong>
                  <span>{subject.grade}</span>
                </div>
                <StatusPill status={subject.status} />
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function BrainVisualizationPanel({
  learnerName = "Jayden",
  version = "v1",
  updatedAt = "4/11/2026",
}: {
  learnerName?: string;
  version?: string;
  updatedAt?: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("brain");

  return (
    <section className={styles.shell}>
      <div className={styles.sectionTitle}>
        <span>
          <BrainIcon />
        </span>
        <h1>Brain Visualization</h1>
      </div>

      <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <div className={styles.identity}>
            <span>
              <BrainIcon />
            </span>
            <div>
              <h2>{learnerName}’s Private Learning Brain</h2>
              <p>
                {version} · Updated {updatedAt} · Family-approved personalization
              </p>
            </div>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Brain visualization tabs">
            {[
              ["brain", "Brain"],
              ["rai", "RAI"],
              ["xai", "XAI"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={activeTab === value}
                className={activeTab === value ? styles.activeTab : undefined}
                onClick={() => setActiveTab(value as TabKey)}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {activeTab === "brain" && <BrainTab />}
        {activeTab === "rai" && <RaiTab />}
        {activeTab === "xai" && <XaiTab />}
      </div>
    </section>
  );
}
