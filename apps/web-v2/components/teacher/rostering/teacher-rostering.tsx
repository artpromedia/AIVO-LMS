"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, Trash2, Plus, CheckCircle2, AlertTriangle, Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";

type RunStatus = "running" | "success" | "failed" | "paused";

type LatestRun = {
  id: string;
  status: RunStatus;
  finishedAt: string | null;
  counts: { added: number; updated: number; removed: number };
} | null;

type Connector = {
  id: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  credentialHint: string | null;
  latestRun: LatestRun;
};

type ProviderId = "google_classroom" | "clever" | "classlink" | "oneroster_rest";

/**
 * Roster provider catalogue. `ownership` drives the badge: Google
 * Classroom rosters belong to the teacher; the SIS providers are
 * normally district-managed (teachers may still connect them under the
 * "full connect parity" decision, with a clear label).
 */
const PROVIDERS: ReadonlyArray<{
  id: ProviderId;
  name: string;
  ownership: "teacher" | "district";
}> = [
  { id: "google_classroom", name: "Google Classroom", ownership: "teacher" },
  { id: "clever", name: "Clever", ownership: "district" },
  { id: "classlink", name: "ClassLink", ownership: "district" },
  { id: "oneroster_rest", name: "OneRoster", ownership: "district" },
];

function providerName(id: string): string {
  return PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

export function TeacherRostering() {
  const t = useTranslations("teacher.rostering");
  const [connectors, setConnectors] = React.useState<Connector[]>([]);
  const [canConnect, setCanConnect] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch("/api/bff/teacher/rostering", {
        headers: { accept: "application/json" },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error("load failed");
      setConnectors(json.data.connectors as Connector[]);
      setCanConnect(Boolean(json.data.canConnect));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function handleSync(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/bff/teacher/rostering/${id}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "full" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDisconnect(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/bff/teacher/rostering/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-iw-display text-2xl font-semibold text-iw-ink">{t("title")}</h1>
          <p className="mt-1 max-w-xl text-sm text-iw-ink-muted">{t("subtitle")}</p>
        </div>
        {canConnect ? (
          <Button type="button" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("add_source")}
          </Button>
        ) : null}
      </header>

      {!loading && !loadError && !canConnect ? (
        <div className="flex items-start gap-2 rounded-iw-card-lg border border-iw-border bg-iw-raised p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-iw-ink-muted" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-iw-ink">{t("locked_title")}</p>
            <p className="mt-0.5 text-sm text-iw-ink-muted">{t("locked_body")}</p>
          </div>
        </div>
      ) : null}

      <section aria-live="polite" aria-busy={loading} className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-iw-card-lg border border-iw-border bg-iw-card p-6 text-sm text-iw-ink-muted">
            {t("loading")}
          </div>
        ) : loadError ? (
          <div className="rounded-iw-card-lg border border-iw-border bg-iw-card p-6">
            <p className="text-sm text-aivo-danger">{t("error_load")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void load()}
            >
              {t("retry")}
            </Button>
          </div>
        ) : connectors.length === 0 ? (
          <EmptyState
            icon={<Link2 className="h-6 w-6" aria-hidden="true" />}
            title={t("empty_title")}
            description={canConnect ? t("empty_body") : t("locked_body")}
            action={
              canConnect ? (
                <Button type="button" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("add_source")}
                </Button>
              ) : undefined
            }
          />
        ) : (
          connectors.map((c) => (
            <ConnectorCard
              key={c.id}
              connector={c}
              busy={busyId === c.id}
              canManage={canConnect}
              onSync={() => handleSync(c.id)}
              onDisconnect={() => handleDisconnect(c.id)}
            />
          ))
        )}
      </section>

      <p className="text-xs text-iw-ink-muted">{t("manual_note")}</p>

      <ConnectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={connectors.map((c) => c.provider)}
        onConnected={() => {
          setDialogOpen(false);
          void load();
        }}
      />
    </div>
  );
}

function ConnectorCard({
  connector,
  busy,
  canManage,
  onSync,
  onDisconnect,
}: {
  connector: Connector;
  busy: boolean;
  canManage: boolean;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslations("teacher.rostering");
  const run = connector.latestRun;
  const status: RunStatus | "idle" = run?.status ?? "idle";
  const tone = status === "failed" || status === "paused" ? "warning" : "success";

  return (
    <div className="rounded-iw-card-lg border border-iw-border bg-iw-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-iw-display text-lg font-semibold text-iw-ink">
              {connector.displayName}
            </p>
            <Badge tone="neutral">{providerName(connector.provider)}</Badge>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-iw-ink-muted">
            {tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-aivo-success" aria-hidden="true" />
            ) : (
              <AlertTriangle
                className="h-4 w-4 text-[var(--aivo-status-warning)]"
                aria-hidden="true"
              />
            )}
            <span>{run ? t(`status_${status}` as "status_success") : t("status_idle")}</span>
            {run?.finishedAt ? (
              <span>· {t("last_synced", { time: new Date(run.finishedAt).toLocaleString() })}</span>
            ) : null}
          </div>
          {run ? (
            <p className="mt-1 text-xs text-iw-ink-muted">
              {t("counts", {
                added: run.counts.added,
                updated: run.counts.updated,
                removed: run.counts.removed,
              })}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onSync} disabled={busy}>
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
              {busy ? t("syncing") : t("sync_now")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDisconnect}
              disabled={busy}
              aria-label={t("disconnect")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ConnectDialog({
  open,
  onOpenChange,
  existing,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: string[];
  onConnected: () => void;
}) {
  const t = useTranslations("teacher.rostering");
  const [provider, setProvider] = React.useState<ProviderId>("google_classroom");
  const [displayName, setDisplayName] = React.useState("");
  const [hint, setHint] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setProvider("google_classroom");
      setDisplayName("");
      setHint("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!displayName.trim()) {
      setError(t("name_required"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/teacher/rostering", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          displayName: displayName.trim(),
          credentialHint: hint.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json?.error?.userMessage ?? t("connect_failed"));
        return;
      }
      onConnected();
    } catch {
      setError(t("connect_failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t("dialog_title")}</DialogTitle>
        <DialogDescription>{t("dialog_desc")}</DialogDescription>

        <div className="mt-4 space-y-4">
          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-iw-ink">
              {t("provider_label")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p) => {
                const selected = provider === p.id;
                const already = existing.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    aria-pressed={selected}
                    className={`flex flex-col items-start gap-1 rounded-iw-control border p-3 text-left transition-colors ${
                      selected
                        ? "border-iw-primary bg-iw-accent-soft"
                        : "border-iw-border bg-iw-raised hover:bg-iw-card"
                    }`}
                  >
                    <span className="text-sm font-semibold text-iw-ink">{p.name}</span>
                    <Badge tone={p.ownership === "teacher" ? "primary" : "neutral"}>
                      {p.ownership === "teacher" ? t("owner_teacher") : t("owner_district")}
                    </Badge>
                    {already ? (
                      <span className="text-[10px] text-iw-ink-muted">
                        {t("already_connected")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="roster-name" className="mb-1.5 block text-sm font-medium text-iw-ink">
              {t("name_label")}
            </label>
            <Input
              id="roster-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("name_placeholder")}
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="roster-hint" className="mb-1.5 block text-sm font-medium text-iw-ink">
              {t("hint_label")}
            </label>
            <Input
              id="roster-hint"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              placeholder={t("hint_placeholder")}
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-iw-ink-muted">{t("hint_help")}</p>
          </div>

          {error ? <p className="text-sm text-aivo-danger">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !displayName.trim()}
            >
              {submitting ? t("connecting") : t("connect")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
