"use client";
import { useAuth } from "@/providers/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconWell } from "@/components/discovery/_vi";
import {
  Plug,
  School,
  Circle,
  Link2,
  Palette,
  BookOpen,
  Zap,
  Check,
  type LucideIcon,
} from "lucide-react";

interface Connector {
  id: string;
  name: string;
  status: string;
  category: string;
  description: string;
  icon: string;
  features: string[];
  authType: string;
  docsUrl: string;
}

interface Connection {
  id: string;
  connectorId: string;
  connectorName: string;
  connectorType: string;
  status: string;
  hasCredentials: boolean;
  lastSyncAt: string | null;
  connectedAt: string | null;
  createdAt: string;
  metadata: any;
  config: any;
}

interface SyncLog {
  id: string;
  connectionId: string;
  syncType: string;
  status: string;
  recordsSynced: number;
  recordsFailed: number;
  recordsSkipped: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errors: any[];
}

const CONNECTOR_ICONS: Record<string, LucideIcon> = {
  google_classroom: School,
  clever: Circle,
  classlink: Link2,
  canvas_lms: Palette,
  schoology: BookOpen,
  powerschool: Zap,
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  authorized: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  syncing: "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]",
  pending: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  error: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  disconnected: "vi-surface-soft vi-text-muted",
};

const SYNC_STATUS_STYLES: Record<string, string> = {
  completed: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  success: "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]",
  running: "bg-[hsl(var(--visual-reading)/0.12)] text-[hsl(var(--visual-reading))]",
  partial: "bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))]",
  failed: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  failure: "bg-[hsl(var(--visual-math)/0.12)] text-[hsl(var(--visual-math))]",
  pending: "vi-surface-soft vi-text-muted",
};

const CONNECTION_STATUS_KEYS: Record<string, string> = {
  active: "integrations_conn_status_active",
  authorized: "integrations_conn_status_authorized",
  syncing: "integrations_conn_status_syncing",
  pending: "integrations_conn_status_pending",
  error: "integrations_conn_status_error",
  disconnected: "integrations_conn_status_disconnected",
};

const SYNC_STATUS_KEYS: Record<string, string> = {
  completed: "integrations_sync_status_completed",
  running: "integrations_sync_status_running",
  partial: "integrations_sync_status_partial",
  failed: "integrations_sync_status_failed",
  pending: "integrations_sync_status_pending",
  success: "integrations_sync_status_success",
  failure: "integrations_sync_status_failure",
};

const SYNC_TYPE_KEYS: Record<string, string> = {
  full: "integrations_sync_type_full",
  incremental: "integrations_sync_type_incremental",
};

