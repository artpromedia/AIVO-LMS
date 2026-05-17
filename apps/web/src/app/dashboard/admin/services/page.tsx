"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface ServiceStatus {
  name: string;
  status: string;
  latency: number;
}

interface Incident {
  id: string;
  title: string;
  status: string;
  severity: string;
  affectedServices: string[];
  createdAt: string;
  resolvedAt?: string;
}

interface OpsAlertsOutboxTile {
  service: string;
  state: "healthy" | "warning" | "unreachable";
  storeKind: string | null;
  depth: number;
  enqueuedTotal: number;
  drainedTotal: number;
  droppedTotal: number;
  firstNonZeroAt: string | null;
  lastShutdown: { drained: number; lost: number; flushTimedOut: boolean; finishedAt: string } | null;
  shutdownStale: boolean;
  lastAutoFlushAt: string | null;
  autoFlushTicksTotal: number;
  autoFlushDrainedTotal: number;
  autoFlushErrorsTotal: number;
  fetchedAt: string;
  error?: string;
}

const ALL_SERVICES = [
  { name: "identity-svc", port: 3001, desc: "Authentication, users, RBAC" },
  { name: "brain-svc", port: 3002, desc: "Brain clone engine (Python)" },
  { name: "assessment-svc", port: 3003, desc: "Baseline & dynamic assessments" },
  { name: "ai-svc", port: 3004, desc: "LLM gateway, content generation" },
  { name: "learning-svc", port: 3005, desc: "Lesson sessions, gradebook" },
  { name: "tutor-svc", port: 3006, desc: "14 AI tutor management" },
  { name: "family-svc", port: 3007, desc: "Collaboration, recommendations" },
  { name: "engagement-svc", port: 3008, desc: "Gamification, rewards" },
  { name: "billing-svc", port: 3009, desc: "Subscriptions, payments" },
  { name: "comms-svc", port: 3010, desc: "Notifications, email, push" },
  { name: "i18n-svc", port: 3011, desc: "Internationalization" },
  { name: "integrations-svc", port: 3012, desc: "Third-party integrations" },
  { name: "admin-svc", port: 3013, desc: "Platform administration" },
  { name: "status-page-svc", port: 3014, desc: "System health monitoring" },
  { name: "research-svc", port: 3015, desc: "Analytics & research data" },
];

