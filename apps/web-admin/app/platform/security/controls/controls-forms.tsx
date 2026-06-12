"use client";

/**
 * Security-controls forms on useActionState — the canonical admin pattern
 * after Sprint 10: action results render in an aria-live FlashRegion next
 * to the form WITHOUT a redirect, so typed input survives a failure.
 * revalidatePath in the server action refreshes the table on success.
 */
import * as React from "react";
import { useActionState } from "react";
import { FlashRegion } from "@aivo/admin-ui";
import type { SecurityControlStatus, SecurityCriterion } from "@aivo/admin-api/security";

export interface ControlActionState {
  notice?: string;
  error?: string;
}

type Action = (state: ControlActionState, formData: FormData) => Promise<ControlActionState>;

export function AddControlForm({
  action,
  criteria,
  statuses,
}: {
  action: Action;
  criteria: readonly SecurityCriterion[];
  statuses: readonly SecurityControlStatus[];
}) {
  const [state, formAction, pending] = useActionState<ControlActionState, FormData>(action, {});
  return (
    <>
      <FlashRegion className="mt-3" notice={state.notice} error={state.error} />
      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
        <input className="admin-input w-28" name="code" placeholder="Code" required />
        <input className="admin-input flex-1" name="title" placeholder="Title" required />
        <input className="admin-input w-40" name="owner" placeholder="Owner" />
        <select className="admin-input" name="criterion" defaultValue="security">
          {criteria.map((criterion) => (
            <option key={criterion} value={criterion}>
              {criterion}
            </option>
          ))}
        </select>
        <select className="admin-input" name="status" defaultValue="not_started">
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button className="admin-button" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
    </>
  );
}

export function ControlStatusForm({
  action,
  controlId,
  current,
  statuses,
}: {
  action: Action;
  controlId: string;
  current: SecurityControlStatus;
  statuses: readonly SecurityControlStatus[];
}) {
  const [state, formAction, pending] = useActionState<ControlActionState, FormData>(action, {});
  return (
    <div className="flex flex-col gap-1">
      <form action={formAction} className="flex items-center gap-2">
        <input name="id" type="hidden" value={controlId} />
        <select
          className="admin-input"
          name="status"
          defaultValue={current}
          aria-describedby={state.error ? `control-${controlId}-error` : undefined}
          aria-invalid={state.error ? true : undefined}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button className="admin-action" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {state.error ? (
        <p id={`control-${controlId}-error`} role="alert" className="admin-error text-xs">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" aria-live="polite" className="admin-notice text-xs">
          {state.notice}
        </p>
      ) : null}
    </div>
  );
}
