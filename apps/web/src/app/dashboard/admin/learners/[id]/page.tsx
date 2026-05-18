"use client";
import { useAuth } from "@/providers/auth-provider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

interface LearnerDetail {
  id: string;
  name: string;
  dateOfBirth: string | null;
  gradeLevel: string | null;
  functioningLevel: string | null;
  communicationMode: string | null;
  diagnoses: string[];
  zipCode: string | null;
  country: string | null;
  region: string | null;
  districtId: string | null;
  districtName: string | null;
  curriculumFramework: string | null;
  curriculumAlignment: string | null;
  createdAt: string;
  updatedAt: string;
  parentId: string | null;
  tenantId: string | null;
  userId: string | null;
  parent: { id: string; name: string; email: string; role: string } | null;
  sensoryProfile: {
    visual: number | null;
    auditory: number | null;
    tactile: number | null;
    vestibular: number | null;
    proprioceptive: number | null;
    notes: string | null;
  } | null;
  tenant: { id: string; name: string; type: string } | null;
}

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  STANDARD: {
    label: "Standard",
    color: "text-[hsl(var(--visual-science))]",
    bg: "bg-[hsl(var(--visual-science)/0.14)]",
  },
  SUPPORTED: {
    label: "Supported",
    color: "text-[hsl(var(--visual-reading))]",
    bg: "bg-[hsl(var(--visual-reading)/0.12)]",
  },
  LOW_VERBAL: {
    label: "Low Verbal",
    color: "text-[hsl(var(--visual-sel))]",
    bg: "bg-[hsl(var(--visual-sel)/0.18)]",
  },
  NON_VERBAL: {
    label: "Non-Verbal",
    color: "text-[hsl(var(--visual-sel))]",
    bg: "bg-[hsl(var(--visual-sel)/0.18)]",
  },
  PRE_SYMBOLIC: {
    label: "Pre-Symbolic",
    color: "text-[hsl(var(--visual-math))]",
    bg: "bg-[hsl(var(--visual-math)/0.12)]",
  },
};

const SENSORY_LABELS: Record<string, string> = {
  visual: "Visual",
  auditory: "Auditory",
  tactile: "Tactile",
  vestibular: "Vestibular",
  proprioceptive: "Proprioceptive",
};

const SENSORY_COLORS: Record<string, string> = {
  visual: "bg-[hsl(var(--visual-primary))]",
  auditory: "bg-[hsl(var(--visual-reading))]",
  tactile: "bg-[hsl(var(--visual-science))]",
  vestibular: "bg-[hsl(var(--visual-sel))]",
  proprioceptive: "bg-[hsl(var(--visual-math))]",
};

function calcAge(dob: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age--;
  }
  return `${age} years old`;
}

