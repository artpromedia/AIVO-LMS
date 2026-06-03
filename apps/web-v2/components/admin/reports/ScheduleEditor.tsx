"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ReportSchema } from "@/lib/services/reports-svc";
import { ParamField, initialParamValues } from "./param-fields";
import { RecipientPicker } from "./RecipientPicker";

const inputClass =
  "h-11 w-full rounded-iw-card border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring";

export function ScheduleEditor({
  reportId,
  schema,
}: {
  reportId: string;
  schema: ReportSchema;
}) {
  const [params, setParams] = React.useState<Record<string, unknown>>(() =>
    initialParamValues(schema),
  );
  const [cron, setCron] = React.useState("0 7 * * 1");
  const [format, setFormat] = React.useState<string>(
    schema.defaultFormat || schema.formats?.[0] || "csv",
  );
  const [recipients, setRecipients] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  function setParam(name: string, value: unknown) {
    setParams((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/bff/admin/reports/schedules`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reportId, params, cron, recipients, format }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setSuccess(true);
        return;
      }
      const err = json?.error ?? {};
      setErrorCode(err.code ?? `HTTP_${res.status}`);
      if (err.code === "UNVERIFIED_RECIPIENTS") {
        setErrorMessage(
          err.userMessage ??
            "One or more recipients are not verified. Verify them before scheduling.",
        );
      } else {
        setErrorMessage(err.userMessage ?? err.message ?? "Could not save the schedule.");
      }
    } catch {
      setErrorCode("NETWORK_ERROR");
      setErrorMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="schedule-cron" className="mb-1 block text-sm font-medium text-iw-ink">
          Schedule (cron)
        </label>
        <input
          id="schedule-cron"
          type="text"
          className={inputClass}
          value={cron}
          onChange={(e) => setCron(e.target.value)}
        />
        <p className="mt-1 text-xs text-iw-ink-muted">weekly Mon 07:00</p>
      </div>

      <div>
        <label htmlFor="schedule-format" className="mb-1 block text-sm font-medium text-iw-ink">
          Format
        </label>
        <select
          id="schedule-format"
          className={inputClass}
          value={format}
          onChange={(e) => setFormat(e.target.value)}
        >
          {(schema.formats ?? [schema.defaultFormat]).map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {schema.params.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {schema.params.map((param) => (
            <ParamField
              key={param.name}
              param={param}
              schema={schema}
              value={params[param.name]}
              onChange={(v) => setParam(param.name, v)}
            />
          ))}
        </div>
      ) : null}

      <div>
        <p className="mb-1 block text-sm font-medium text-iw-ink">Recipients</p>
        <RecipientPicker value={recipients} onChange={setRecipients} />
      </div>

      {success ? (
        <div className="rounded-iw-card border border-aivo-success/40 bg-aivo-success/10 p-3 text-sm text-iw-ink">
          Schedule saved.
        </div>
      ) : null}

      {errorCode ? (
        <div className="rounded-iw-card border border-aivo-danger/40 bg-aivo-danger/10 p-3 text-sm">
          <p className="font-semibold text-iw-ink">{errorCode}</p>
          {errorMessage ? <p className="mt-0.5 text-iw-ink-muted">{errorMessage}</p> : null}
        </div>
      ) : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save schedule"}
      </Button>
    </form>
  );
}