export default function AdminServicesPage() {
  const { accessToken, user } = useAuth();
  const t = useTranslations("platformAdmin");
  const tc = useTranslations("common");
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [uptime, setUptime] = useState<any>(null);
  const [outboxTiles, setOutboxTiles] = useState<OpsAlertsOutboxTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState("checking");
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("minor");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/status/overview").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/status/incidents").then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/status/uptime").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/status/ops-alerts-outbox").then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([overview, incidentData, uptimeData, outboxData]) => {
      if (overview?.services) {
        setServiceStatuses(overview.services.map((s: any) => ({
          name: s.name,
          status: s.status === "healthy" ? "operational" : s.status,
          latency: s.latencyMs || 0,
        })));
        setOverallStatus(overview.overall === "major_outage" ? "outage" : overview.overall || "checking");
      }
      const incArr = incidentData?.incidents || (Array.isArray(incidentData) ? incidentData : []);
      setIncidents(incArr);
      setUptime(uptimeData);
      if (outboxData?.tiles) setOutboxTiles(outboxData.tiles);
    }).finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch("/api/status/overview").then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.services) {
            setServiceStatuses(data.services.map((s: any) => ({
              name: s.name,
              status: s.status === "healthy" ? "operational" : s.status,
              latency: s.latencyMs || 0,
            })));
            setOverallStatus(data.overall === "major_outage" ? "outage" : data.overall || "checking");
          }
        }).catch(() => {});
      fetch("/api/status/ops-alerts-outbox").then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.tiles) setOutboxTiles(data.tiles);
        }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    try {
      await fetch("/api/status/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title: incidentTitle, severity: incidentSeverity, affectedServices: [] }),
      });
      setIncidentTitle("");
      setShowIncidentForm(false);
      const res = await fetch("/api/status/incidents");
      if (res.ok) setIncidents(await res.json());
    } catch {}
  };

  const healthyCount = serviceStatuses.filter((s) => s.status === "operational").length;
  const degradedCount = serviceStatuses.filter((s) => s.status === "degraded").length;
  const downCount = serviceStatuses.filter((s) => s.status !== "operational" && s.status !== "degraded").length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("system_health")}</h1>
          <p className="text-sm vi-text-muted mt-1">Real-time health monitoring across all {ALL_SERVICES.length} microservices.</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
          overallStatus === "operational" ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" :
          overallStatus === "degraded" ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            overallStatus === "operational" ? "bg-[hsl(var(--visual-science))]" : overallStatus === "degraded" ? "bg-[hsl(var(--visual-sel))] animate-pulse" : "bg-[hsl(var(--visual-math))] animate-pulse"
          }`} />
          {overallStatus === "operational" ? "All Systems Operational" : overallStatus === "degraded" ? "Degraded" : "Issues Detected"}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">{ALL_SERVICES.length}</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Total Services</p>
        </div>
        <div className="bg-[hsl(var(--visual-science)/0.08)] rounded-xl p-4 border border-[hsl(var(--visual-science)/0.25)] text-center">
          <p className="text-3xl font-bold text-[hsl(var(--visual-science))]">{healthyCount}</p>
          <p className="text-xs text-[hsl(var(--visual-science))] font-semibold mt-1">Operational</p>
        </div>
        <div className="bg-[hsl(var(--visual-sel)/0.10)] rounded-xl p-4 border border-[hsl(var(--visual-sel)/0.30)] text-center">
          <p className="text-3xl font-bold text-[hsl(var(--visual-sel))]">{degradedCount}</p>
          <p className="text-xs text-[hsl(var(--visual-sel))] font-semibold mt-1">Degraded</p>
        </div>
        <div className="bg-[hsl(var(--visual-math)/0.08)] rounded-xl p-4 border border-[hsl(var(--visual-math)/0.25)] text-center">
          <p className="text-3xl font-bold text-[hsl(var(--visual-math))]">{downCount}</p>
          <p className="text-xs text-[hsl(var(--visual-math))] font-semibold mt-1">Down</p>
        </div>
      </div>

      {uptime && (
        <div className="vi-card p-6">
          <h2 className="font-heading font-bold text-lg mb-3">30-Day Uptime Report</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-3xl font-bold">{uptime.uptime?.overall ?? "99.9"}%</p>
              <p className="text-sm vi-text-muted">Overall Uptime</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{uptime.period ?? "30d"}</p>
              <p className="text-sm vi-text-muted">Period</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{uptime.uptime?.byService?.length ?? 0}</p>
              <p className="text-sm vi-text-muted">Monitored Services</p>
            </div>
          </div>
        </div>
      )}

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border">
          <h2 className="font-heading font-bold text-lg vi-text">Service Status</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center vi-text-muted animate-pulse">Checking services...</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {ALL_SERVICES.map((svc) => {
              const live = serviceStatuses.find((s) => s.name === svc.name);
              const status = live?.status || "unknown";
              return (
                <div key={svc.name} className="flex items-center justify-between px-5 py-4 hover:vi-bg/50 transition">
                  <div className="flex items-center gap-4">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      status === "operational" ? "bg-[hsl(var(--visual-science))]" : status === "degraded" ? "bg-[hsl(var(--visual-sel))] animate-pulse" : "bg-[hsl(var(--visual-math))]"
                    }`} />
                    <div>
                      <p className="text-sm font-semibold vi-text">{svc.name}</p>
                      <p className="text-xs vi-text-muted">{svc.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs vi-text-muted">:{svc.port}</span>
                    {live?.latency !== undefined && live.latency > 0 && (
                      <span className={`text-xs font-medium ${live.latency < 200 ? "text-[hsl(var(--visual-science))]" : live.latency < 500 ? "text-[hsl(var(--visual-sel))]" : "text-[hsl(var(--visual-math))]"}`}>
                        {live.latency}ms
                      </span>
                    )}
                    <span className={`px-2.5 py-0.5 text-xs rounded-full font-semibold ${
                      status === "operational" ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" : status === "degraded" ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                    }`}>
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border">
          <h2 className="font-heading font-bold text-lg vi-text">On-call Alert Queue</h2>
          <p className="text-xs vi-text-muted mt-1">
            Per-service ops-alerts outbox depth. Warning state escalates to PagerDuty after 3 consecutive checks.
          </p>
        </div>
        {outboxTiles.length === 0 ? (
          <div className="p-8 text-center vi-text-muted text-sm">No services reporting. Check OPS_ALERT_OUTBOX_SOURCES.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-5">
            {outboxTiles.map((t) => {
              const stateColor =
                t.state === "healthy"
                  ? "bg-[hsl(var(--visual-science)/0.10)] border-[hsl(var(--visual-science)/0.30)]"
                  : t.state === "warning"
                  ? "bg-[hsl(var(--visual-sel)/0.12)] border-[hsl(var(--visual-sel)/0.40)]"
                  : "bg-[hsl(var(--visual-math)/0.08)] border-[hsl(var(--visual-math)/0.30)]";
              const badgeColor =
                t.state === "healthy"
                  ? "bg-[hsl(var(--visual-science)/0.18)] text-[hsl(var(--visual-science))]"
                  : t.state === "warning"
                  ? "bg-[hsl(var(--visual-sel)/0.22)] text-[hsl(var(--visual-sel))]"
                  : "bg-[hsl(var(--visual-math)/0.18)] text-[hsl(var(--visual-math))]";
              const ls = t.lastShutdown;
              return (
                <div key={t.service} className={`rounded-xl border p-4 ${stateColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold vi-text">{t.service}</p>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold uppercase ${badgeColor}`}>
                      {t.state}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <p className="text-2xl font-bold vi-text">{t.depth}</p>
                      <p className="text-[10px] vi-text-muted">depth</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold vi-text">{t.enqueuedTotal}</p>
                      <p className="text-[10px] vi-text-muted">queued</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${t.droppedTotal > 0 ? "text-[hsl(var(--visual-math))]" : "vi-text"}`}>
                        {t.droppedTotal}
                      </p>
                      <p className="text-[10px] vi-text-muted">dropped</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-current/10 text-[11px] vi-text-muted">
                    <div className="flex justify-between">
                      <span>store</span>
                      <span className="font-medium vi-text">{t.storeKind ?? "—"}</span>
                    </div>
                    {t.firstNonZeroAt && (
                      <div className="flex justify-between">
                        <span>first non-zero</span>
                        <span className="font-medium vi-text">{new Date(t.firstNonZeroAt).toLocaleTimeString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>last deploy drain</span>
                      {ls ? (
                        <span className={`font-medium ${t.shutdownStale ? "vi-text-muted italic" : "vi-text"}`}>
                          drained {ls.drained} / lost {ls.lost}
                          {ls.flushTimedOut ? " (timeout)" : ""}
                        </span>
                      ) : (
                        <span className="italic vi-text-muted">none</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span>last auto-flush</span>
                      {t.lastAutoFlushAt ? (
                        <span className={`font-medium ${t.autoFlushErrorsTotal > 0 ? "text-[hsl(var(--visual-sel))]" : "vi-text"}`}>
                          {new Date(t.lastAutoFlushAt).toLocaleTimeString()} ·{" "}
                          {t.autoFlushDrainedTotal} drained
                          {t.autoFlushErrorsTotal > 0 ? ` · ${t.autoFlushErrorsTotal} err` : ""}
                        </span>
                      ) : (
                        <span className="italic vi-text-muted">never</span>
                      )}
                    </div>
                    {ls && (
                      <div className="flex justify-between">
                        <span>at</span>
                        <span className={`font-medium ${t.shutdownStale ? "italic text-[hsl(var(--visual-math))]" : "vi-text"}`}>
                          {new Date(ls.finishedAt).toLocaleString()}
                          {t.shutdownStale ? " (stale)" : ""}
                        </span>
                      </div>
                    )}
                    {t.error && (
                      <div className="mt-1 text-[hsl(var(--visual-math))] italic">{t.error}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="vi-card overflow-hidden">
        <div className="p-5 border-b vi-border flex items-center justify-between">
          <h2 className="font-heading font-bold text-lg vi-text">Incidents</h2>
          {user?.role === "PLATFORM_ADMIN" && (
            <button onClick={() => setShowIncidentForm(!showIncidentForm)}
              className="px-4 py-2 rounded-lg bg-[hsl(var(--visual-math)/0.08)] text-[hsl(var(--visual-math))] text-sm font-semibold hover:bg-[hsl(var(--visual-math)/0.16)] transition">
              + Report Incident
            </button>
          )}
        </div>
        {showIncidentForm && (
          <form onSubmit={handleCreateIncident} className="p-5 border-b vi-border flex gap-3 items-end vi-bg">
            <div className="flex-1">
              <label htmlFor="incident-title" className="block text-xs font-medium vi-text-muted mb-1">Title</label>
              <input id="incident-title" type="text" value={incidentTitle} onChange={(e) => setIncidentTitle(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border vi-border text-sm" placeholder="Describe the incident..." />
            </div>
            <div>
              <label htmlFor="incident-severity" className="block text-xs font-medium vi-text-muted mb-1">Severity</label>
              <select id="incident-severity" value={incidentSeverity} onChange={(e) => setIncidentSeverity(e.target.value)}
                className="px-3 py-2 rounded-lg border vi-border text-sm bg-white">
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[hsl(var(--visual-math))] text-white text-sm font-semibold">Create</button>
          </form>
        )}
        <div className="divide-y divide-slate-50">
          {incidents.length > 0 ? incidents.map((inc) => (
            <div key={inc.id} className="px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium vi-text">{inc.title}</p>
                <p className="text-xs vi-text-muted">{new Date(inc.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                  inc.severity === "critical" ? "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]" : inc.severity === "major" ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]" : "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                }`}>{inc.severity}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                  inc.status === "resolved" ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]" : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                }`}>{inc.status}</span>
              </div>
            </div>
          )) : (
            <div className="px-5 py-8 text-center vi-text-muted text-sm">No incidents reported</div>
          )}
        </div>
      </div>
    </div>
  );
}
