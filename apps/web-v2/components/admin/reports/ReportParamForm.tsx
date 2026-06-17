"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ReportSchema } from "@/lib/services/reports-svc";
import { ParamField, initialParamValues } from "./param-fields";

const selectClass =
  "h-11 w-full rounded-iw-card border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring";

export function ReportParamForm({ schema, basePath }: { schema: ReportSchema; basePath: string }) {
  const router = useRouter();
  const [params, setParams] = React.useState<Record<string, unknown>>(() =>
    initialParamValues(schema),
  );
  const [format, setFormat] = React.useState<string>(
    schema.defaultFormat || schema.formats?.[0] || "csv",
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<string[]>([]);

  function setParam(name: string, value: unknown) {
    setParams((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorCode(null);
    setErrorMessage(null);
    setFieldErrors([]);
    try {
      const res = await fetch(`/api/bff/admin/reports/${schema.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ params, format }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok && json.data?.runId) {
        router.push(`${basePath}/runs/${json.data.runId}`);
        return;
      }
      const err = json?.error ?? {};
      setErrorCode(err.code ?? `HTTP_${res.status}`);
      setErrorMessage(err.userMessage ?? err.message ?? "Could not start the report run.");
      const errs = json?.errors ?? err?.errors ?? json?.data?.errors;
      if (Array.isArray(errs)) {
        setFieldErrors(errs.map((x) => (typeof x === "string" ? x : JSON.stringify(x))));
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
        <div>
          <label htmlFor="report-format" className="mb-1 block text-sm font-medium text-iw-ink">
            Format
          </label>
          <select
            id="report-format"
            className={selectClass}
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
      </div>

      {errorCode ? (
        <div className="rounded-iw-card border border-iw-error/40 bg-iw-error/10 p-3 text-sm">
          <p className="font-semibold text-iw-ink">{errorCode}</p>
          {errorMessage ? <p className="mt-0.5 text-iw-ink-muted">{errorMessage}</p> : null}
          {fieldErrors.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-iw-ink-muted">
              {fieldErrors.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Running…" : "Run report"}
      </Button>
    </form>
  );
}
