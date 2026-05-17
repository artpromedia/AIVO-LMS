"use client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Calculator, BookOpen, FlaskConical, Landmark, Code2, ClipboardList, BookMarked, type LucideIcon } from "lucide-react";

interface ChildHomework {
  learnerId: string;
  learnerName: string;
  assignments: {
    id: string;
    subject: string;
    status: string;
    detectedSubject: string;
    problemCount: number;
    createdAt: string;
  }[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  READY: { label: "Ready", color: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]" },
  IN_PROGRESS: { label: "In Progress", color: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]" },
  COMPLETED: { label: "Completed", color: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]" },
  FAILED: { label: "Failed", color: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" },
};

const SUBJECT_META: Record<string, { Icon: LucideIcon; color: string }> = {
  math: { Icon: Calculator, color: "math" },
  ela: { Icon: BookOpen, color: "reading" },
  science: { Icon: FlaskConical, color: "science" },
  history: { Icon: Landmark, color: "sel" },
  coding: { Icon: Code2, color: "primary" },
  other: { Icon: ClipboardList, color: "primary" },
};

const SUBJECT_WELL: Record<string, string> = {
  primary: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  math: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  reading: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  science: "bg-[hsl(var(--visual-science)/0.12)] text-[hsl(var(--visual-science))]",
  sel: "bg-[hsl(var(--visual-sel)/0.12)] text-[hsl(var(--visual-sel))]",
};

export default function ParentHomeworkPage() {
  const { user, accessToken, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const learnerId = params.learnerId as string;
  const t = useTranslations("parent");

  const [data, setData] = useState<ChildHomework | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    fetchHomework();
  }, [user]);

  async function fetchHomework() {
    try {
      const res = await fetch(`/api/tutors/homework/learner/${learnerId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (res.ok) {
        const result = await res.json();
        setData({
          learnerId,
          learnerName: "",
          assignments: result.assignments || [],
        });
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) return null;

  return (
    <div className="vi-bg">
      <header className="bg-[hsl(var(--visual-surface)/0.95)] backdrop-blur border-b vi-border px-8 py-4 flex items-center justify-between">
        <Image src="/images/aivo-logo-purple.png" alt="AIVO" width={100} height={30} style={{ height: "auto" }} />
        <button onClick={() => router.push("/dashboard/parent")} className="text-sm vi-text-muted hover:text-[hsl(var(--visual-primary))] font-semibold">
          {t("back_to_dashboard")}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold vi-text">{t("homework_history")}</h1>
          <p className="vi-text-muted">{t("homework_desc")}</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-4 border-[hsl(var(--visual-primary)/0.2)] border-t-[hsl(var(--visual-primary))] rounded-full animate-spin mx-auto" />
          </div>
        ) : !data || data.assignments.length === 0 ? (
          <div className="text-center py-12 vi-text-muted">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center mx-auto mb-4">
              <BookMarked size={28} aria-hidden="true" />
            </div>
            <p className="font-semibold">{t("no_homework")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.assignments.map((hw) => {
              const subjectLower = hw.subject?.toLowerCase() || "other";
              const status = STATUS_LABELS[hw.status] || STATUS_LABELS.READY;
              const meta = SUBJECT_META[subjectLower] || SUBJECT_META.other;
              const Icon = meta.Icon;
              return (
                <div
                  key={hw.id}
                  className="vi-card p-5 flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${SUBJECT_WELL[meta.color] || SUBJECT_WELL.primary}`}>
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 capitalize">{subjectLower} {t("homework_label")}</p>
                    <p className="text-sm vi-text-muted">
                      {t("problems_count", { count: hw.problemCount })} &middot;{" "}
                      {new Date(hw.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
