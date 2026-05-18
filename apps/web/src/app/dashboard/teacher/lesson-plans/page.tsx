"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import LearnerCardSkeleton from "@/components/states/LearnerCardSkeleton";
import FetchErrorState from "@/components/states/FetchErrorState";
import { ClipboardList } from "lucide-react";
import TeacherCurriculumUploader from "@/components/teacher/TeacherCurriculumUploader";

interface ConnectedLearner {
  id: string;
  name: string;
  functioningLevel: string;
  gradeLevel: string;
}

interface LessonPlan {
  id: string;
  learnerId: string;
  subject: string;
  title: string;
  gradeLevel?: string;
  status: string;
  content: Record<string, unknown>;
  accommodations: unknown[];
  activities: unknown[];
  formativeAssessments: unknown[];
  createdAt: string;
  updatedAt: string;
}

const SUBJECTS = [
  "Mathematics",
  "English Language Arts",
  "Science",
  "History & Social Studies",
  "Coding & Computer Science",
  "Speech & Language",
  "Social-Emotional Learning",
];

export default function TeacherLessonPlansPage() {
  const { user, accessToken, loading } = useAuth();
  const t = useTranslations("teacher");
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [learners, setLearners] = useState<ConnectedLearner[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const [formLearnerId, setFormLearnerId] = useState("");
  const [formSubject, setFormSubject] = useState(SUBJECTS[0]);
  const [formGrade, setFormGrade] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken || !user) return;
    setFetchError(false);
    setLoadingData(true);
    try {
      const [plansData, learnersData] = await Promise.all([
        fetch("/api/engagement/lesson-plans/teacher", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/family/collaboration/connected-learners", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => (r.ok ? r.json() : [])),
      ]);
      setPlans(Array.isArray(plansData) ? plansData : []);
      const parsed = Array.isArray(learnersData) ? learnersData : [];
      setLearners(parsed);
      if (parsed.length > 0 && !formLearnerId) setFormLearnerId(parsed[0].id);
    } catch {
      setFetchError(true);
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    if (!accessToken || !formLearnerId) return;
    setGenerating(true);
    setGenError(null);
    try {
      const learner = learners.find((l) => l.id === formLearnerId);
      const res = await fetch("/api/engagement/lesson-plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          learnerId: formLearnerId,
          subject: formSubject,
          gradeLevel: formGrade || learner?.gradeLevel || "3rd",
          topic: formTopic || undefined,
          functioningLevel: learner?.functioningLevel || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }
      setShowForm(false);
      setFormTopic("");
      await fetchData();
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !user) return null;

  const getLearnerName = (id: string) => learners.find((l) => l.id === id)?.name || "Unknown";

  return (
    <div className="p-8 space-y-6">
      <TeacherCurriculumUploader learners={learners} accessToken={accessToken} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-heading font-bold vi-text">Lesson Plans</h1>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{ minHeight: "44px" }}
          className="px-5 py-2.5 rounded-xl bg-[hsl(var(--visual-reading))] text-white font-bold text-sm hover:bg-[hsl(var(--visual-reading)/0.9)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-reading))] focus-visible:ring-offset-2"
        >
          {showForm ? "Cancel" : "Generate New Plan"}
        </button>
      </div>

      {showForm && (
        <div className="vi-card p-6 space-y-4">
          <h2 className="text-lg font-heading font-bold vi-text">AI Lesson Plan Generator</h2>
          <p className="text-sm vi-text-muted">
            Generate a differentiated lesson plan based on your learner&apos;s Brain Clone profile.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="lp-learner" className="block text-sm font-semibold vi-text mb-1">
                Learner
              </label>
              <select
                id="lp-learner"
                value={formLearnerId}
                onChange={(e) => setFormLearnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border vi-border text-sm bg-[hsl(var(--visual-surface))] vi-text"
              >
                {learners.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.functioningLevel || "Pending"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lp-subject" className="block text-sm font-semibold vi-text mb-1">
                Subject
              </label>
              <select
                id="lp-subject"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border vi-border text-sm bg-[hsl(var(--visual-surface))] vi-text"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="lp-grade" className="block text-sm font-semibold vi-text mb-1">
                Grade Level
              </label>
              <input
                id="lp-grade"
                type="text"
                value={formGrade}
                onChange={(e) => setFormGrade(e.target.value)}
                placeholder="e.g., 3rd"
                className="w-full px-3 py-2 rounded-lg border vi-border text-sm bg-[hsl(var(--visual-surface))] vi-text"
              />
            </div>
            <div>
              <label htmlFor="lp-topic" className="block text-sm font-semibold vi-text mb-1">
                Topic (optional)
              </label>
              <input
                id="lp-topic"
                type="text"
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="e.g., Fractions"
                className="w-full px-3 py-2 rounded-lg border vi-border text-sm bg-[hsl(var(--visual-surface))] vi-text"
              />
            </div>
          </div>

          {genError && (
            <p className="text-sm text-[hsl(var(--visual-math))] font-medium" role="alert">
              {genError}
            </p>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !formLearnerId}
            style={{ minHeight: "44px" }}
            className="px-6 py-2.5 rounded-xl bg-[hsl(var(--visual-reading))] text-white font-bold text-sm hover:bg-[hsl(var(--visual-reading)/0.9)] transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-reading))] focus-visible:ring-offset-2"
          >
            {generating ? "Generating..." : "Generate Lesson Plan"}
          </button>
        </div>
      )}

      {loadingData ? (
        <LearnerCardSkeleton count={3} />
      ) : fetchError ? (
        <FetchErrorState title="Unable to load lesson plans" onRetry={fetchData} />
      ) : plans.length === 0 ? (
        <div className="vi-card p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <p className="vi-text font-heading font-bold text-xl">No lesson plans yet</p>
          <p className="text-sm vi-text-muted mt-2 max-w-md mx-auto">
            Click &quot;Generate New Plan&quot; above to create your first AI-powered lesson plan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className="vi-card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                aria-expanded={expandedPlan === plan.id}
                aria-controls={`plan-details-${plan.id}`}
                className="w-full text-left px-6 py-4 flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--visual-reading))] focus-visible:ring-offset-2"
              >
                <div>
                  <h3 className="font-heading font-bold vi-text">{plan.title}</h3>
                  <p className="text-sm vi-text-muted mt-0.5">
                    {getLearnerName(plan.learnerId)} &middot; {plan.subject} &middot;{" "}
                    {new Date(plan.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 text-xs rounded-full font-bold ${plan.status === "DRAFT" ? "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]" : "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]"}`}
                >
                  {plan.status}
                </span>
              </button>
              {expandedPlan === plan.id && (
                <div
                  id={`plan-details-${plan.id}`}
                  className="px-6 pb-6 border-t vi-border space-y-4"
                >
                  {plan.content &&
                    typeof plan.content === "object" &&
                    (() => {
                      const c = plan.content as Record<string, string>;
                      return (
                        <div className="space-y-3 pt-4">
                          {c.objective && (
                            <div>
                              <h4 className="text-sm font-semibold vi-text">Objective</h4>
                              <p className="text-sm vi-text-muted">{c.objective}</p>
                            </div>
                          )}
                          {c.overview && (
                            <div>
                              <h4 className="text-sm font-semibold vi-text">Overview</h4>
                              <p className="text-sm vi-text-muted">{c.overview}</p>
                            </div>
                          )}
                          {c.duration && (
                            <div>
                              <h4 className="text-sm font-semibold vi-text">Duration</h4>
                              <p className="text-sm vi-text-muted">{c.duration}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  {Array.isArray(plan.activities) && plan.activities.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold vi-text mb-2">Activities</h4>
                      <div className="space-y-2">
                        {plan.activities.map((a: unknown, i: number) => {
                          const act = a as Record<string, string>;
                          return (
                            <div
                              key={i}
                              className="vi-surface-soft rounded-lg p-3 border vi-border"
                            >
                              <p className="font-medium text-sm vi-text">
                                {act.name || `Activity ${i + 1}`}
                              </p>
                              <p className="text-xs vi-text-muted mt-0.5">
                                {act.description || ""}
                              </p>
                              {act.duration && (
                                <p className="text-xs text-[hsl(var(--visual-reading))] mt-1">
                                  {act.duration}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {Array.isArray(plan.accommodations) && plan.accommodations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold vi-text mb-2">Accommodations</h4>
                      <ul className="space-y-1">
                        {plan.accommodations.map((a: unknown, i: number) => {
                          const acc = a as Record<string, string>;
                          return (
                            <li key={i} className="text-sm vi-text-muted flex gap-2">
                              <span className="font-medium vi-text">{acc.type || ""}:</span>
                              {acc.description || ""}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
