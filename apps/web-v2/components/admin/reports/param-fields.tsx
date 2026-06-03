"use client";

import * as React from "react";
import type { ReportSchema } from "@/lib/services/reports-svc";

type Param = ReportSchema["params"][number];

const inputClass =
  "h-11 w-full rounded-iw-card border border-iw-border bg-iw-raised px-3 text-sm text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring";

/**
 * Render a single param input bound to a value map. Shared by ReportParamForm
 * and ScheduleEditor so the two stay in sync.
 */
export function ParamField({
  param,
  schema,
  value,
  onChange,
}: {
  param: Param;
  schema: ReportSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = `param-${param.name}`;

  let control: React.ReactNode;
  if (param.type === "tenantId") {
    control = (
      <select
        id={id}
        className={inputClass}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        required={param.required}
      >
        <option value="">Select…</option>
        {(schema.allowedTenantIds ?? []).map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    );
  } else if (param.type === "enum") {
    control = (
      <select
        id={id}
        className={inputClass}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        required={param.required}
      >
        <option value="">Select…</option>
        {(param.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (param.type === "number") {
    control = (
      <input
        id={id}
        type="number"
        className={inputClass}
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        required={param.required}
      />
    );
  } else if (param.type === "boolean") {
    control = (
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-iw-ink">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-iw-border"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        Enabled
      </label>
    );
  } else if (param.type === "date") {
    control = (
      <input
        id={id}
        type="date"
        className={inputClass}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        required={param.required}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type="text"
        className={inputClass}
        value={typeof value === "string" ? value : value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        required={param.required}
      />
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-iw-ink">
        {param.label}
        {param.required ? <span className="text-aivo-danger"> *</span> : null}
      </label>
      {control}
    </div>
  );
}

/** Seed a values map from a schema's defaults. */
export function initialParamValues(schema: ReportSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of schema.params) {
    if (p.default !== undefined) out[p.name] = p.default;
    else if (p.type === "boolean") out[p.name] = false;
    else out[p.name] = "";
  }
  return out;
}