export default function IntegrationsPage() {
  const { user, accessToken } = useAuth();
  const t = useTranslations("districtAdmin");
  const tc = useTranslations("common");
  const searchParams = useSearchParams();
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [syncLogs, setSyncLogs] = useState<Record<string, SyncLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [canvasUrlInput, setCanvasUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState<"catalog" | "connected">("catalog");
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [showWaitlistFor, setShowWaitlistFor] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);

  const tenantId = user?.tenantId;

  const fetchData = useCallback(async () => {
    if (!accessToken || !tenantId) return;
    try {
      const [connectorsRes, connectionsRes] = await Promise.all([
        fetch("/api/integrations/connectors"),
        fetch(`/api/integrations/connections/${tenantId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (connectorsRes.ok) {
        const data = await connectorsRes.json();
        setConnectors(data.connectors || []);
      }

      if (connectionsRes.ok) {
        const data = await connectionsRes.json();
        setConnections(data.connections || []);

        for (const conn of data.connections || []) {
          const logsRes = await fetch(`/api/integrations/sync-logs/${conn.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (logsRes.ok) {
            const logsData = await logsRes.json();
            setSyncLogs((prev) => ({ ...prev, [conn.id]: logsData.logs || [] }));
          }
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [accessToken, tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected) {
      setNotification({ type: "success", message: t("integrations_toast_connected_success") });
      setActiveTab("connected");
      fetchData();
    }
    if (error) {
      setNotification({
        type: "error",
        message: t("integrations_toast_connect_failed", { error: error.replace(/_/g, " ") }),
      });
    }
  }, [searchParams, fetchData]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleConnect = async (connector: Connector) => {
    if (!tenantId || !accessToken) return;

    if (connector.authType === "api_key") {
      setShowApiKeyModal(connector.id);
      return;
    }

    if (connector.authType === "oauth2") {
      setConnectingId(connector.id);
      try {
        const res = await fetch(
          `/api/integrations/oauth/${connector.id}/authorize?tenantId=${tenantId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.authorizationUrl) {
            window.location.href = data.authorizationUrl;
            return;
          }
        }

        const result = await fetch("/api/integrations/connect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ tenantId, connectorId: connector.id }),
        });

        if (result.ok) {
          setNotification({
            type: "success",
            message: t("integrations_toast_connector_connected", { name: connector.name }),
          });
          setActiveTab("connected");
          fetchData();
        } else {
          const err = await result.json();
          setNotification({
            type: "error",
            message: err.error || t("integrations_toast_connect_failed_generic"),
          });
        }
      } catch {
        setNotification({ type: "error", message: t("integrations_toast_connect_failed_retry") });
      } finally {
        setConnectingId(null);
      }
    }
  };

  const handleApiKeyConnect = async () => {
    if (!tenantId || !accessToken || !showApiKeyModal) return;

    try {
      const res = await fetch("/api/integrations/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tenantId,
          connectorId: showApiKeyModal,
          credentials: { apiToken: apiKeyInput },
          config: showApiKeyModal === "canvas_lms" ? { canvasUrl: canvasUrlInput } : {},
        }),
      });

      if (res.ok) {
        setNotification({ type: "success", message: t("integrations_toast_api_key_success") });
        setActiveTab("connected");
        fetchData();
      } else {
        const err = await res.json();
        setNotification({
          type: "error",
          message: err.error || t("integrations_toast_connect_failed_retry"),
        });
      }
    } catch {
      setNotification({ type: "error", message: t("integrations_toast_connect_failed_retry") });
    } finally {
      setShowApiKeyModal(null);
      setApiKeyInput("");
      setCanvasUrlInput("");
    }
  };

  const handleSync = async (connectionId: string) => {
    if (!accessToken) return;
    setSyncing((prev) => ({ ...prev, [connectionId]: true }));

    try {
      const res = await fetch(`/api/integrations/sync/${connectionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ syncType: "full" }),
      });

      if (res.ok) {
        setNotification({ type: "success", message: t("integrations_toast_sync_started") });
        setTimeout(fetchData, 3000);
        setTimeout(fetchData, 10000);
      } else {
        const err = await res.json();
        setNotification({
          type: "error",
          message: err.error || t("integrations_toast_sync_failed"),
        });
      }
    } catch {
      setNotification({ type: "error", message: t("integrations_toast_sync_failed_start") });
    } finally {
      setSyncing((prev) => ({ ...prev, [connectionId]: false }));
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!accessToken || !confirm(t("integrations_toast_disconnect_confirm"))) return;

    try {
      const res = await fetch(`/api/integrations/disconnect/${connectionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        setNotification({ type: "success", message: t("integrations_toast_disconnected") });
        fetchData();
      }
    } catch {
      setNotification({ type: "error", message: t("integrations_toast_disconnect_failed") });
    }
  };

  const connectedIds = connections
    .filter((c) => c.status !== "disconnected")
    .map((c) => c.connectorId);

  const getConnectionStatusLabel = (status: string) => {
    const key = CONNECTION_STATUS_KEYS[status];
    return key ? t(key) : status;
  };

  const getSyncStatusLabel = (status: string) => {
    const key = SYNC_STATUS_KEYS[status];
    return key ? t(key) : status;
  };

  const getSyncTypeLabel = (type: string) => {
    const key = SYNC_TYPE_KEYS[type];
    return key ? t(key) : t("integrations_sync_type_label", { type });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return t("integrations_time_never");
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t("integrations_time_just_now");
    if (diffMins < 60) return t("integrations_time_minutes_ago", { m: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t("integrations_time_hours_ago", { h: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t("integrations_time_days_ago", { d: diffDays });
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 bg-slate-200 rounded-lg w-64 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 border vi-border animate-pulse">
              <div className="h-12 w-12 bg-slate-200 rounded-xl mb-4" />
              <div className="h-5 bg-slate-200 rounded w-32 mb-2" />
              <div className="h-3 vi-surface-soft rounded w-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {notification && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between ${
            notification.type === "success"
              ? "bg-[hsl(var(--visual-science)/0.08)] text-[hsl(var(--visual-science))] border border-[hsl(var(--visual-science)/0.25)]"
              : "bg-[hsl(var(--visual-math)/0.08)] text-[hsl(var(--visual-math))] border border-[hsl(var(--visual-math)/0.25)]"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-current opacity-50 hover:opacity-100"
          >
            x
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <IconWell color="primary">
            <Plug size={28} strokeWidth={2.5} aria-hidden="true" />
          </IconWell>
          <div>
            <h1 className="text-2xl font-heading font-bold vi-text">{t("integrations")}</h1>
            <p className="text-sm vi-text-muted mt-1">{t("integrations_subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 vi-surface-soft rounded-lg p-1">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === "catalog"
                ? "bg-white shadow text-[hsl(var(--visual-primary))]"
                : "vi-text-muted"
            }`}
          >
            {t("integrations_tab_available")} (
            {
              connectors.filter((c) => c.status !== "coming_soon" && !connectedIds.includes(c.id))
                .length
            }
            )
          </button>
          <button
            onClick={() => setActiveTab("connected")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              activeTab === "connected"
                ? "bg-white shadow text-[hsl(var(--visual-primary))]"
                : "vi-text-muted"
            }`}
          >
            {t("integrations_tab_connected")} (
            {connections.filter((c) => c.status !== "disconnected").length})
          </button>
        </div>
      </div>

      {activeTab === "catalog" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map((connector) => {
              const isConnected = connectedIds.includes(connector.id);
              const isComingSoon = connector.status === "coming_soon";
              const isConnecting = connectingId === connector.id;

              return (
                <div
                  key={connector.id}
                  className={`bg-white rounded-2xl p-6 border transition-all ${
                    isConnected
                      ? "border-[hsl(var(--visual-science)/0.30)] bg-[hsl(var(--visual-science)/0.05)]"
                      : isComingSoon
                        ? "vi-border opacity-60"
                        : "vi-border hover:border-[hsl(var(--visual-primary)/0.3)] hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    {(() => {
                      const ConnIcon = CONNECTOR_ICONS[connector.id] || Plug;
                      return (
                        <div className="w-12 h-12 vi-surface-soft text-[hsl(var(--visual-primary))] rounded-2xl flex items-center justify-center">
                          <ConnIcon size={24} strokeWidth={2.5} aria-hidden="true" />
                        </div>
                      );
                    })()}
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                        isConnected
                          ? "bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))]"
                          : isComingSoon
                            ? "vi-surface-soft vi-text-muted"
                            : "bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))]"
                      }`}
                    >
                      {isConnected
                        ? t("integrations_status_connected")
                        : isComingSoon
                          ? t("integrations_status_coming_soon")
                          : t("integrations_status_available")}
                    </span>
                  </div>

                  <h3 className="font-heading font-bold text-lg vi-text mb-1">{connector.name}</h3>
                  <p className="text-xs vi-text-muted mb-3">{connector.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {connector.features.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-0.5 text-[10px] rounded-full vi-surface-soft vi-text-muted font-medium"
                      >
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <button
                        onClick={() => setActiveTab("connected")}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))] hover:bg-[hsl(var(--visual-science)/0.22)] transition"
                      >
                        {t("integrations_button_view_connection")}
                      </button>
                    ) : isComingSoon ? (
                      <button
                        onClick={() => setShowWaitlistFor(connector.id)}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(var(--visual-sel)/0.18)] text-[hsl(var(--visual-sel))] hover:bg-[hsl(var(--visual-sel)/0.28)] transition"
                      >
                        {t("integrations_button_notify")}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(connector)}
                        disabled={isConnecting}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50"
                      >
                        {isConnecting
                          ? t("integrations_button_connecting")
                          : t("integrations_button_connect")}
                      </button>
                    )}
                    <a
                      href={connector.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg vi-text-muted hover:vi-text-muted hover:vi-surface-soft transition"
                      title={t("integrations_docs_title")}
                    >
                      ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="vi-surface-soft border border-[hsl(var(--visual-primary)/0.3)] rounded-2xl p-6">
            <h3 className="font-heading font-bold text-lg vi-text mb-2">
              {t("integrations_different_title")}
            </h3>
            <p className="text-sm vi-text-muted mb-3">{t("integrations_different_desc")}</p>
            <button
              onClick={() => {
                setShowRequestModal(true);
                setRequestSubmitted(false);
                setRequestName("");
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition"
            >
              {t("integrations_different_button")}
            </button>
          </div>
        </div>
      )}

      {activeTab === "connected" && (
        <div className="space-y-6">
          {connections.filter((c) => c.status !== "disconnected").length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border vi-border text-center">
              <div className="w-16 h-16 bg-[hsl(var(--visual-primary)/0.12)] text-[hsl(var(--visual-primary))] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Plug size={32} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <h3 className="font-heading font-bold text-lg vi-text mb-2">
                {t("integrations_empty_title")}
              </h3>
              <p className="text-sm vi-text-muted mb-4">{t("integrations_empty_desc")}</p>
              <button
                onClick={() => setActiveTab("catalog")}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition"
              >
                {t("integrations_empty_button")}
              </button>
            </div>
          ) : (
            connections
              .filter((c) => c.status !== "disconnected")
              .map((conn) => {
                const logs = syncLogs[conn.id] || [];
                const lastSync = logs[0];

                return (
                  <div key={conn.id} className="vi-card overflow-hidden">
                    <div className="p-6 border-b vi-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {(() => {
                            const ConnIcon = CONNECTOR_ICONS[conn.connectorId] || Plug;
                            return (
                              <div className="w-12 h-12 vi-surface-soft text-[hsl(var(--visual-primary))] rounded-2xl flex items-center justify-center">
                                <ConnIcon size={24} strokeWidth={2.5} aria-hidden="true" />
                              </div>
                            );
                          })()}
                          <div>
                            <h3 className="font-heading font-bold text-lg vi-text">
                              {conn.connectorName}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full font-semibold ${STATUS_STYLES[conn.status] || "vi-surface-soft vi-text-muted"}`}
                              >
                                {getConnectionStatusLabel(conn.status)}
                              </span>
                              <span className="text-xs vi-text-muted">
                                {t("integrations_connected_at", {
                                  when: formatTime(conn.connectedAt),
                                })}
                              </span>
                              {conn.lastSyncAt && (
                                <span className="text-xs vi-text-muted">
                                  {t("integrations_last_sync", {
                                    when: formatTime(conn.lastSyncAt),
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSync(conn.id)}
                            disabled={syncing[conn.id] || conn.status === "syncing"}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50"
                          >
                            {syncing[conn.id] || conn.status === "syncing"
                              ? t("integrations_button_syncing")
                              : t("integrations_button_sync_now")}
                          </button>
                          <button
                            onClick={() => handleDisconnect(conn.id)}
                            className="px-4 py-2 rounded-lg text-sm font-semibold text-[hsl(var(--visual-math))] hover:bg-[hsl(var(--visual-math)/0.08)] border border-[hsl(var(--visual-math)/0.25)] transition"
                          >
                            {t("integrations_button_disconnect")}
                          </button>
                        </div>
                      </div>
                    </div>

                    {lastSync && (
                      <div className="px-6 py-4 vi-bg/50 border-b vi-border">
                        <div className="flex items-center gap-6">
                          <div>
                            <p className="text-[10px] vi-text-muted font-semibold uppercase">
                              {t("integrations_label_last_sync_status")}
                            </p>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full font-semibold ${SYNC_STATUS_STYLES[lastSync.status] || "vi-surface-soft vi-text-muted"}`}
                            >
                              {getSyncStatusLabel(lastSync.status)}
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] vi-text-muted font-semibold uppercase">
                              {t("integrations_label_records_synced")}
                            </p>
                            <p className="text-sm font-bold vi-text">{lastSync.recordsSynced}</p>
                          </div>
                          {lastSync.recordsFailed > 0 && (
                            <div>
                              <p className="text-[10px] vi-text-muted font-semibold uppercase">
                                {t("integrations_label_failed")}
                              </p>
                              <p className="text-sm font-bold text-[hsl(var(--visual-math))]">
                                {lastSync.recordsFailed}
                              </p>
                            </div>
                          )}
                          {lastSync.recordsSkipped > 0 && (
                            <div>
                              <p className="text-[10px] vi-text-muted font-semibold uppercase">
                                {t("integrations_label_skipped")}
                              </p>
                              <p className="text-sm font-bold text-[hsl(var(--visual-sel))]">
                                {lastSync.recordsSkipped}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] vi-text-muted font-semibold uppercase">
                              {t("integrations_label_duration")}
                            </p>
                            <p className="text-sm font-bold vi-text">
                              {formatDuration(lastSync.durationMs)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {logs.length > 0 && (
                      <div className="px-6 py-4">
                        <p className="text-xs font-bold vi-text-muted uppercase mb-3">
                          {t("integrations_label_sync_history")}
                        </p>
                        <div className="space-y-2">
                          {logs.slice(0, 5).map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center justify-between py-2 border-b vi-border last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${SYNC_STATUS_STYLES[log.status] || "vi-surface-soft vi-text-muted"}`}
                                >
                                  {getSyncStatusLabel(log.status)}
                                </span>
                                <span className="text-xs vi-text-muted">
                                  {getSyncTypeLabel(log.syncType)}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs vi-text-muted">
                                <span>
                                  {t("integrations_records_count", { count: log.recordsSynced })}
                                </span>
                                <span>{formatDuration(log.durationMs)}</span>
                                <span>{formatTime(log.startedAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {lastSync?.errors && lastSync.errors.length > 0 && (
                      <div className="px-6 py-4 bg-[hsl(var(--visual-math)/0.06)] border-t border-[hsl(var(--visual-math)/0.20)]">
                        <p className="text-xs font-bold text-[hsl(var(--visual-math))] uppercase mb-2">
                          {t("integrations_label_errors")}
                        </p>
                        {lastSync.errors.map((err: any, i: number) => (
                          <p key={i} className="text-xs text-[hsl(var(--visual-math))]">
                            {err.message}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            {requestSubmitted ? (
              <>
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-[hsl(var(--visual-science)/0.14)] text-[hsl(var(--visual-science))] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={28} strokeWidth={3} aria-hidden="true" />
                  </div>
                  <h3 className="font-heading font-bold text-lg vi-text mb-2">
                    {t("integrations_request_submitted_title")}
                  </h3>
                  <p className="text-sm vi-text-muted">
                    {t("integrations_request_submitted_desc")}
                  </p>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="w-full py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition mt-4"
                >
                  {t("integrations_request_done")}
                </button>
              </>
            ) : (
              <>
                <h3 className="font-heading font-bold text-lg vi-text mb-2">
                  {t("integrations_request_modal_title")}
                </h3>
                <p className="text-sm vi-text-muted mb-4">{t("integrations_request_modal_desc")}</p>
                <label htmlFor="request-name" className="block text-sm font-medium vi-text mb-1">
                  {t("integrations_request_platform_label")}
                </label>
                <input
                  id="request-name"
                  type="text"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  placeholder={t("integrations_request_platform_placeholder")}
                  className="w-full px-3 py-2 rounded-lg border vi-border text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none mb-4"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold border vi-border vi-text-muted hover:vi-bg transition"
                  >
                    {t("integrations_cancel")}
                  </button>
                  <button
                    onClick={() => {
                      setRequestSubmitted(true);
                      setNotification({
                        type: "success",
                        message: t("integrations_request_toast_submitted", { name: requestName }),
                      });
                    }}
                    disabled={!requestName.trim()}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50"
                  >
                    {t("integrations_submit_request")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="font-heading font-bold text-lg vi-text mb-4">
              {t("integrations_apikey_modal_title", {
                name: connectors.find((c) => c.id === showApiKeyModal)?.name ?? "",
              })}
            </h3>

            {showApiKeyModal === "canvas_lms" && (
              <div className="mb-4">
                <label htmlFor="canvas-url" className="block text-sm font-medium vi-text mb-1">
                  {t("integrations_canvas_url_label")}
                </label>
                <input
                  id="canvas-url"
                  type="url"
                  value={canvasUrlInput}
                  onChange={(e) => setCanvasUrlInput(e.target.value)}
                  placeholder={t("integrations_canvas_url_placeholder")}
                  className="w-full px-3 py-2 rounded-lg border vi-border text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                />
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="api-token" className="block text-sm font-medium vi-text mb-1">
                {t("integrations_api_token_label")}
              </label>
              <input
                id="api-token"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={t("integrations_api_token_placeholder")}
                className="w-full px-3 py-2 rounded-lg border vi-border text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
              />
              <p className="text-[10px] vi-text-muted mt-1">{t("integrations_api_token_help")}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowApiKeyModal(null);
                  setApiKeyInput("");
                  setCanvasUrlInput("");
                }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border vi-border vi-text-muted hover:vi-bg transition"
              >
                {t("integrations_cancel")}
              </button>
              <button
                onClick={handleApiKeyConnect}
                disabled={!apiKeyInput || (showApiKeyModal === "canvas_lms" && !canvasUrlInput)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50"
              >
                {t("integrations_button_connect")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWaitlistFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-heading font-bold text-lg vi-text mb-2">
              {t("integrations_waitlist_title", {
                name: connectors.find((c) => c.id === showWaitlistFor)?.name ?? "",
              })}
            </h3>
            <p className="text-sm vi-text-muted mb-4">{t("integrations_waitlist_desc")}</p>
            <label
              htmlFor="waitlist-email"
              className="block text-xs font-semibold vi-text-muted mb-1"
            >
              {t("integrations_waitlist_email_label")}
            </label>
            <input
              id="waitlist-email"
              type="email"
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder={t("integrations_waitlist_email_placeholder")}
              className="w-full px-3 py-2 rounded-lg border vi-border text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowWaitlistFor(null);
                  setWaitlistEmail("");
                }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border vi-border vi-text-muted hover:vi-bg transition"
              >
                {t("integrations_cancel")}
              </button>
              <button
                onClick={async () => {
                  if (!showWaitlistFor || !waitlistEmail.trim() || !tenantId) return;
                  setWaitlistSubmitting(true);
                  try {
                    const res = await fetch("/api/integrations/waitlist", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                      },
                      body: JSON.stringify({
                        connectorId: showWaitlistFor,
                        districtId: tenantId,
                        contactEmail: waitlistEmail.trim(),
                      }),
                    });
                    if (res.ok) {
                      setNotification({
                        type: "success",
                        message: t("integrations_waitlist_toast_joined"),
                      });
                      setShowWaitlistFor(null);
                      setWaitlistEmail("");
                    } else {
                      const err = await res.json().catch(() => ({}));
                      setNotification({
                        type: "error",
                        message: err.error || t("integrations_waitlist_toast_failed"),
                      });
                    }
                  } finally {
                    setWaitlistSubmitting(false);
                  }
                }}
                disabled={!waitlistEmail.trim() || waitlistSubmitting}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50"
              >
                {waitlistSubmitting
                  ? t("integrations_waitlist_submitting")
                  : t("integrations_waitlist_notify_me")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
