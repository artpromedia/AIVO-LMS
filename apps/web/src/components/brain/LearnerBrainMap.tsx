"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./LearnerBrainMap.module.css";

export type SubjectStatus = "ahead" | "onTrack" | "needsSupport" | "noData" | "profile";

export type SubjectProfile = {
  id: string;
  name: string;
  gradeLevel: number | null;
  expectedGrade: number;
  status: SubjectStatus;
  confidence: "High" | "Medium" | "Low" | "Not enough data";
  position: {
    x: string;
    y: string;
  };
  description: string;
  strengths: string[];
  supportNeeds: string[];
  recommendation: string;
  lastUpdated: string;
};

type LearnerBrainMapProps = {
  learnerName?: string;
  expectedGrade?: number;
  subjects?: SubjectProfile[];
};

const statusLabels: Record<SubjectStatus, string> = {
  ahead: "Ahead",
  onTrack: "On track",
  needsSupport: "Needs support",
  noData: "No data",
  profile: "Profile",
};

const defaultSubjects: SubjectProfile[] = [
  {
    id: "overall",
    name: "Overall",
    gradeLevel: 5.1,
    expectedGrade: 5,
    status: "profile",
    confidence: "Medium",
    position: { x: "19%", y: "33%" },
    description:
      "The overall learner profile combines performance across assessments, lessons, practice, and learning behavior.",
    strengths: ["Consistent engagement", "Strong pattern recognition", "Positive response to visual scaffolds"],
    supportNeeds: ["Longer multi-step tasks", "Independent review routines"],
    recommendation: "Continue balanced adaptive practice across reading, math, and science.",
    lastUpdated: "Updated today",
  },
  {
    id: "reading",
    name: "Reading",
    gradeLevel: 4.7,
    expectedGrade: 5,
    status: "needsSupport",
    confidence: "High",
    position: { x: "27%", y: "67%" },
    description:
      "Reading reflects vocabulary, comprehension, fluency, inference, and stamina during literacy activities.",
    strengths: ["Vocabulary recognition", "Story recall", "Literal comprehension"],
    supportNeeds: ["Multi-step inference", "Reading stamina", "Evidence-based responses"],
    recommendation: "Assign a 15-minute adaptive reading session focused on inference and short evidence prompts.",
    lastUpdated: "Updated today",
  },
  {
    id: "math",
    name: "Math",
    gradeLevel: 5.4,
    expectedGrade: 5,
    status: "ahead",
    confidence: "High",
    position: { x: "73%", y: "42%" },
    description:
      "Math reflects number sense, operations, problem solving, reasoning, and grade-level procedural fluency.",
    strengths: ["Computation fluency", "Pattern recognition", "Multi-step problem solving"],
    supportNeeds: ["Explaining reasoning in writing", "Checking work before submission"],
    recommendation: "Move into enrichment practice with applied word problems and challenge tasks.",
    lastUpdated: "Updated today",
  },
  {
    id: "science",
    name: "Science",
    gradeLevel: 5.1,
    expectedGrade: 5,
    status: "onTrack",
    confidence: "Medium",
    position: { x: "62%", y: "27%" },
    description:
      "Science reflects concept mastery, observation, cause-and-effect reasoning, and applied scientific vocabulary.",
    strengths: ["Concept recognition", "Visual science activities", "Cause-and-effect reasoning"],
    supportNeeds: ["Scientific explanation writing", "Vocabulary precision"],
    recommendation: "Continue grade-level science practice with visual simulations and short explanation prompts.",
    lastUpdated: "Updated yesterday",
  },
  {
    id: "communication",
    name: "Communication",
    gradeLevel: null,
    expectedGrade: 5,
    status: "noData",
    confidence: "Not enough data",
    position: { x: "62%", y: "65%" },
    description:
      "Communication will reflect expressive language, receptive understanding, discussion participation, and clarity of response.",
    strengths: [],
    supportNeeds: [],
    recommendation: "Collect more communication data through guided discussion, oral response, or short written reflection.",
    lastUpdated: "Not enough data yet",
  },
  {
    id: "social-emotional",
    name: "Social-Emotional",
    gradeLevel: null,
    expectedGrade: 5,
    status: "noData",
    confidence: "Not enough data",
    position: { x: "36%", y: "82%" },
    description:
      "Social-emotional data will reflect focus, confidence, frustration tolerance, task persistence, and learning regulation.",
    strengths: [],
    supportNeeds: [],
    recommendation: "Collect more data through check-ins, focus activities, and reflection prompts.",
    lastUpdated: "Not enough data yet",
  },
];

function formatGrade(value: number | null) {
  return value === null ? "No data" : `Gr ${value.toFixed(1)}`;
}

function getGradeGap(subject: SubjectProfile) {
  if (subject.gradeLevel === null) return null;
  return Number((subject.gradeLevel - subject.expectedGrade).toFixed(1));
}

