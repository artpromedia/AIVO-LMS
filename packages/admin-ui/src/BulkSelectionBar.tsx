"use client";

import * as React from "react";
import { ConfirmDangerDialog } from "./ConfirmDangerDialog.js";

/**
 * BulkSelectionBar (Sprint 11) — bulk actions over row checkboxes, gated by
 * ConfirmDangerDialog.
 *
 * Pages render plain server-side checkboxes (`<input type="checkbox"
 * name={checkboxName} value={id} />`) in their table rows; this bar finds
 * them in the DOM, keeps a live selected count (announced via aria-live),
 * offers select-all/clear, and on confirm posts the selection as a single
 * comma-joined `ids` hidden field to the server action. Reading the DOM at
 * dialog-open time (via getHiddenFields) means the page itself stays a
 * server component — no selection state lifting required.
 */
export interface BulkSelectionBarProps {
  /** `name` attribute shared by the row checkboxes this bar aggregates. */
  checkboxName: string;
  /** Server action; receives `ids` = comma-joined values of checked boxes. */
  action: (formData: FormData) => void | Promise<void>;
  /** Dialog title — `{count}` interpolates the live selection size. */
  title: string;
  /** Dialog body — `{count}` interpolates the live selection size. */
  body: string;
  /** Confirm button label — `{count}` interpolates. */
  confirmLabel: string;
  /** Trigger button label — `{count}` interpolates. */
  triggerLabel: string;
}

const fill = (template: string, count: number) =>
  template.replaceAll("{count}", String(count));

export function BulkSelectionBar({
  checkboxName,
  action,
  title,
  body,
  confirmLabel,
  triggerLabel,
}: BulkSelectionBarProps) {
  const [selected, setSelected] = React.useState(0);
  const [available, setAvailable] = React.useState(0);

  const boxes = React.useCallback(
    () =>
      Array.from(
        document.querySelectorAll<HTMLInputElement>(
          `input[type="checkbox"][name="${CSS.escape(checkboxName)}"]`,
        ),
      ),
    [checkboxName],
  );

  React.useEffect(() => {
    const recount = () => {
      const all = boxes();
      setAvailable(all.length);
      setSelected(all.filter((b) => b.checked).length);
    };
    recount();
    // Change events from the row checkboxes bubble to the document.
    document.addEventListener("change", recount);
    return () => document.removeEventListener("change", recount);
  }, [boxes]);

  const setAll = (checked: boolean) => {
    for (const box of boxes()) box.checked = checked;
    setSelected(checked ? boxes().length : 0);
  };

  if (available === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      data-testid="bulk-selection-bar"
    >
      <p aria-live="polite" className="text-sm font-semibold text-slate-600">
        {selected} of {available} selected
      </p>
      <button
        type="button"
        className="text-sm font-semibold text-blue-700 hover:underline"
        onClick={() => setAll(true)}
      >
        Select all
      </button>
      {selected > 0 ? (
        <button
          type="button"
          className="text-sm font-semibold text-blue-700 hover:underline"
          onClick={() => setAll(false)}
        >
          Clear
        </button>
      ) : null}
      {selected > 0 ? (
        <ConfirmDangerDialog
          action={action}
          getHiddenFields={() => ({
            ids: boxes()
              .filter((b) => b.checked)
              .map((b) => b.value)
              .join(","),
          })}
          trigger={fill(triggerLabel, selected)}
          triggerClassName="admin-button admin-button-secondary px-3 py-1 text-xs"
          title={fill(title, selected)}
          body={fill(body, selected)}
          confirmLabel={fill(confirmLabel, selected)}
        />
      ) : (
        <button
          type="button"
          className="admin-button admin-button-secondary px-3 py-1 text-xs"
          disabled
        >
          {fill(triggerLabel, 0)}
        </button>
      )}
    </div>
  );
}
