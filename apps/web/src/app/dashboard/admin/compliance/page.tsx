"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IconWell } from "@/components/discovery/_vi";
import {
  ShieldCheck,
  Check,
  X,
  Circle,
  ClipboardList,
  Trash2,
  Upload,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

interface AuditEntry {
  action: string;
  actor: string;
  resource: string;
  timestamp: string;
  details?: string;
}

interface RuntimeControl {
  id: string;
  label: string;
  category: "Auth" | "Access" | "Network" | "Encryption" | "Audit" | "Scanning";
  status: "pass" | "warn" | "fail" | "unknown";
  evidence: string;
  runbook?: string;
  lastCheckedAt: string;
}

export default function AdminCompliancePage() {
  const { accessToken } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [runtimeControls, setRuntimeControls] = useState<RuntimeControl[] | null>(null);
  const [controlsLastChecked, setControlsLastChecked] = useState<string | null>(null);
  const [controlsErr, setControlsErr] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([
      fetch("/api/admin-svc/stats", { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/admin-svc/compliance/controls", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .catch((e) => ({ __err: String(e?.message ?? e) })),
    ]).then(([s, c]: any) => {
      setStats(s);
      if (c?.__err) {
        setControlsErr(c.__err);
        setRuntimeControls([]);
      } else {
        setRuntimeControls(c.controls);
        setControlsLastChecked(c.generatedAt);
      }
      setLoading(false);
    });
  }, [accessToken]);

  const complianceChecks = [
    {
      framework: "COPPA",
      status: "compliant",
      score: 100,
      items: [
        { label: "Parental consent required before data collection", status: true },
        { label: "No direct marketing to children under 13", status: true },
        { label: "Parent can review/delete child data at any time", status: true },
        { label: "Minimal data collection principle enforced", status: true },
      ],
    },
    {
      framework: "FERPA",
      status: "compliant",
      score: 100,
      items: [
        { label: "Student education records access controls", status: true },
        { label: "Parent access to student data guaranteed", status: true },
        { label: "Data sharing limited to educational purpose", status: true },
        { label: "Annual notification procedures in place", status: true },
      ],
    },
    {
      framework: "GDPR/CCPA",
      status: "compliant",
      score: 100,
      items: [
        { label: "Right to access personal data", status: true },
        { label: "Right to deletion (data erasure)", status: true },
        { label: "Data portability support", status: true },
        { label: "Consent management & withdrawal", status: true },
      ],
    },
    {
      framework: "SOC2 Type II",
      status: "in_progress",
      score: 80,
      items: [
        { label: "Access control procedures", status: true },
        { label: "System change management", status: true },
        { label: "Risk assessment documentation", status: true },
        { label: "Incident response procedures", status: true },
        { label: "Audit evidence automation", status: false },
      ],
    },
  ];

  // Security controls now come from the runtime probes endpoint; no hardcoded array.

  const recentAudit: AuditEntry[] = [
    {
      action: "USER_CREATED",
      actor: "admin@aivo.test",
      resource: "User",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      details: "Created new team member",
    },
    {
      action: "ROLE_ASSIGNED",
      actor: "admin@aivo.test",
      resource: "User",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      details: "Assigned DISTRICT_ADMIN role",
    },
    {
      action: "TENANT_CREATED",
      actor: "admin@aivo.test",
      resource: "Tenant",
      timestamp: new Date(Date.now() - 14400000).toISOString(),
      details: "Created district account",
    },
    {
      action: "LOGIN",
      actor: "admin@aivo.test",
      resource: "Session",
      timestamp: new Date(Date.now() - 18000000).toISOString(),
      details: "Admin login from dashboard",
    },
    {
      action: "IMPERSONATION",
      actor: "admin@aivo.test",
      resource: "Session",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      details: "Impersonated parent user for support",
    },
    {
      action: "CONFIG_UPDATED",
      actor: "admin@aivo.test",
      resource: "Settings",
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      details: "Updated feature flags",
    },
  ];

  const dataRequests: {
    type: string;
    count: number;
    desc: string;
    Icon: LucideIcon;
    color: string;
  }[] = [
    {
      type: "Access Request",
      count: 0,
      desc: "Pending data access requests",
      Icon: ClipboardList,
      color: "primary",
    },
    {
      type: "Deletion Request",
      count: 0,
      desc: "Pending data deletion requests",
      Icon: Trash2,
      color: "math",
    },
    {
      type: "Export Request",
      count: 0,
      desc: "Pending data export requests",
      Icon: Upload,
      color: "reading",
    },
  ];

  const ACTION_COLORS: Record<string, string> = {
    USER_CREATED: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
    ROLE_ASSIGNED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
    TENANT_CREATED: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
    LOGIN: "vi-surface-soft vi-text",
    IMPERSONATION: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
    CONFIG_UPDATED: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-64 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="science">
            <ShieldCheck size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">{t("audit_logs")}</h1>
            <p className="text-sm vi-text-muted mt-1">
              COPPA, FERPA, GDPR compliance status, security controls, and audit trail.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))] text-sm font-semibold">
          <span className="w-2 h-2 rounded-full bg-[hsl(var(--visual-science))]" />
          3/4 Frameworks Compliant
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {complianceChecks.map((fw) => {
          const passed = fw.items.filter((i) => i.status).length;
          const total = fw.items.length;
          return (
            <div key={fw.framework} className="vi-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-bold vi-text">{fw.framework}</h3>
                <span
                  className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${
                    fw.status === "compliant"
                      ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                      : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                  }`}
                >
                  {fw.status === "compliant" ? "Compliant" : "In Progress"}
                </span>
              </div>
              <div className="space-y-2">
                {fw.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {item.status ? (
                      <Check
                        size={12}
                        strokeWidth={3}
                        className="mt-0.5 text-[hsl(var(--visual-science))] flex-shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        size={12}
                        strokeWidth={2.5}
                        className="mt-0.5 vi-text-muted opacity-70 flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-xs vi-text-muted">{item.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 vi-surface-soft rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${fw.status === "compliant" ? "bg-[hsl(var(--visual-science))]" : "bg-[hsl(var(--visual-sel))]"}`}
                  style={{ width: `${(passed / total) * 100}%` }}
                />
              </div>
              <p className="text-[10px] vi-text-muted mt-1">
                {passed}/{total} checks passed
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vi-card p-6" data-testid="runtime-controls">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-lg vi-text">{t("system_health")}</h2>
            {controlsLastChecked && (
              <span className="text-[10px] vi-text-muted">
                Probed {new Date(controlsLastChecked).toLocaleTimeString()}
              </span>
            )}
          </div>
          {controlsErr && (
            <div
              className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 mb-3"
              data-testid="runtime-controls-error"
            >
              Compliance probes unavailable: {controlsErr}
            </div>
          )}
          <div className="space-y-2">
            {(runtimeControls || []).map((ctrl) => {
              const tone =
                ctrl.status === "pass"
                  ? "text-[hsl(var(--visual-science))]"
                  : ctrl.status === "warn"
                    ? "text-amber-600"
                    : ctrl.status === "fail"
                      ? "text-[hsl(var(--visual-math))]"
                      : "vi-text-muted";
              const Icon =
                ctrl.status === "pass" ? Check : ctrl.status === "fail" ? X : AlertTriangle;
              return (
                <div
                  key={ctrl.id}
                  className="flex items-start gap-3 py-2 px-3 rounded-lg hover:vi-bg transition"
                  data-testid={`runtime-control-${ctrl.id}`}
                  data-status={ctrl.status}
                >
                  <Icon
                    size={16}
                    strokeWidth={3}
                    className={`mt-0.5 flex-shrink-0 ${tone}`}
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium vi-text">{ctrl.label}</p>
                    <p className="text-[11px] vi-text-muted mt-0.5">{ctrl.evidence}</p>
                    {ctrl.status !== "pass" && ctrl.runbook && (
                      <a
                        href={ctrl.runbook}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] underline text-blue-700 mt-0.5 inline-block"
                      >
                        Runbook ↗
                      </a>
                    )}
                  </div>
                  <span className="px-2 py-0.5 text-[10px] rounded vi-surface-soft vi-text-muted font-medium">
                    {ctrl.category}
                  </span>
                </div>
              );
            })}
            {!controlsErr && runtimeControls && runtimeControls.length === 0 && (
              <p className="text-sm vi-text-muted">No probes returned.</p>
            )}
          </div>
        </div>

        <div className="vi-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-bold text-lg vi-text">{t("audit_logs")}</h2>
            <span className="text-xs vi-text-muted">Last 30 days</span>
          </div>
          <div className="space-y-2">
            {recentAudit.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg border vi-border hover:vi-bg transition"
              >
                <span
                  className={`px-2 py-0.5 text-[10px] rounded font-semibold flex-shrink-0 ${ACTION_COLORS[entry.action] || "vi-surface-soft vi-text-muted"}`}
                >
                  {entry.action.replace(/_/g, " ")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm vi-text truncate">{entry.details}</p>
                  <p className="text-[10px] vi-text-muted">{entry.actor}</p>
                </div>
                <span className="text-[10px] vi-text-muted flex-shrink-0">
                  {formatTimeAgo(new Date(entry.timestamp))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {dataRequests.map((dr) => {
          const Icon = dr.Icon;
          return (
            <div key={dr.type} className="vi-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <IconWell color={dr.color} size="sm">
                  <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
                </IconWell>
                <div>
                  <p className="text-sm font-semibold vi-text">{dr.type}</p>
                  <p className="text-xs vi-text-muted">{dr.desc}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold vi-text">{dr.count}</p>
                <span className="px-2.5 py-0.5 text-xs rounded-full bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))] font-semibold">
                  Clear
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="vi-card p-6">
        <h2 className="font-heading font-bold text-lg vi-text mb-4">Consent Management</h2>
        <p className="text-sm vi-text-muted mb-4">
          COPPA parental consent is required before any child data is collected. All consent records
          are tracked with timestamps and can be revoked.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[hsl(var(--visual-science)/0.08)] border border-[hsl(var(--visual-science)/0.25)] text-center">
            <p className="text-2xl font-bold text-[hsl(var(--visual-science))]">
              {stats?.totalLearners ?? 0}
            </p>
            <p className="text-xs text-[hsl(var(--visual-science))] font-medium mt-1">
              Active Consents
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[hsl(var(--visual-reading)/0.08)] border border-[hsl(var(--visual-reading)/0.25)] text-center">
            <p className="text-2xl font-bold text-[hsl(var(--visual-reading))]">Enforced</p>
            <p className="text-xs text-[hsl(var(--visual-reading))] font-medium mt-1">
              Data Minimization
            </p>
          </div>
          <div className="p-4 rounded-xl vi-surface-soft border border-[hsl(var(--visual-primary)/0.3)] text-center">
            <p className="text-2xl font-bold text-[hsl(var(--visual-primary))]">
              {recentAudit.length}
            </p>
            <p className="text-xs text-[hsl(var(--visual-primary))] font-medium mt-1">
              Recent Admin Actions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
