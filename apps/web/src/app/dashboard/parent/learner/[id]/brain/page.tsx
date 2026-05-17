"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import BrainVisualizationPanel from "@/components/BrainVisualizationPanel";
import LearnerBrainMapCard from "@/components/brain/LearnerBrainMapCard";
import { useTranslations } from "next-intl";
import { Brain, Palette, Lightbulb, Target } from "lucide-react";
import { IconWell } from "@/components/discovery/_vi";

export default function ParentBrainProfilePage() {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [learnerName, setLearnerName] = useState("Learner");
  const [learnerGrade, setLearnerGrade] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !learnerId) return;
    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const found = (Array.isArray(data) ? data : []).find((l: any) => l.id === learnerId);
        if (found) {
          setLearnerName(found.name);
          setLearnerGrade(found.gradeLevel ?? null);
        }
      })
      .catch(() => {});
  }, [accessToken, learnerId]);

  if (loading || !user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text mb-2">{t("brain_profile_title", { name: learnerName })}</h1>
        <p className="text-sm vi-text-muted">{t("brain_profile_desc")}</p>
      </div>

      {/* Interactive brain map — Phase 1: anchored regions, hover, drill-in */}
      {accessToken && (
        <div className="vi-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <IconWell color="primary" size="sm"><Brain className="w-5 h-5" /></IconWell>
            <h2 className="font-heading font-bold text-lg vi-text">Interactive Brain Map</h2>
          </div>
          <LearnerBrainMapCard
            learnerId={learnerId}
            learnerName={learnerName}
            enrolledGrade={learnerGrade}
            accessToken={accessToken}
          />
        </div>
      )}

      <div className="vi-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <IconWell color="primary" size="sm"><Brain className="w-5 h-5" /></IconWell>
          <h2 className="font-heading font-bold text-lg vi-text">{t("brain_visualization")}</h2>
        </div>
        {accessToken ? (
          <BrainVisualizationPanel
            learnerName={learnerName}
            version="v1"
            updatedAt={new Date().toLocaleDateString()}
          />
        ) : (
          <p className="text-sm vi-text-muted">{t("loading_brain")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-3">{t("what_is_brain")}</h3>
          <ul className="space-y-2 text-sm vi-text-muted">
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--visual-primary))] mt-0.5">●</span>
              <span>{t("brain_feature_adapt")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--visual-primary))] mt-0.5">●</span>
              <span>{t("brain_feature_track")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--visual-primary))] mt-0.5">●</span>
              <span>{t("brain_feature_identify")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[hsl(var(--visual-primary))] mt-0.5">●</span>
              <span>{t("brain_feature_iep")}</span>
            </li>
          </ul>
        </div>
        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-3">{t("related_pages")}</h3>
          <div className="space-y-2">
            <Link href={`/dashboard/parent/learner/${learnerId}/sensory`}
              className="flex items-center gap-3 p-3 rounded-xl border vi-border hover:bg-[hsl(var(--visual-primary)/0.06)] transition">
              <IconWell color="reading" size="sm"><Palette className="w-5 h-5" /></IconWell>
              <div>
                <p className="text-sm font-semibold vi-text">{t("sensory_profile")}</p>
                <p className="text-xs vi-text-muted">{t("sensory_profile_desc")}</p>
              </div>
            </Link>
            <Link href={`/dashboard/parent/learner/${learnerId}/recommendations`}
              className="flex items-center gap-3 p-3 rounded-xl border vi-border hover:bg-[hsl(var(--visual-primary)/0.06)] transition">
              <IconWell color="sel" size="sm"><Lightbulb className="w-5 h-5" /></IconWell>
              <div>
                <p className="text-sm font-semibold vi-text">{t("recommendations")}</p>
                <p className="text-xs vi-text-muted">{t("recommendations_desc")}</p>
              </div>
            </Link>
            <Link href={`/dashboard/parent/learner/${learnerId}/iep`}
              className="flex items-center gap-3 p-3 rounded-xl border vi-border hover:bg-[hsl(var(--visual-primary)/0.06)] transition">
              <IconWell color="science" size="sm"><Target className="w-5 h-5" /></IconWell>
              <div>
                <p className="text-sm font-semibold vi-text">{t("iep_goals")}</p>
                <p className="text-xs vi-text-muted">{t("iep_goals_desc")}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