export default function LearnerDetailPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [learner, setLearner] = useState<LearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken || !id) return;
    setLoading(true);
    fetch(`/api/admin-svc/learners/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load learner");
        return r.json();
      })
      .then((data) => setLearner(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [accessToken, id]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !learner) {
    return (
      <div className="p-8 space-y-4">
        <Link
          href="/dashboard/admin/learners"
          className="text-sm text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium"
        >
          ← Back to Learners
        </Link>
        <div className="bg-[hsl(var(--visual-math)/0.08)] border border-[hsl(var(--visual-math)/0.25)] rounded-2xl p-6 text-[hsl(var(--visual-math))]">
          {error || "Learner not found"}
        </div>
      </div>
    );
  }

  const levelConfig = LEVEL_CONFIG[learner.functioningLevel || ""] || {
    label: learner.functioningLevel || "Unknown",
    color: "vi-text-muted",
    bg: "vi-surface-soft",
  };

  return (
    <div className="p-8 space-y-6">
      <Link
        href="/dashboard/admin/learners"
        className="text-sm text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))] font-medium inline-flex items-center gap-1"
      >
        ← Back to Learners
      </Link>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] flex items-center justify-center">
          <GraduationCap size={26} strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold vi-text">{learner.name}</h1>
            <span
              className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${levelConfig.bg} ${levelConfig.color}`}
            >
              {levelConfig.label}
            </span>
          </div>
          <p className="text-sm vi-text-muted mt-0.5">
            {learner.gradeLevel ? `Grade ${learner.gradeLevel}` : "No grade"} ·{" "}
            {calcAge(learner.dateOfBirth)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Demographics</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="vi-text-muted">Grade Level</span>
              <span className="font-medium vi-text">{learner.gradeLevel || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Date of Birth</span>
              <span className="font-medium vi-text">
                {learner.dateOfBirth ? new Date(learner.dateOfBirth).toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Location</span>
              <span className="font-medium vi-text">
                {[learner.region, learner.country].filter(Boolean).join(", ") || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Zip Code</span>
              <span className="font-medium vi-text">{learner.zipCode || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">District</span>
              <span className="font-medium vi-text">{learner.districtName || "—"}</span>
            </div>
          </div>
        </div>

        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Clinical</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="vi-text-muted">Functioning Level</span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full font-semibold ${levelConfig.bg} ${levelConfig.color}`}
              >
                {levelConfig.label}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Communication</span>
              <span className="font-medium vi-text">{learner.communicationMode || "—"}</span>
            </div>
            <div>
              <span className="vi-text-muted">Diagnoses</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {learner.diagnoses && learner.diagnoses.length > 0 ? (
                  learner.diagnoses.map((d, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs rounded-full vi-surface-soft vi-text-muted font-medium"
                    >
                      {d}
                    </span>
                  ))
                ) : (
                  <span className="vi-text-muted text-xs">None recorded</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Curriculum</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="vi-text-muted">Framework</span>
              <span className="font-medium vi-text">{learner.curriculumFramework || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Alignment</span>
              <span className="font-medium vi-text">{learner.curriculumAlignment || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Created</span>
              <span className="font-medium vi-text">
                {new Date(learner.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="vi-text-muted">Updated</span>
              <span className="font-medium vi-text">
                {new Date(learner.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {learner.sensoryProfile && (
        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Sensory Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            {(["visual", "auditory", "tactile", "vestibular", "proprioceptive"] as const).map(
              (key) => {
                const val = learner.sensoryProfile?.[key];
                const pct = val != null ? Math.min(val, 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold vi-text-muted">
                        {SENSORY_LABELS[key]}
                      </span>
                      <span className="text-xs font-bold vi-text">{val != null ? val : "—"}</span>
                    </div>
                    <div className="vi-surface-soft rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${SENSORY_COLORS[key]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              },
            )}
          </div>
          {learner.sensoryProfile.notes && (
            <div className="mt-4 p-3 vi-bg rounded-lg text-sm vi-text-muted">
              <span className="font-semibold vi-text">Notes: </span>
              {learner.sensoryProfile.notes}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Parent / Guardian</h3>
          {learner.parent ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="vi-text-muted">Name</span>
                <Link
                  href={`/dashboard/admin/users/${learner.parent.id}`}
                  className="font-medium text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))]"
                >
                  {learner.parent.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="vi-text-muted">Email</span>
                <span className="font-medium vi-text">{learner.parent.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="vi-text-muted">Role</span>
                <span className="px-2 py-0.5 text-xs rounded-full vi-surface-soft vi-text-muted font-medium">
                  {learner.parent.role.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm vi-text-muted">No parent linked</p>
          )}
        </div>

        <div className="vi-card p-6">
          <h3 className="font-heading font-bold vi-text mb-4">Tenant</h3>
          {learner.tenant ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="vi-text-muted">Name</span>
                <Link
                  href={`/dashboard/admin/tenants/${learner.tenant.id}`}
                  className="font-medium text-[hsl(var(--visual-primary))] hover:text-[hsl(var(--visual-primary))]"
                >
                  {learner.tenant.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="vi-text-muted">Type</span>
                <span className="px-2 py-0.5 text-xs rounded-full vi-surface-soft vi-text-muted font-medium">
                  {learner.tenant.type}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="vi-text-muted">Tenant ID</span>
                <span className="font-mono text-xs vi-text-muted">{learner.tenant.id}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm vi-text-muted">No tenant assigned</p>
          )}
        </div>
      </div>
    </div>
  );
}
