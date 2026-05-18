"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import BrainVisualization from "@/components/BrainVisualization";
import { useTranslations } from "next-intl";
import { ClipboardList, BarChart3, Target, Lightbulb } from "lucide-react";

interface LearnerDetail {
  id: string;
  name: string;
  gradeLevel: string;
  functioningLevel: string;
  zipCode?: string;
  country?: string;
  createdAt: string;
}

export default function ParentLearnerOverviewPage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");
  const tc = useTranslations("common");
  const [learner, setLearner] = useState<LearnerDetail | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!accessToken || !learnerId) return;
    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const found = (Array.isArray(data) ? data : []).find((l: any) => l.id === learnerId);
        if (found) setLearner(found);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [accessToken, learnerId]);

  if (loading || !user) return null;

  if (loadingData) {
    return <div className="text-center py-12 vi-text-muted animate-pulse">{tc("loading")}</div>;
  }

  if (!learner) {
    return (
      <div className="text-center py-12">
        <p className="text-[hsl(var(--visual-math))] font-semibold">{t("learner_not_found")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="vi-card p-5">
          <p className="text-xs vi-text-muted font-semibold uppercase mb-1">
            {t("functioning_level")}
          </p>
          <p className="text-xl font-bold text-[hsl(var(--visual-primary))]">
            {learner.functioningLevel || t("pending_assessment")}
          </p>
        </div>
        <div className="vi-card p-5">
          <p className="text-xs vi-text-muted font-semibold uppercase mb-1">{t("grade")}</p>
          <p className="text-xl font-bold vi-text">{learner.gradeLevel || "—"}</p>
        </div>
        <div className="vi-card p-5">
          <p className="text-xs vi-text-muted font-semibold uppercase mb-1">{t("member_since")}</p>
          <p className="text-xl font-bold vi-text">
            {new Date(learner.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">{t("brain_preview")}</h2>
        {accessToken && (
          <BrainVisualization
            learnerId={learnerId}
            learnerName={learner.name}
            accessToken={accessToken}
            compact
          />
        )}
        <Link
          href={`/dashboard/parent/learner/${learnerId}/brain`}
          className="mt-4 text-sm text-[hsl(var(--visual-primary))] font-semibold hover:underline inline-block"
        >
          {t("view_full_brain")}
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`/dashboard/parent/learner/${learnerId}/assessment`}
          className="vi-card p-5 hover:shadow-md hover:border-[hsl(var(--visual-primary)/0.4)] transition text-center"
        >
          <span className="w-11 h-11 mx-auto rounded-2xl bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))] flex items-center justify-center">
            <ClipboardList size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold vi-text mt-2">{t("assessments")}</p>
        </Link>
        <Link
          href={`/dashboard/parent/learner/${learnerId}/gradebook`}
          className="vi-card p-5 hover:shadow-md hover:border-[hsl(var(--visual-primary)/0.4)] transition text-center"
        >
          <span className="w-11 h-11 mx-auto rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center">
            <BarChart3 size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold vi-text mt-2">Progress</p>
        </Link>
        <Link
          href={`/dashboard/parent/learner/${learnerId}/iep`}
          className="vi-card p-5 hover:shadow-md hover:border-[hsl(var(--visual-primary)/0.4)] transition text-center"
        >
          <span className="w-11 h-11 mx-auto rounded-2xl bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))] flex items-center justify-center">
            <Target size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold vi-text mt-2">{t("iep_goals")}</p>
        </Link>
        <Link
          href={`/dashboard/parent/learner/${learnerId}/recommendations`}
          className="vi-card p-5 hover:shadow-md hover:border-[hsl(var(--visual-primary)/0.4)] transition text-center"
        >
          <span className="w-11 h-11 mx-auto rounded-2xl bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))] flex items-center justify-center">
            <Lightbulb size={22} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold vi-text mt-2">{t("recommendations")}</p>
        </Link>
      </div>
    </div>
  );
}
