"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import Pagination from "@/components/Pagination";
import { useTranslations } from "next-intl";
import Link from "next/link";

interface Learner {
  id: string;
  name: string;
  functioningLevel: string | null;
  gradeLevel: string | null;
  createdAt: string;
}

interface Cohort {
  level: string;
  count: number;
}

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  STANDARD: {
    label: "Standard",
    color: "text-[hsl(var(--visual-science))]",
    bg: "bg-[hsl(var(--visual-science)/0.14)]",
    desc: "General education curriculum",
  },
  SUPPORTED: {
    label: "Supported",
    color: "text-[hsl(var(--visual-reading))]",
    bg: "bg-[hsl(var(--visual-reading)/0.12)]",
    desc: "Modified with accommodations",
  },
  LOW_VERBAL: {
    label: "Low Verbal",
    color: "text-[hsl(var(--visual-sel))]",
    bg: "bg-[hsl(var(--visual-sel)/0.18)]",
    desc: "Visual/picture-based supports",
  },
  NON_VERBAL: {
    label: "Non-Verbal",
    color: "text-[hsl(var(--visual-sel))]",
    bg: "bg-[hsl(var(--visual-sel)/0.18)]",
    desc: "AAC & switch scanning",
  },
  PRE_SYMBOLIC: {
    label: "Pre-Symbolic",
    color: "text-[hsl(var(--visual-math))]",
    bg: "bg-[hsl(var(--visual-math)/0.12)]",
    desc: "Sensory-based engagement",
  },
};

export default function AdminLearnersPage() {
  const { accessToken } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const td = useTranslations("dashboard");
  const [learners, setLearners] = useState<Learner[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      fetch("/api/admin-svc/learners?limit=200", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/research/cohorts", { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ])
      .then(([learnerData, cohortData]) => {
        setLearners(Array.isArray(learnerData) ? learnerData : []);
        setCohorts(Array.isArray(cohortData) ? cohortData : []);
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  const filtered =
    levelFilter === "ALL" ? learners : learners.filter((l) => l.functioningLevel === levelFilter);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedLearners = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [levelFilter]);

  const levelCounts = Object.keys(LEVEL_CONFIG).reduce(
    (acc, level) => {
      acc[level] = learners.filter((l) => l.functioningLevel === level).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const totalLearners = learners.length;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold vi-text">{td("learners")}</h1>
        <p className="text-sm vi-text-muted mt-1">
          View and manage all learner profiles across the platform.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(LEVEL_CONFIG).map(([level, config]) => {
          const count = levelCounts[level] || 0;
          const pct = totalLearners > 0 ? Math.round((count / totalLearners) * 100) : 0;
          return (
            <button
              key={level}
              onClick={() => setLevelFilter(levelFilter === level ? "ALL" : level)}
              className={`p-4 rounded-2xl border transition text-left ${
                levelFilter === level
                  ? "border-purple-300 vi-surface-soft shadow-sm"
                  : "vi-border bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${config.bg} ${config.color}`}
                >
                  {config.label}
                </span>
                <span className="text-lg font-bold vi-text">{count}</span>
              </div>
              <div className="vi-surface-soft rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${config.bg.replace("100", "400")}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] vi-text-muted mt-2">{config.desc}</p>
            </button>
          );
        })}
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg vi-text">
            {levelFilter === "ALL"
              ? "All Learners"
              : `${LEVEL_CONFIG[levelFilter]?.label} Learners`}
          </h2>
          <p className="text-sm vi-text-muted">{filtered.length} learners</p>
        </div>

        {loading ? (
          <div className="p-10 text-center vi-text-muted animate-pulse">Loading learners...</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left vi-text-muted border-b vi-border vi-bg/50">
                  <th className="px-5 py-3 font-semibold">{tc("name")}</th>
                  <th className="px-5 py-3 font-semibold">Functioning Level</th>
                  <th className="px-5 py-3 font-semibold">{tc("type")}</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLearners.map((l) => {
                  const lc = LEVEL_CONFIG[l.functioningLevel || ""] || {
                    label: "N/A",
                    color: "vi-text-muted",
                    bg: "vi-surface-soft",
                  };
                  return (
                    <tr key={l.id} className="border-b vi-border hover:vi-bg/50 transition">
                      <td className="px-5 py-3 font-medium">
                        <Link
                          href={`/dashboard/admin/learners/${l.id}`}
                          className="text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))]"
                        >
                          {l.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${lc.bg} ${lc.color}`}
                        >
                          {lc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 vi-text-muted">{l.gradeLevel || "—"}</td>
                      <td className="px-5 py-3 vi-text-muted">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
                {paginatedLearners.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center vi-text-muted">
                      No learners found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
            />
          </>
        )}
      </div>
    </div>
  );
}
