"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface Learner {
  id: string;
  name: string;
  gradeLevel?: string;
  functioningLevel?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  STANDARD: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  SUPPORTED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  LOW_VERBAL: "bg-[hsl(var(--visual-sel)/0.16)] text-[hsl(var(--visual-sel))]",
  NON_VERBAL: "bg-[hsl(var(--visual-sel)/0.2)] text-[hsl(var(--visual-sel))]",
  PRE_SYMBOLIC: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
};

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken, loading } = useAuth();
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const learnerId = params.id as string;
  const t = useTranslations("parent");

  const [learner, setLearner] = useState<Learner | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/users/learners", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const found = (Array.isArray(data) ? data : []).find((l: Learner) => l.id === learnerId);
        if (found) setLearner(found);
      })
      .catch(() => {});
  }, [accessToken, learnerId]);

  if (loading || !user) return null;

  const TABS = [
    {
      key: "hub",
      label: t("overview"),
      href: `/dashboard/parent/learner/${learnerId}`,
      exact: true,
    },
    { key: "progress", label: "Progress", href: `/dashboard/parent/learner/${learnerId}/progress` },
    {
      key: "brain",
      label: t("brain_profile"),
      href: `/dashboard/parent/learner/${learnerId}/brain`,
    },
    { key: "team", label: "Team", href: `/dashboard/parent/learner/${learnerId}/team` },
    { key: "iep", label: t("iep_goals"), href: `/dashboard/parent/learner/${learnerId}/iep` },
    { key: "sensory", label: "Sensory", href: `/dashboard/parent/learner/${learnerId}/sensory` },
    {
      key: "milestones",
      label: "Milestones",
      href: `/dashboard/parent/learner/${learnerId}/milestones`,
    },
    {
      key: "settings",
      label: t("settings"),
      href: `/dashboard/parent/learner/${learnerId}/settings`,
    },
  ];

  const isTabActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const gradebookActive = pathname.includes("/gradebook");
  const collaborationActive = pathname.includes("/collaboration");

  const focusedFlow = pathname.includes("/assessment");
  if (focusedFlow) return <>{children}</>;

  return (
    <div>
      <div className="sticky top-14 z-20 bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={() => router.push("/dashboard/parent")}
              className="vi-text-muted hover:text-[hsl(var(--visual-primary))] transition text-sm font-semibold"
              style={{
                minWidth: 44,
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ← Back
            </button>

            {learner && (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[hsl(var(--visual-primary))] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {learner.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-heading font-bold vi-text truncate">
                    {learner.name}
                  </h2>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {learner.gradeLevel && (
                      <span className="text-[11px] vi-text-muted font-medium">
                        Grade {learner.gradeLevel}
                      </span>
                    )}
                    {learner.functioningLevel && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[learner.functioningLevel] || "vi-surface-soft vi-text-muted"}`}
                      >
                        {learner.functioningLevel.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-0.5 overflow-x-auto pb-0 -mb-px scrollbar-hide">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                  isTabActive(tab.href, tab.exact)
                    ? "border-[hsl(var(--visual-primary))] text-[hsl(var(--visual-primary))]"
                    : "border-transparent vi-text-muted hover:vi-text hover:border-[hsl(var(--visual-primary)/0.3)]"
                }`}
                style={{ minHeight: 44 }}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">{children}</div>
    </div>
  );
}
