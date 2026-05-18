"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Calculator,
  BookOpen,
  FlaskConical,
  Landmark,
  Code2,
  ClipboardList,
  BookMarked,
} from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";

interface Assignment {
  id: string;
  subject: string;
  status: string;
  detectedSubject: string;
  problemCount: number;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; tint: string }> = {
  READY: {
    label: "Ready",
    tint: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  },
  IN_PROGRESS: {
    label: "In Progress",
    tint: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  },
  COMPLETED: {
    label: "Completed",
    tint: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  },
  FAILED: {
    label: "Failed",
    tint: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  },
};

const SUBJECT_META: Record<
  string,
  { color: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  math: { color: "math", Icon: Calculator },
  ela: { color: "reading", Icon: BookOpen },
  science: { color: "science", Icon: FlaskConical },
  history: { color: "sel", Icon: Landmark },
  coding: { color: "primary", Icon: Code2 },
  other: { color: "primary", Icon: BookMarked },
};

export default function LearnerHomeworkPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`/api/tutors/homework/learner/${learnerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { assignments: [] }))
      .then((data) => setAssignments(data.assignments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, learnerId]);

  if (authLoading || !user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text">{t("homework_history")}</h1>
        <p className="vi-text-muted text-sm mt-1">{t("homework_desc")}</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-[hsl(var(--visual-primary)/0.2)] border-t-[hsl(var(--visual-primary))] rounded-full animate-spin mx-auto" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="vi-card p-10 text-center">
          <div className="mx-auto inline-flex mb-4">
            <IconWell color="primary" size="md">
              <ClipboardList className="w-7 h-7" strokeWidth={2.5} />
            </IconWell>
          </div>
          <p className="font-semibold vi-text-muted">{t("no_homework")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((hw) => {
            const subjectLower = hw.subject?.toLowerCase() || "other";
            const meta = SUBJECT_META[subjectLower] || SUBJECT_META.other;
            const status = STATUS_LABELS[hw.status] || STATUS_LABELS.READY;
            const Icon = meta.Icon;
            return (
              <div key={hw.id} className="vi-card p-4 flex items-center gap-4">
                <IconWell color={meta.color} size="sm">
                  <Icon className="w-5 h-5" />
                </IconWell>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 capitalize">
                    {subjectLower} {t("homework_label")}
                  </p>
                  <p className="text-sm vi-text-muted">
                    {t("problems_count", { count: hw.problemCount })} ·{" "}
                    {new Date(hw.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.tint}`}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