function getGapText(subject: SubjectProfile) {
  const gap = getGradeGap(subject);

  if (gap === null) return "More learner activity is needed before AIVO estimates this area.";
  if (gap > 0.2) return `${gap.toFixed(1)} grade levels above expected level.`;
  if (gap < -0.2) return `${Math.abs(gap).toFixed(1)} grade levels below expected level.`;
  return "Aligned with expected grade level.";
}

function MiniIcon({ type }: { type: "brain" | "spark" | "target" | "trend" }) {
  if (type === "brain") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 4.5a3 3 0 0 0-3 3v.35A3.7 3.7 0 0 0 4.5 11a3.6 3.6 0 0 0 1 2.5A3.4 3.4 0 0 0 9 18.5V4.5Z" />
        <path d="M15 4.5a3 3 0 0 1 3 3v.35A3.7 3.7 0 0 1 19.5 11a3.6 3.6 0 0 1-1 2.5A3.4 3.4 0 0 1 15 18.5V4.5Z" />
        <path d="M9 8H7.5" />
        <path d="M9 12H7" />
        <path d="M15 8h1.5" />
        <path d="M15 12h2" />
        <path d="M12 5v14" />
      </svg>
    );
  }

  if (type === "target") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
      </svg>
    );
  }

  if (type === "trend") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17 9 12l4 4 7-8" />
        <path d="M15 8h5v5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </svg>
  );
}

