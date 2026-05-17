"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Image from "next/image";
import { TUTORS, type TutorKey } from "@aivo/brand";
import { useTranslations } from "next-intl";
import { IconWell } from "@/components/discovery/_vi";
import { Brain, Check, Circle, type LucideIcon } from "lucide-react";

interface BrainOverview {
  total: number;
  byStatus: Record<string, number>;
  byLevel: Record<string, number>;
  recentClones: { learnerId: string; learnerName: string; version: number; status: string; createdAt: string }[];
}

const STATUS_COLORS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" },
  pending_parent_review: { label: "Pending Review", color: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" },
  archived: { label: "Archived", color: "vi-surface-soft vi-text-muted" },
  declined: { label: "Declined", color: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" },
};

const LEVEL_COLORS: Record<string, string> = {
  STANDARD: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  SUPPORTED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  LOW_VERBAL: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  NON_VERBAL: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  PRE_SYMBOLIC: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
};

const AI_PROVIDERS = [
  { name: "Claude Opus 4.7", provider: "Anthropic", status: "primary", model: "claude-opus-4-7", color: "text-[hsl(var(--visual-primary))]" },
  { name: "Claude Sonnet 4.6", provider: "Anthropic", status: "primary", model: "claude-sonnet-4-6", color: "text-[hsl(var(--visual-primary))]" },
  { name: "Claude Haiku 4.5", provider: "Anthropic", status: "primary", model: "claude-haiku-4-5", color: "text-[hsl(var(--visual-primary))]" },
  { name: "Gemini 3.0 Pro", provider: "Google", status: "fallback", model: "gemini-3.0-pro", color: "text-[hsl(var(--visual-reading))]" },
  { name: "GPT-5.5", provider: "OpenAI", status: "fallback", model: "gpt-5.5", color: "text-[hsl(var(--visual-science))]" },
];

export default function AdminAIPage() {
  const { accessToken } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const [brainOverview, setBrainOverview] = useState<BrainOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTutor, setExpandedTutor] = useState<TutorKey | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    fetch("/api/admin-svc/stats", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((stats) => {
        if (stats) {
          setBrainOverview({
            total: stats.totalLearners || 0,
            byStatus: {},
            byLevel: {},
            recentClones: [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <IconWell color="primary">
          <Brain size={28} strokeWidth={2.5} aria-hidden="true" />
        </IconWell>
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("ai_usage")}</h1>
          <p className="text-sm vi-text-muted mt-1">Monitor brain clones, AI model performance, and content generation across the platform.</p>
        </div>
      </div>

      <div className="bg-[hsl(var(--visual-primary))] rounded-2xl p-6 text-white">
        <h2 className="font-heading font-bold text-lg mb-4">{t("ai_usage")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-3xl font-bold">{brainOverview?.total ?? "—"}</p>
            <p className="text-sm text-purple-200">Total Learners</p>
          </div>
          <div>
            <p className="text-3xl font-bold">5</p>
            <p className="text-sm text-purple-200">Functioning Levels</p>
          </div>
          <div>
            <p className="text-3xl font-bold">14</p>
            <p className="text-sm text-purple-200">AI Tutors</p>
          </div>
          <div>
            <p className="text-3xl font-bold">3</p>
            <p className="text-sm text-purple-200">LLM Providers</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">{t("services")}</h2>
          <p className="text-xs vi-text-muted mb-4">Priority: Claude 4.7 adaptive (Opus → Sonnet → Haiku) → Gemini 3.0 Pro → GPT-5.5</p>
          <div className="space-y-3">
            {AI_PROVIDERS.map((p) => (
              <div key={p.name} className="flex items-center justify-between p-4 rounded-xl border vi-border hover:border-[hsl(var(--visual-primary)/0.3)] transition">
                <div className="flex items-center gap-3">
                  <Circle size={20} strokeWidth={2.5} className={`${p.color} fill-current`} aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold vi-text">{p.name}</p>
                    <p className="text-xs vi-text-muted">{p.provider} &middot; {p.model}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${
                  p.status === "primary" ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" : "vi-surface-soft vi-text-muted"
                }`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg vi-text mb-4">{td("overview")}</h2>
          <div className="space-y-4">
            {[
              { step: "1", label: "Baseline Assessment", desc: "6-domain Discovery Adventure", status: "active" },
              { step: "2", label: "Parent Questionnaire", desc: "49-question intake form (11 categories)", status: "active" },
              { step: "3", label: "Functioning Level Classification", desc: "5-level auto-classification", status: "active" },
              { step: "4", label: "Brain State Creation", desc: "Mastery levels, accommodations, tutor config", status: "active" },
              { step: "5", label: "XAI Explanation Generation", desc: "Transparent decision rationale", status: "active" },
              { step: "6", label: "Parent Review & Approval", desc: "Approve / Add Context / Start Over", status: "active" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {s.step}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold vi-text">{s.label}</p>
                    <span className="w-2 h-2 rounded-full bg-[hsl(var(--visual-science))]" />
                  </div>
                  <p className="text-xs vi-text-muted">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">{t("audit_logs")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "COPPA Consent Gate", status: true, detail: "Parental consent required before data collection" },
            { label: "Content Safety Filter", status: true, detail: "All AI-generated content passes quality & safety checks" },
            { label: "Bias Detection", status: true, detail: "Content checked for cultural and demographic sensitivity" },
            { label: "Data Encryption", status: true, detail: "Brain state encrypted at rest (AES-256)" },
            { label: "Parent Approval Loop", status: true, detail: "Level changes and accommodations require parent consent" },
            { label: "Full Audit Trail", status: true, detail: "Every brain version tracked with decision rationale" },
          ].map((c) => (
            <div key={c.label} className="flex items-start gap-3 p-4 rounded-xl bg-[hsl(var(--visual-science)/0.08)] border border-[hsl(var(--visual-science)/0.25)]">
              <Check size={16} strokeWidth={3} className="text-[hsl(var(--visual-science))] mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold vi-text">{c.label}</p>
                <p className="text-xs vi-text-muted mt-0.5">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="vi-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-lg vi-text">{t("ai_usage")}</h2>
          <div className="flex items-center gap-3 text-xs vi-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--visual-reading))]" /> 7 Core</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[hsl(var(--visual-sel))]" /> 7 Expansion</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(Object.entries(TUTORS) as [TutorKey, typeof TUTORS[TutorKey]][]).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setExpandedTutor(expandedTutor === key ? null : key)}
              className={`p-3 rounded-xl border text-center transition cursor-pointer group ${
                expandedTutor === key
                  ? "border-2 shadow-md"
                  : "vi-border hover:shadow-sm hover:vi-border"
              }`}
              style={expandedTutor === key ? { borderColor: t.color } : undefined}
            >
              <div className="relative w-12 h-12 rounded-full mx-auto mb-2 overflow-hidden border-2 group-hover:scale-110 transition-transform shadow-sm" style={{ borderColor: t.color }}>
                <Image src={t.avatar} alt={t.name} fill className="object-cover object-top" sizes="48px" />
              </div>
              <p className="text-xs font-bold vi-text">{t.name}</p>
              <p className="text-[10px] vi-text-muted leading-tight">{t.domain}</p>
              <span className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                t.tier === "core" ? "bg-[hsl(var(--visual-reading)/0.08)] text-[hsl(var(--visual-reading))]" : "bg-[hsl(var(--visual-sel)/0.10)] text-[hsl(var(--visual-sel))]"
              }`}>{t.tier}</span>
            </button>
          ))}
        </div>

        {expandedTutor && TUTORS[expandedTutor] && (() => {
          const t = TUTORS[expandedTutor];
          return (
            <div className="mt-4 p-5 rounded-xl border-2 animate-in fade-in slide-in-from-top-2 duration-200" style={{ borderColor: t.color, backgroundColor: `${t.color}08` }}>
              <div className="flex items-start gap-4">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 shadow-lg flex-shrink-0" style={{ borderColor: t.color }}>
                  <Image src={t.avatar} alt={t.name} fill className="object-cover object-top" sizes="80px" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-heading font-bold text-lg" style={{ color: t.color }}>{t.name}</h3>
                    <span className="text-xl">{t.icon}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                      t.tier === "core" ? "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                    }`}>{t.tier}</span>
                  </div>
                  <p className="text-sm vi-text-muted font-semibold">{t.domain}</p>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg p-3 border vi-border">
                      <p className="text-[10px] vi-text-muted font-semibold uppercase">Tutor Key</p>
                      <p className="text-sm font-mono font-bold vi-text">{expandedTutor}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border vi-border">
                      <p className="text-[10px] vi-text-muted font-semibold uppercase">Tier</p>
                      <p className="text-sm font-bold vi-text capitalize">{t.tier}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border vi-border">
                      <p className="text-[10px] vi-text-muted font-semibold uppercase">Color</p>
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: t.color }} />
                        <p className="text-sm font-mono font-bold vi-text">{t.color}</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border vi-border">
                      <p className="text-[10px] vi-text-muted font-semibold uppercase">Levels</p>
                      <p className="text-sm font-bold vi-text">All 5</p>
                    </div>
                  </div>
                  <div className="mt-3 bg-white rounded-lg p-3 border vi-border">
                    <p className="text-[10px] vi-text-muted font-semibold uppercase mb-1">Functioning Level Adaptations</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"].map((level) => (
                        <span key={level} className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${LEVEL_COLORS[level] || "vi-surface-soft vi-text-muted"}`}>
                          {level.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
