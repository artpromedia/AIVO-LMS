"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function DevOpsDashboard() {
  const { accessToken } = useAuth();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const [statusOverview, setStatusOverview] = useState<any>(null);
  const [uptime, setUptime] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/status/overview")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/api/status/uptime")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([overview, uptimeData]) => {
      setStatusOverview(overview);
      setUptime(uptimeData);
    });

    const interval = setInterval(() => {
      fetch("/api/status/overview")
        .then((r) => (r.ok ? r.json() : null))
        .then(setStatusOverview)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const healthyCount =
    statusOverview?.services?.filter((s: any) => s.status === "healthy").length ?? 0;
  const totalServices = statusOverview?.services?.length ?? 0;
  const overallStatus = statusOverview?.overall ?? "checking";

  const infrastructure = [
    {
      name: "PostgreSQL 16",
      type: "Database",
      status: "healthy",
      uptime: "99.99%",
      region: "us-east",
    },
    {
      name: "Redis (Cache)",
      type: "Cache",
      status: "healthy",
      uptime: "99.95%",
      region: "us-east",
    },
    {
      name: "Hetzner Cloud",
      type: "Compute",
      status: "healthy",
      uptime: "99.97%",
      region: "eu-central",
    },
    {
      name: "S3 (Object Storage)",
      type: "Storage",
      status: "healthy",
      uptime: "99.99%",
      region: "us-east",
    },
    { name: "CDN (Assets)", type: "CDN", status: "healthy", uptime: "99.99%", region: "global" },
  ];

  const deployments = [
    {
      service: "web (Next.js)",
      version: "v3.2.1",
      deployedAt: "2h ago",
      status: "live",
      env: "production",
    },
    {
      service: "identity-svc",
      version: "v3.1.0",
      deployedAt: "1d ago",
      status: "live",
      env: "production",
    },
    {
      service: "brain-svc",
      version: "v3.0.8",
      deployedAt: "3d ago",
      status: "live",
      env: "production",
    },
    {
      service: "ai-svc",
      version: "v3.0.5",
      deployedAt: "5d ago",
      status: "live",
      env: "production",
    },
    {
      service: "assessment-svc",
      version: "v3.1.0",
      deployedAt: "1d ago",
      status: "live",
      env: "production",
    },
    {
      service: "learning-svc",
      version: "v3.0.4",
      deployedAt: "1w ago",
      status: "live",
      env: "production",
    },
  ];

  const performanceMetrics = [
    { metric: "P50 Latency", value: "45ms", status: "good" },
    { metric: "P95 Latency", value: "180ms", status: "good" },
    { metric: "P99 Latency", value: "450ms", status: "warning" },
    { metric: "Error Rate", value: "0.12%", status: "good" },
    { metric: "Throughput", value: "1.2K req/min", status: "good" },
    { metric: "CPU Usage", value: "42%", status: "good" },
    { metric: "Memory Usage", value: "68%", status: "warning" },
    { metric: "Disk Usage", value: "35%", status: "good" },
  ];

  const alerts = [
    {
      severity: "warning",
      message: "Memory usage on brain-svc above 80%",
      time: "1h ago",
      acked: false,
    },
    {
      severity: "info",
      message: "Auto-scaled identity-svc to 3 replicas",
      time: "4h ago",
      acked: true,
    },
    {
      severity: "warning",
      message: "Database connection pool at 75%",
      time: "6h ago",
      acked: true,
    },
    {
      severity: "resolved",
      message: "CDN cache miss rate normalized",
      time: "1d ago",
      acked: true,
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold vi-text">{t("overview")}</h1>
          <p className="text-sm vi-text-muted mt-1">
            Infrastructure monitoring, deployments, and system performance.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
            overallStatus === "operational"
              ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
              : overallStatus === "degraded"
                ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              overallStatus === "operational"
                ? "bg-[hsl(var(--visual-science))]"
                : overallStatus === "degraded"
                  ? "bg-[hsl(var(--visual-sel))] animate-pulse"
                  : "bg-[hsl(var(--visual-math))] animate-pulse"
            }`}
          />
          {overallStatus === "operational"
            ? "All Systems Operational"
            : overallStatus === "degraded"
              ? "Degraded"
              : overallStatus === "checking"
                ? "Checking..."
                : "Issues Detected"}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[hsl(var(--visual-science)/0.08)] rounded-xl p-5 border border-[hsl(var(--visual-science)/0.25)] text-center">
          <p className="text-3xl font-bold text-[hsl(var(--visual-science))]">
            {healthyCount}/{totalServices}
          </p>
          <p className="text-xs text-[hsl(var(--visual-science))] font-semibold mt-1">
            Services Healthy
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">{uptime?.uptime?.overall ?? "99.9"}%</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">30d Uptime</p>
        </div>
        <div className="bg-white rounded-xl p-5 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">{deployments.length}</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Active Deployments</p>
        </div>
        <div className="bg-white rounded-xl p-5 border vi-border text-center">
          <p className="text-3xl font-bold vi-text">{alerts.filter((a) => !a.acked).length}</p>
          <p className="text-xs vi-text-muted font-semibold mt-1">Unacked Alerts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vi-card overflow-hidden">
          <div className="p-5 border-b vi-border">
            <h2 className="font-heading font-bold text-lg vi-text">Service Health</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {(statusOverview?.services || []).map((svc: any) => (
              <div key={svc.name} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      svc.status === "healthy"
                        ? "bg-[hsl(var(--visual-science))]"
                        : svc.status === "degraded"
                          ? "bg-[hsl(var(--visual-sel))] animate-pulse"
                          : "bg-[hsl(var(--visual-math))]"
                    }`}
                  />
                  <span className="text-sm font-medium vi-text">{svc.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium ${
                      svc.latencyMs < 200
                        ? "text-[hsl(var(--visual-science))]"
                        : svc.latencyMs < 500
                          ? "text-[hsl(var(--visual-sel))]"
                          : "text-[hsl(var(--visual-math))]"
                    }`}
                  >
                    {svc.latencyMs}ms
                  </span>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                      svc.status === "healthy"
                        ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                        : svc.status === "degraded"
                          ? "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]"
                          : "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]"
                    }`}
                  >
                    {svc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="vi-card overflow-hidden">
          <div className="p-5 border-b vi-border">
            <h2 className="font-heading font-bold text-lg vi-text">Infrastructure</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {infrastructure.map((infra) => (
              <div key={infra.name} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium vi-text">{infra.name}</p>
                  <p className="text-xs vi-text-muted">
                    {infra.type} &middot; {infra.region}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs vi-text-muted">{infra.uptime}</span>
                  <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]">
                    {infra.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {performanceMetrics.map((pm) => (
          <div
            key={pm.metric}
            className={`rounded-xl p-3 border text-center ${
              pm.status === "good"
                ? "bg-[hsl(var(--visual-science)/0.08)] border-[hsl(var(--visual-science)/0.25)]"
                : pm.status === "warning"
                  ? "bg-[hsl(var(--visual-sel)/0.10)] border-[hsl(var(--visual-sel)/0.30)]"
                  : "bg-[hsl(var(--visual-math)/0.08)] border-[hsl(var(--visual-math)/0.25)]"
            }`}
          >
            <p
              className={`text-lg font-bold ${pm.status === "good" ? "text-[hsl(var(--visual-science))]" : pm.status === "warning" ? "text-[hsl(var(--visual-sel))]" : "text-[hsl(var(--visual-math))]"}`}
            >
              {pm.value}
            </p>
            <p className="text-[10px] vi-text-muted font-semibold mt-0.5">{pm.metric}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vi-card overflow-hidden">
          <div className="p-5 border-b vi-border">
            <h2 className="font-heading font-bold text-lg vi-text">Recent Deployments</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {deployments.map((d) => (
              <div key={d.service} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium vi-text">{d.service}</p>
                  <p className="text-xs vi-text-muted">
                    {d.env} &middot; {d.deployedAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs vi-text-muted">{d.version}</span>
                  <span className="px-2 py-0.5 text-xs rounded-full font-semibold bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]">
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="vi-card overflow-hidden">
          <div className="p-5 border-b vi-border">
            <h2 className="font-heading font-bold text-lg vi-text">Alerts</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      a.severity === "warning"
                        ? "bg-[hsl(var(--visual-sel))]"
                        : a.severity === "info"
                          ? "bg-[hsl(var(--visual-reading))]"
                          : "bg-[hsl(var(--visual-science))]"
                    }`}
                  />
                  <div>
                    <p className="text-sm vi-text">{a.message}</p>
                    <p className="text-xs vi-text-muted">{a.time}</p>
                  </div>
                </div>
                {!a.acked && (
                  <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]">
                    NEW
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