export default function LearnerBrainMap({
  learnerName = "Jayden",
  expectedGrade = 5,
  subjects = defaultSubjects,
}: Readonly<LearnerBrainMapProps>) {
  const initialId = useMemo(() => {
    const withData = subjects.find((s) => s.gradeLevel !== null && s.id !== "overall");
    return withData?.id ?? subjects[0]?.id ?? "overall";
  }, [subjects]);
  const [selectedId, setSelectedId] = useState(initialId);

  const selectedSubject = useMemo(() => {
    return subjects.find((subject) => subject.id === selectedId) ?? subjects[0];
  }, [selectedId, subjects]);

  const gradePercent = selectedSubject.gradeLevel
    ? Math.min(100, Math.max(0, (selectedSubject.gradeLevel / Math.max(6, expectedGrade + 1)) * 100))
    : 0;

  const availableSubjects = subjects.filter((subject) => subject.gradeLevel !== null);
  const averageGrade =
    availableSubjects.length > 0
      ? availableSubjects.reduce((sum, subject) => sum + Number(subject.gradeLevel), 0) /
        availableSubjects.length
      : null;

  const strongestSubject = availableSubjects.reduce<SubjectProfile | null>((best, subject) => {
    if (!best) return subject;
    return Number(subject.gradeLevel) > Number(best.gradeLevel) ? subject : best;
  }, null);

  const supportSubject = availableSubjects.reduce<SubjectProfile | null>((lowest, subject) => {
    if (!lowest) return subject;
    return Number(subject.gradeLevel) < Number(lowest.gradeLevel) ? subject : lowest;
  }, null);

  return (
    <section className={styles.brainProfileSection}>
      <div className={styles.brainCard}>
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <span className={styles.iconBadge}>
              <MiniIcon type="brain" />
            </span>
            <div>
              <h2>Interactive Learning Map</h2>
              <p>Click a subject to see grade level, support needs, and recommended next steps.</p>
            </div>
          </div>

          <div className={styles.legend} aria-label="Status legend">
            <span data-status="ahead">Ahead</span>
            <span data-status="onTrack">On track</span>
            <span data-status="needsSupport">Needs support</span>
            <span data-status="noData">No data</span>
          </div>
        </div>

        <div className={styles.mapGrid}>
          <div className={styles.mapCanvas} aria-label={`${learnerName}'s interactive learning map`}>
            <svg className={styles.brainSvg} viewBox="0 0 720 460" aria-hidden="true">
              <defs>
                <radialGradient id="brainGlow" cx="50%" cy="45%" r="60%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.18" />
                  <stop offset="55%" stopColor="#8B5CF6" stopOpacity="0.09" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="brainFill" x1="15%" y1="20%" x2="90%" y2="82%">
                  <stop offset="0%" stopColor="#F5F0FF" />
                  <stop offset="48%" stopColor="#F7F2FF" />
                  <stop offset="100%" stopColor="#FFF7E8" />
                </linearGradient>

                <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="22" stdDeviation="28" floodColor="#7C3AED" floodOpacity="0.16" />
                </filter>
              </defs>

              <ellipse cx="360" cy="250" rx="285" ry="190" fill="url(#brainGlow)" />

              <path
                className={styles.brainShape}
                filter="url(#softShadow)"
                d="M143 245c-42-49-25-138 43-169 48-22 105-15 150 20 44-32 113-39 172-8 79 42 105 140 62 216-36 64-112 89-206 65-82 28-164 11-207-43-22-27-27-56-14-81Z"
                fill="url(#brainFill)"
              />

              <path
                className={styles.brainOutline}
                d="M143 245c-42-49-25-138 43-169 48-22 105-15 150 20 44-32 113-39 172-8 79 42 105 140 62 216-36 64-112 89-206 65-82 28-164 11-207-43-22-27-27-56-14-81Z"
              />

              <path className={styles.brainDivider} d="M360 98c-9 82-7 171 5 267" />
              <path className={styles.brainCircuit} d="M205 178c53-36 107-31 154 10 41 36 91 35 145-5" />
              <path className={styles.brainCircuit} d="M185 282c62-24 119-12 164 33 43 43 101 44 172 4" />
              <path className={styles.brainCircuit} d="M250 105c-22 57-17 111 15 161" />
              <path className={styles.brainCircuit} d="M472 111c25 65 14 122-34 171" />

              <circle className={styles.softNode} cx="205" cy="178" r="6" />
              <circle className={styles.softNode} cx="360" cy="188" r="6" />
              <circle className={styles.softNode} cx="504" cy="183" r="6" />
              <circle className={styles.softNode} cx="185" cy="282" r="6" />
              <circle className={styles.softNode} cx="349" cy="315" r="6" />
              <circle className={styles.softNode} cx="521" cy="319" r="6" />
            </svg>

            {subjects.map((subject) => {
              const isSelected = selectedSubject.id === subject.id;
              const nodeClass = isSelected
                ? `${styles.subjectNode} ${styles.subjectNodeSelected}`
                : styles.subjectNode;
              return (
                <button
                  key={subject.id}
                  type="button"
                  className={nodeClass}
                  data-status={subject.status}
                  style={
                    {
                      "--x": subject.position.x,
                      "--y": subject.position.y,
                    } as CSSProperties
                  }
                  onClick={() => setSelectedId(subject.id)}
                  aria-pressed={isSelected}
                  aria-label={`${subject.name}, ${formatGrade(subject.gradeLevel)}, ${
                    statusLabels[subject.status]
                  }`}
                >
                  <span className={styles.nodeDot} />
                  <span className={styles.nodeText}>
                    <strong>{subject.name}</strong>
                    <span>{formatGrade(subject.gradeLevel)}</span>
                  </span>
                  <span className={styles.nodeStatus}>{statusLabels[subject.status]}</span>
                </button>
              );
            })}
          </div>

          <aside className={styles.detailPanel} aria-live="polite">
            <div className={styles.detailTop}>
              <div>
                <p className={styles.panelLabel}>Selected area</p>
                <h3>{selectedSubject.name}</h3>
              </div>

              <span className={styles.statusPill} data-status={selectedSubject.status}>
                {statusLabels[selectedSubject.status]}
              </span>
            </div>

            <p className={styles.description}>{selectedSubject.description}</p>

            <div className={styles.levelBox}>
              <div className={styles.levelHeader}>
                <div>
                  <span>Current estimate</span>
                  <strong>{formatGrade(selectedSubject.gradeLevel)}</strong>
                </div>

                <div>
                  <span>Expected</span>
                  <strong>Gr {selectedSubject.expectedGrade.toFixed(0)}</strong>
                </div>
              </div>

              <div className={styles.levelTrack} aria-hidden="true">
                <span style={{ width: `${gradePercent}%` }} />
              </div>

              <p>{getGapText(selectedSubject)}</p>
            </div>

            <div className={styles.detailMeta}>
              <div>
                <span>Confidence</span>
                <strong>{selectedSubject.confidence}</strong>
              </div>
              <div>
                <span>Last updated</span>
                <strong>{selectedSubject.lastUpdated}</strong>
              </div>
            </div>

            <div className={styles.insightGrid}>
              <div>
                <h4>Strengths</h4>
                {selectedSubject.strengths.length > 0 ? (
                  <ul>
                    {selectedSubject.strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyText}>More learner activity is needed.</p>
                )}
              </div>

              <div>
                <h4>Needs support</h4>
                {selectedSubject.supportNeeds.length > 0 ? (
                  <ul>
                    {selectedSubject.supportNeeds.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyText}>No support pattern detected yet.</p>
                )}
              </div>
            </div>

            <div className={styles.recommendation}>
              <span className={styles.recommendationIcon}>
                <MiniIcon type="spark" />
              </span>
              <div>
                <h4>Recommended next step</h4>
                <p>{selectedSubject.recommendation}</p>
              </div>
            </div>
          </aside>
        </div>

        <div className={styles.summaryCards}>
          <div className={styles.summaryCard}>
            <span>
              <MiniIcon type="brain" />
            </span>
            <div>
              <p>Average level</p>
              <strong>{averageGrade === null ? "—" : `Gr ${averageGrade.toFixed(1)}`}</strong>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <span>
              <MiniIcon type="trend" />
            </span>
            <div>
              <p>Strongest area</p>
              <strong>{strongestSubject ? strongestSubject.name : "—"}</strong>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <span>
              <MiniIcon type="target" />
            </span>
            <div>
              <p>Focus area</p>
              <strong>{supportSubject ? supportSubject.name : "—"}</strong>
            </div>
          </div>

          <div className={styles.summaryCard}>
            <span>
              <MiniIcon type="spark" />
            </span>
            <div>
              <p>Next milestone</p>
              <strong>Reach Gr {expectedGrade.toFixed(0)}+ in {supportSubject?.name ?? "Reading"}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
