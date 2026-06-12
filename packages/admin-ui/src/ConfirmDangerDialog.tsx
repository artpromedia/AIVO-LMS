"use client";

import * as React from "react";

/**
 * ConfirmDangerDialog — the one way destructive admin verbs execute.
 *
 * Renders the trigger button and a native `<dialog>` (showModal gives the
 * focus trap, Esc handling and backdrop for free — no new dependencies in
 * the admin stack). The destructive `<form action={serverAction}>` lives
 * INSIDE the dialog, so the action can only ever fire after an explicit
 * confirm; `requireTypedValue` additionally gates irreversible credential
 * cuts behind type-to-confirm.
 *
 * JS requirement: without JavaScript the trigger is inert (the action
 * cannot fire at all) — for an internal, JS-required console, failing
 * closed is the correct degradation for a destructive control.
 */
export interface ConfirmDangerDialogProps {
  /** Server action invoked on confirm. */
  action: (formData: FormData) => void | Promise<void>;
  /** Hidden inputs posted with the action (ids etc.). */
  hiddenFields?: Record<string, string>;
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** When set, the confirm button stays disabled until this exact value is typed. */
  requireTypedValue?: string;
  /** Label for the type-to-confirm input. */
  typedValueLabel?: string;
}

export function ConfirmDangerDialog({
  action,
  hiddenFields = {},
  trigger,
  triggerClassName,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  requireTypedValue,
  typedValueLabel = "Type the name to confirm",
}: ConfirmDangerDialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const bodyId = React.useId();
  const [typed, setTyped] = React.useState("");

  const open = () => {
    setTyped("");
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const confirmDisabled = Boolean(requireTypedValue) && typed !== requireTypedValue;

  return (
    <>
      <button type="button" className={triggerClassName ?? "admin-action"} onClick={open}>
        {trigger}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="admin-dialog"
      >
        <form action={action} onSubmit={() => close()} className="admin-dialog-form">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={titleId} className="admin-dialog-title">
            {title}
          </h2>
          <p id={bodyId} className="admin-dialog-body">
            {body}
          </p>
          {requireTypedValue ? (
            <label className="admin-dialog-typed">
              <span>
                {typedValueLabel}{" "}
                <code className="admin-dialog-typed-target">{requireTypedValue}</code>
              </span>
              <input
                className="admin-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          ) : null}
          <div className="admin-dialog-actions">
            {/* Cancel first in DOM = initial focus lands on the safe path. */}
            <button type="button" className="admin-button-secondary" onClick={close} autoFocus>
              {cancelLabel}
            </button>
            <button type="submit" className="admin-button-danger" disabled={confirmDisabled}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
