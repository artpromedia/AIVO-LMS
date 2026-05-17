"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Sparkles, Plus, Trash2, ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";

const ASSESSMENT_AREAS = [
  "academic",
  "cognitive",
  "communication",
  "social_emotional",
  "behavioral",
  "motor",
  "adaptive",
  "vision",
  "hearing",
  "health",
] as const;

const IDEA_CATEGORIES = [
  "autism",
  "specific_learning_disability",
  "speech_language_impairment",
  "other_health_impairment",
  "emotional_disturbance",
  "intellectual_disability",
  "developmental_delay",
  "hearing_impairment",
  "visual_impairment",
  "orthopedic_impairment",
  "traumatic_brain_injury",
  "multiple_disabilities",
  "deaf_blindness",
  "deafness",
] as const;

type Area = { area: string; method?: string; findings?: string; score?: string };

interface Evaluation {
  id: string;
  learnerId: string;
  status: "draft" | "submitted" | "eligibility_determined";
  referralReason: string | null;
  assessmentAreas: Area[] | null;
  observations: string | null;
  parentInput: string | null;
  aiSuggestion: {
    eligible_likely?: boolean;
    suggested_categories?: string[];
    rationale?: string;
    recommended_next_steps?: string[];
    confidence?: number;
  } | null;
  decisionEligible: string | null;
  decisionCategories: string[] | null;
  decisionRationale: string | null;
  decidedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  submitted: "bg-[hsl(var(--visual-reading)/0.14)] text-[hsl(var(--visual-reading))]",
  eligibility_determined: "bg-[hsl(var(--visual-science)/0.16)] text-[hsl(var(--visual-science))]",
};

