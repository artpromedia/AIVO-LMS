"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";

interface RecommendationPayload {
  targetTable?: string;
  targetField?: string;
  currentValue?: unknown;
  proposedValue?: unknown;
  reason?: string;
  evidence?: Record<string, unknown>;
  confidence?: number;
  sourceSignals?: unknown[];
  requiresParentApproval?: boolean;
  accommodation?: string;
  tutor?: string;
  domain?: string;
  level?: string;
  subject?: string;
  curriculumId?: string;
  [k: string]: unknown;
}

interface Recommendation {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string;
  payload: RecommendationPayload | null;
  amendedPayload: RecommendationPayload | null;
  appliedPayload: RecommendationPayload | null;
  evidence: Record<string, unknown> | null;
  sourceSignals: unknown[] | null;
  confidence: number | null;
  applyError: string | null;
  parentNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface Conflict {
  domain: string;
  description: string;
  conflictingRecommendations: Recommendation[];
}

const TYPE_LABELS: Record<string, string> = {
  brain_profile_review: "Brain Profile Review",
  path_adjustment: "Learning Path Adjustment",
  accommodation_add: "Add Accommodation",
  accommodation_remove: "Remove Accommodation",
  goal_suggestion: "Goal Suggestion",
  curriculum_shift: "Curriculum Shift",
  rebaseline: "Re-Baseline Assessment",
  brain_upgrade: "Brain Upgrade",
  regression_alert: "Regression Alert",
  tutor_suggestion: "Tutor Suggestion",
  functioning_level_change: "Functioning Level Change",
  iep_goal_met: "IEP Goal Met",
  iep_refresh: "IEP Refresh",
};

const TYPE_COLORS: Record<string, string> = {
  regression_alert: "bg-[hsl(var(--visual-math)/0.06)] border-[hsl(var(--visual-math)/0.3)] text-[hsl(var(--visual-math))]",
  brain_upgrade: "bg-[hsl(var(--visual-science)/0.06)] border-[hsl(var(--visual-science)/0.3)] text-[hsl(var(--visual-science))]",
  iep_goal_met: "bg-[hsl(var(--visual-science)/0.06)] border-[hsl(var(--visual-science)/0.3)] text-[hsl(var(--visual-science))]",
  accommodation_add: "bg-[hsl(var(--visual-reading)/0.06)] border-[hsl(var(--visual-reading)/0.3)] text-[hsl(var(--visual-reading))]",
  goal_suggestion: "bg-[hsl(var(--visual-primary)/0.06)] border-[hsl(var(--visual-primary)/0.3)] text-[hsl(var(--visual-primary))]",
};

// Which payload field the parent can edit when amending each recommendation type.
const AMEND_FIELD: Record<string, keyof RecommendationPayload | null> = {
  accommodation_add: "accommodation",
  accommodation_remove: "accommodation",
  tutor_suggestion: "tutor",
  functioning_level_change: "level",
  curriculum_shift: "curriculumId",
  path_adjustment: "proposedValue",
  regression_alert: "proposedValue",
  goal_suggestion: "proposedValue",
  iep_goal_met: "proposedValue",
  iep_refresh: "proposedValue",
  rebaseline: null,
  brain_profile_review: null,
  brain_upgrade: null,
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function RecommendationsPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");
  const tCommon = useTranslations("common");

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState("");
  const [amendValue, setAmendValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!accessToken || !learnerId) return;
    try {
      const [recsRes, conflictsRes] = await Promise.all([
        fetch(`/api/family/recommendations/${learnerId}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
        fetch(`/api/family/recommendations/${learnerId}/conflicts`, { headers: { Authorization: `Bearer ${accessToken}` } }),
      ]);
      if (recsRes.ok) setRecs(await recsRes.json());
      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    }
  };

  useEffect(() => { fetchData(); }, [accessToken, learnerId]);

  const startResponding = (rec: Recommendation) => {
    setRespondingTo(rec.id);
    setResponseNotes("");
    setSubmitError(null);
    const field = AMEND_FIELD[rec.type];
    const initial = field && rec.payload ? rec.payload[field] : rec.payload?.proposedValue;
    setAmendValue(initial != null ? String(initial) : "");
  };

  const respondToRec = async (rec: Recommendation, action: "APPROVED" | "DECLINED" | "ADJUSTED") => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const body: { action: string; notes?: string; amendedPayload?: RecommendationPayload } = {
        action,
        notes: responseNotes || undefined,
      };
      if (action === "ADJUSTED") {
        const field = AMEND_FIELD[rec.type];
        if (field) {
          body.amendedPayload = { [field]: amendValue };
        } else {
          body.amendedPayload = { proposedValue: amendValue };
        }
      }
      const res = await fetch(`/api/family/recommendations/${learnerId}/${rec.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSubmitError(errData.detail || errData.error || `Failed (${res.status})`);
      } else {
        setRespondingTo(null);
        setResponseNotes("");
        setAmendValue("");
        await fetchData();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  const pendingRecs = recs.filter(r => r.status === "PENDING");
  const resolvedRecs = recs.filter(r => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text">{t("recommendation_inbox")}</h1>
        <p className="vi-text-muted mt-1">{t("recommendation_desc")}</p>
      </div>

      {conflicts.length > 0 && (
        <div className="rounded-2xl p-5 border bg-[hsl(var(--visual-sel)/0.08)] border-[hsl(var(--visual-sel)/0.3)]">
          <h3 className="font-heading font-bold text-[hsl(var(--visual-sel))] mb-2">{t("conflicts_detected")}</h3>
          <p className="text-sm text-[hsl(var(--visual-sel))] mb-3">{t("conflicts_desc")}</p>
          {conflicts.map((c, i) => (
            <div key={i} className="p-3 rounded-xl bg-[hsl(var(--visual-sel)/0.12)] mb-2 text-sm text-[hsl(var(--visual-sel))]">
              <span className="font-bold">{c.domain}:</span> {c.description}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b vi-border pb-1">
        <button onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${activeTab === "pending" ? "bg-white border vi-border border-b-white text-[hsl(var(--visual-primary))] -mb-[1px]" : "vi-text-muted hover:vi-text"}`}>
          {t("pending_count", { count: pendingRecs.length })}
        </button>
        <button onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${activeTab === "history" ? "bg-white border vi-border border-b-white text-[hsl(var(--visual-primary))] -mb-[1px]" : "vi-text-muted hover:vi-text"}`}>
          {t("history_count", { count: resolvedRecs.length })}
        </button>
      </div>

      {activeTab === "pending" && (
        <div className="space-y-4">
          {pendingRecs.length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="science" size="lg"><CheckCircle2 className="w-10 h-10" /></IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("no_pending")}</p>
            </div>
          ) : (
            pendingRecs.map(rec => {
              const amendField = AMEND_FIELD[rec.type];
              const canAmend = amendField !== null && amendField !== undefined;
              return (
                <div key={rec.id} className={`rounded-2xl p-5 border shadow-sm ${TYPE_COLORS[rec.type] || "vi-card"}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wide opacity-70">
                        {TYPE_LABELS[rec.type] || rec.type}
                      </span>
                      <h3 className="font-heading font-bold text-lg mt-1">{rec.title}</h3>
                    </div>
                    <span className="text-xs vi-text-muted">{new Date(rec.createdAt).toLocaleDateString()}</span>
                  </div>
                  {rec.description && <p className="text-sm mb-3 opacity-80">{rec.description}</p>}

                  {rec.payload && (
                    <div className="text-xs mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-white/40">
                      {rec.payload.targetField && (
                        <div><span className="font-bold opacity-70">Field:</span> {rec.payload.targetField}</div>
                      )}
                      {rec.payload.currentValue !== undefined && rec.payload.currentValue !== null && (
                        <div><span className="font-bold opacity-70">Current:</span> {formatValue(rec.payload.currentValue)}</div>
                      )}
                      {rec.payload.proposedValue !== undefined && rec.payload.proposedValue !== null && (
                        <div><span className="font-bold opacity-70">Proposed:</span> {formatValue(rec.payload.proposedValue)}</div>
                      )}
                      {rec.payload.reason && (
                        <div className="sm:col-span-2"><span className="font-bold opacity-70">Why:</span> {rec.payload.reason}</div>
                      )}
                      {rec.confidence != null && (
                        <div><span className="font-bold opacity-70">Confidence:</span> {(rec.confidence * 100).toFixed(0)}%</div>
                      )}
                      {rec.sourceSignals && rec.sourceSignals.length > 0 && (
                        <div className="sm:col-span-2"><span className="font-bold opacity-70">Signals:</span> {rec.sourceSignals.map((s) => String(s)).join(", ")}</div>
                      )}
                    </div>
                  )}

                  {rec.applyError && (
                    <div className="text-xs mb-3 p-2 rounded bg-[hsl(var(--visual-math)/0.1)] text-[hsl(var(--visual-math))]">
                      Previous apply attempt failed: {rec.applyError}. You can retry.
                    </div>
                  )}

                  {respondingTo === rec.id ? (
                    <div className="space-y-3 mt-3 p-3 rounded-xl bg-white/50">
                      {canAmend && (
                        <div>
                          <label className="text-xs font-bold opacity-70 mb-1 block">
                            {t("adjust_value_label")}
                          </label>
                          <input
                            type="text"
                            value={amendValue}
                            onChange={(e) => setAmendValue(e.target.value)}
                            placeholder={String(rec.payload?.proposedValue ?? "")}
                            className="w-full px-4 py-2.5 rounded-xl border vi-border outline-none text-sm font-body"
                          />
                          <p className="text-xs vi-text-muted mt-1">
                            {t("adjust_value_help")}
                          </p>
                        </div>
                      )}
                      <textarea value={responseNotes} onChange={(e) => setResponseNotes(e.target.value)}
                        placeholder={t("add_notes")}
                        className="w-full px-4 py-2.5 rounded-xl border vi-border outline-none text-sm font-body resize-none h-20" />
                      {submitError && (
                        <div className="text-xs p-2 rounded bg-[hsl(var(--visual-math)/0.1)] text-[hsl(var(--visual-math))]">
                          {submitError}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => respondToRec(rec, "APPROVED")}
                          disabled={submitting}
                          className="px-4 py-2 rounded-full bg-[hsl(var(--visual-science))] text-white font-bold text-sm hover:bg-[hsl(var(--visual-science)/0.9)] transition disabled:opacity-50"
                          style={{ minHeight: 44 }}>
                          {t("approve")}
                        </button>
                        {canAmend && (
                          <button onClick={() => respondToRec(rec, "ADJUSTED")}
                            disabled={submitting || !amendValue.trim()}
                            className="px-4 py-2 rounded-full bg-[hsl(var(--visual-sel))] text-white font-bold text-sm hover:bg-[hsl(var(--visual-sel)/0.9)] transition disabled:opacity-50"
                            style={{ minHeight: 44 }}>
                            {t("adjust")}
                          </button>
                        )}
                        <button onClick={() => respondToRec(rec, "DECLINED")}
                          disabled={submitting}
                          className="px-4 py-2 rounded-full bg-[hsl(var(--visual-math))] text-white font-bold text-sm hover:bg-[hsl(var(--visual-math)/0.9)] transition disabled:opacity-50"
                          style={{ minHeight: 44 }}>
                          {t("decline")}
                        </button>
                        <button onClick={() => setRespondingTo(null)}
                          disabled={submitting}
                          className="px-4 py-2 rounded-full vi-surface-soft vi-text-muted font-bold text-sm hover:bg-[hsl(var(--visual-border))] transition"
                          style={{ minHeight: 44 }}>
                          {tCommon("cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startResponding(rec)}
                      className="px-5 py-2 rounded-full bg-[hsl(var(--visual-primary))] text-white font-heading font-black uppercase tracking-wider text-sm hover:bg-[hsl(var(--visual-primary)/0.9)] transition"
                      style={{ minHeight: 44 }}>
                      {t("respond")}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          {resolvedRecs.length === 0 ? (
            <div className="vi-card p-12 text-center">
              <div className="flex justify-center mb-3">
                <IconWell color="primary" size="lg"><ClipboardList className="w-10 h-10" /></IconWell>
              </div>
              <p className="vi-text-muted font-semibold">{t("no_resolved")}</p>
            </div>
          ) : (
            resolvedRecs.map(rec => (
              <div key={rec.id} className="vi-card p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs vi-text-muted font-bold uppercase">{TYPE_LABELS[rec.type] || rec.type}</span>
                  <div className="font-heading font-bold text-slate-800">{rec.title}</div>
                  {rec.parentNotes && <p className="text-xs vi-text-muted mt-1">{t("note_label")}: {rec.parentNotes}</p>}
                  {rec.appliedPayload && rec.status !== "DECLINED" && (
                    <p className="text-xs vi-text-muted mt-1">
                      Applied: {formatValue(rec.appliedPayload.proposedValue ?? rec.appliedPayload.accommodation ?? rec.appliedPayload.tutor ?? rec.appliedPayload.level)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-xs rounded-full font-bold ${
                    rec.status === "APPROVED" ? "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]" :
                    rec.status === "DECLINED" ? "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" :
                    "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]"
                  }`}>{rec.status}</span>
                  <span className="text-xs vi-text-muted">
                    {rec.resolvedAt ? new Date(rec.resolvedAt).toLocaleDateString() : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