export default function TeacherEvaluationPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const learnerId = params.learnerId as string;
  const t = useTranslations("evaluation");

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    referralReason: string;
    assessmentAreas: Area[];
    observations: string;
    parentInput: string;
  }>({ referralReason: "", assessmentAreas: [], observations: "", parentInput: "" });
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [busyDecision, setBusyDecision] = useState(false);
  const [decisionCats, setDecisionCats] = useState<string[]>([]);
  const [decisionRationale, setDecisionRationale] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken || !learnerId) return;
    setLoadingList(true);
    try {
      const r = await fetch(`/api/iep/evaluations/learner/${learnerId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) {
        setError(r.status === 403 ? t("error_no_access") : t("error_load"));
        setEvaluations([]);
        return;
      }
      const list = (await r.json()) as Evaluation[];
      setEvaluations(list);
      if (!activeId && list.length) setActiveId(list[0].id);
    } catch {
      setError(t("error_load"));
    } finally {
      setLoadingList(false);
    }
  }, [accessToken, learnerId, activeId, t]);

  useEffect(() => { refresh(); }, [refresh]);

  const active = evaluations.find((e) => e.id === activeId) || null;

  useEffect(() => {
    if (active) {
      setDraft({
        referralReason: active.referralReason || "",
        assessmentAreas: Array.isArray(active.assessmentAreas) ? active.assessmentAreas : [],
        observations: active.observations || "",
        parentInput: active.parentInput || "",
      });
      setDecisionCats(active.decisionCategories || active.aiSuggestion?.suggested_categories || []);
      setDecisionRationale(active.decisionRationale || "");
    }
  }, [activeId, active?.updatedAt]);  

  if (loading || !user) return null;

  const createDraft = async () => {
    if (!accessToken) return;
    setError(null);
    const r = await fetch("/api/iep/evaluations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ learnerId, assessmentAreas: [] }),
    });
    if (!r.ok) {
      setError(r.status === 403 ? t("error_no_access") : t("error_save"));
      return;
    }
    const ev = await r.json();
    setActiveId(ev.id);
    refresh();
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/iep/evaluations/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(draft),
      });
      if (!r.ok) setError(t("error_save"));
      else await refresh();
    } finally { setSaving(false); }
  };

  const requestSuggestion = async () => {
    if (!active) return;
    setSuggesting(true);
    setError(null);
    try {
      // Save first, so the AI sees the latest values.
      await fetch(`/api/iep/evaluations/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(draft),
      });
      const r = await fetch(`/api/iep/evaluations/${active.id}/suggest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) setError(t("error_suggest"));
      else await refresh();
    } finally { setSuggesting(false); }
  };

  const submitForReview = async () => {
    if (!active) return;
    setSaving(true);
    setError(null);
    try {
      const saveRes = await fetch(`/api/iep/evaluations/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(draft),
      });
      if (!saveRes.ok) {
        setError(t("error_save"));
        return;
      }
      const r = await fetch(`/api/iep/evaluations/${active.id}/submit`, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) setError(t("error_save"));
      else await refresh();
    } finally { setSaving(false); }
  };

  const recordDecision = async (decision: "eligible" | "not_eligible" | "needs_more_data") => {
    if (!active) return;
    setBusyDecision(true);
    setError(null);
    try {
      const r = await fetch(`/api/iep/evaluations/${active.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ decision, categories: decisionCats, rationale: decisionRationale }),
      });
      if (!r.ok) setError(t("error_save"));
      else await refresh();
    } finally { setBusyDecision(false); }
  };

  const editable = active && (active.status === "draft" || active.status === "submitted");

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <button onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-sm font-bold vi-text-muted hover:vi-text">
        <ArrowLeft size={16} strokeWidth={2.5} aria-hidden="true" /> {t("back_to_classes")}
      </button>

      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] flex items-center justify-center">
            <ClipboardList size={28} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold vi-text">{t("title")}</h1>
            <p className="text-sm vi-text-muted font-medium mt-1">{t("subtitle")}</p>
          </div>
        </div>
        <button onClick={createDraft} style={{ minHeight: 44 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white font-bold text-sm">
          <Plus size={16} strokeWidth={3} aria-hidden="true" /> {t("new_evaluation")}
        </button>
      </header>

      {error && (
        <div className="vi-card p-3 border-2 border-[hsl(var(--visual-math)/0.4)] text-sm text-[hsl(var(--visual-math))]">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="vi-card p-3 h-fit">
          <h2 className="text-xs font-black uppercase tracking-wide vi-text-muted px-2 py-2">{t("history")}</h2>
          {loadingList ? (
            <p className="px-2 py-3 text-sm vi-text-muted">{t("loading")}</p>
          ) : evaluations.length === 0 ? (
            <p className="px-2 py-3 text-sm vi-text-muted">{t("none_yet")}</p>
          ) : (
            <ul className="space-y-1">
              {evaluations.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setActiveId(e.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold ${activeId === e.id ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : "vi-text hover:vi-surface-soft"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${STATUS_STYLE[e.status]}`}>
                        {t(`status_${e.status}`)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="space-y-5">
          {!active ? (
            <div className="vi-card p-12 text-center">
              <p className="vi-text-muted font-semibold">{t("select_or_create")}</p>
            </div>
          ) : (
            <>
              <div className="vi-card p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-wide vi-text-muted">{t("referral_reason")}</label>
                  <textarea rows={2} value={draft.referralReason} disabled={!editable}
                    onChange={(e) => setDraft((d) => ({ ...d, referralReason: e.target.value }))}
                    className="w-full p-3 rounded-xl border-2 vi-border bg-white text-sm disabled:bg-slate-50" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wide vi-text-muted">{t("assessment_areas")}</label>
                    {editable && (
                      <button type="button" onClick={() => setDraft((d) => ({ ...d, assessmentAreas: [...d.assessmentAreas, { area: ASSESSMENT_AREAS[0] }] }))}
                        className="text-xs font-bold text-[hsl(var(--visual-reading))] inline-flex items-center gap-1">
                        <Plus size={12} strokeWidth={3} aria-hidden="true" /> {t("add_area")}
                      </button>
                    )}
                  </div>
                  {draft.assessmentAreas.length === 0 && (
                    <p className="text-sm vi-text-muted">{t("no_areas_yet")}</p>
                  )}
                  <div className="space-y-2">
                    {draft.assessmentAreas.map((a, i) => (
                      <div key={i} className="grid grid-cols-1 md:grid-cols-[160px_140px_1fr_120px_auto] gap-2 items-start">
                        <select value={a.area} disabled={!editable}
                          onChange={(e) => setDraft((d) => {
                            const next = [...d.assessmentAreas]; next[i] = { ...a, area: e.target.value }; return { ...d, assessmentAreas: next };
                          })}
                          className="p-2 rounded-lg border-2 vi-border text-sm bg-white">
                          {ASSESSMENT_AREAS.map((opt) => <option key={opt} value={opt}>{t(`area_${opt}`)}</option>)}
                        </select>
                        <input placeholder={t("method_placeholder")} value={a.method || ""} disabled={!editable}
                          onChange={(e) => setDraft((d) => {
                            const next = [...d.assessmentAreas]; next[i] = { ...a, method: e.target.value }; return { ...d, assessmentAreas: next };
                          })}
                          className="p-2 rounded-lg border-2 vi-border text-sm" />
                        <input placeholder={t("findings_placeholder")} value={a.findings || ""} disabled={!editable}
                          onChange={(e) => setDraft((d) => {
                            const next = [...d.assessmentAreas]; next[i] = { ...a, findings: e.target.value }; return { ...d, assessmentAreas: next };
                          })}
                          className="p-2 rounded-lg border-2 vi-border text-sm" />
                        <input placeholder={t("score_placeholder")} value={a.score || ""} disabled={!editable}
                          onChange={(e) => setDraft((d) => {
                            const next = [...d.assessmentAreas]; next[i] = { ...a, score: e.target.value }; return { ...d, assessmentAreas: next };
                          })}
                          className="p-2 rounded-lg border-2 vi-border text-sm" />
                        {editable && (
                          <button type="button" aria-label={t("remove_area")}
                            onClick={() => setDraft((d) => ({ ...d, assessmentAreas: d.assessmentAreas.filter((_, j) => j !== i) }))}
                            className="p-2 text-[hsl(var(--visual-math))] hover:bg-[hsl(var(--visual-math)/0.08)] rounded-lg">
                            <Trash2 size={16} strokeWidth={2.5} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-wide vi-text-muted">{t("observations")}</label>
                    <textarea rows={4} value={draft.observations} disabled={!editable}
                      onChange={(e) => setDraft((d) => ({ ...d, observations: e.target.value }))}
                      className="w-full p-3 rounded-xl border-2 vi-border bg-white text-sm disabled:bg-slate-50" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-wide vi-text-muted">{t("parent_input")}</label>
                    <textarea rows={4} value={draft.parentInput} disabled={!editable}
                      onChange={(e) => setDraft((d) => ({ ...d, parentInput: e.target.value }))}
                      className="w-full p-3 rounded-xl border-2 vi-border bg-white text-sm disabled:bg-slate-50" />
                  </div>
                </div>

                {editable && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button onClick={save} disabled={saving} style={{ minHeight: 44 }}
                      className="px-4 py-2 rounded-full vi-surface-soft vi-text font-bold text-sm border-2 vi-border disabled:opacity-50">
                      {saving ? t("saving") : t("save_draft")}
                    </button>
                    <button onClick={requestSuggestion} disabled={suggesting} style={{ minHeight: 44 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-primary))] text-white font-bold text-sm disabled:opacity-50">
                      {suggesting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} strokeWidth={2.5} aria-hidden="true" />}
                      {suggesting ? t("getting_suggestion") : t("get_ai_suggestion")}
                    </button>
                    {active.status === "draft" && (
                      <button onClick={submitForReview} style={{ minHeight: 44 }}
                        className="px-4 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white font-bold text-sm">
                        {t("submit_for_review")}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {active.aiSuggestion && (
                <div className="vi-card p-5 border-2 border-[hsl(var(--visual-primary)/0.3)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={18} className="text-[hsl(var(--visual-primary))]" aria-hidden="true" />
                    <h3 className="font-heading font-bold vi-text">{t("ai_suggestion")}</h3>
                    <span className="ml-auto text-xs vi-text-muted font-bold">
                      {t("confidence")}: {active.aiSuggestion.confidence ?? 0}%
                    </span>
                  </div>
                  <p className="text-sm vi-text mb-3">
                    <span className="font-bold">{t("eligible_likely")}: </span>
                    {active.aiSuggestion.eligible_likely ? t("yes") : t("no")}
                  </p>
                  {active.aiSuggestion.suggested_categories?.length ? (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {active.aiSuggestion.suggested_categories.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded-full text-xs font-bold bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]">
                          {t.has(`category_${c}`) ? t(`category_${c}`) : c}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {active.aiSuggestion.rationale && (
                    <p className="text-sm vi-text-muted italic mb-3">{active.aiSuggestion.rationale}</p>
                  )}
                  {active.aiSuggestion.recommended_next_steps?.length ? (
                    <ul className="text-sm vi-text list-disc pl-5 space-y-1">
                      {active.aiSuggestion.recommended_next_steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  ) : null}
                  <p className="text-[11px] vi-text-muted mt-3">{t("ai_disclaimer")}</p>
                </div>
              )}

              {active.status === "submitted" && (
                <div className="vi-card p-5 border-2 border-[hsl(var(--visual-sel)/0.3)] space-y-3">
                  <h3 className="font-heading font-bold vi-text">{t("team_decision")}</h3>
                  <p className="text-xs vi-text-muted">{t("team_decision_help")}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {IDEA_CATEGORIES.map((c) => {
                      const on = decisionCats.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => setDecisionCats((d) => on ? d.filter((x) => x !== c) : [...d, c])}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 ${on ? "bg-[hsl(var(--visual-reading))] text-white border-[hsl(var(--visual-reading))]" : "vi-surface-soft vi-text vi-border"}`}>
                          {t(`category_${c}`)}
                        </button>
                      );
                    })}
                  </div>
                  <textarea rows={3} value={decisionRationale} placeholder={t("decision_rationale_placeholder")}
                    onChange={(e) => setDecisionRationale(e.target.value)}
                    className="w-full p-3 rounded-xl border-2 vi-border bg-white text-sm" />
                  <div className="flex gap-2">
                    <button disabled={busyDecision} onClick={() => recordDecision("eligible")} style={{ minHeight: 44 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-science))] text-white font-bold text-sm disabled:opacity-50">
                      <CheckCircle2 size={16} strokeWidth={2.5} aria-hidden="true" /> {t("decision_eligible")}
                    </button>
                    <button disabled={busyDecision} onClick={() => recordDecision("needs_more_data")} style={{ minHeight: 44 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-sel))] text-white font-bold text-sm disabled:opacity-50">
                      {t("decision_needs_more_data")}
                    </button>
                    <button disabled={busyDecision} onClick={() => recordDecision("not_eligible")} style={{ minHeight: 44 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-math))] text-white font-bold text-sm disabled:opacity-50">
                      <XCircle size={16} strokeWidth={2.5} aria-hidden="true" /> {t("decision_not_eligible")}
                    </button>
                  </div>
                </div>
              )}

              {active.status === "eligibility_determined" && (
                <div className="vi-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    {active.decisionEligible === "eligible"
                      ? <CheckCircle2 className="text-[hsl(var(--visual-science))]" aria-hidden="true" />
                      : active.decisionEligible === "not_eligible"
                        ? <XCircle className="text-[hsl(var(--visual-math))]" aria-hidden="true" />
                        : null}
                    <h3 className="font-heading font-bold vi-text">
                      {active.decisionEligible === "eligible"
                        ? t("found_eligible")
                        : active.decisionEligible === "not_eligible"
                          ? t("found_not_eligible")
                          : t("found_needs_more_data")}
                    </h3>
                  </div>
                  {active.decisionCategories?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {active.decisionCategories.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded-full text-xs font-bold bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]">
                          {t.has(`category_${c}`) ? t(`category_${c}`) : c}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {active.decisionRationale && <p className="text-sm vi-text-muted italic">{active.decisionRationale}</p>}
                  {active.decidedAt && <p className="text-xs vi-text-muted">{t("decided_at", { date: new Date(active.decidedAt).toLocaleString() })}</p>}
                  {active.decisionEligible === "eligible" && (
                    <button
                      type="button"
                      onClick={() => router.push(
                        `/dashboard/teacher/learners/${learnerId}/iep/draft?fromEvaluation=${active.id}`,
                      )}
                      style={{ minHeight: 44 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-reading))] text-white text-sm font-bold">
                      {t("start_iep_draft")}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
