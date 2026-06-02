"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type {
  NotificationMatrix as NotificationMatrixType,
  EventType,
  StaffRole,
} from "@/lib/admin/school-ops";
import {
  ALL_EVENT_TYPES,
  ALL_STAFF_ROLES,
  EVENT_TYPE_LABELS,
  STAFF_ROLE_LABELS,
} from "@/lib/admin/school-ops";

interface NotificationMatrixProps {
  schoolId: string;
  initialMatrix: NotificationMatrixType;
}

export function NotificationMatrix({ schoolId, initialMatrix }: NotificationMatrixProps) {
  const [matrix, setMatrix] = React.useState<NotificationMatrixType>(
    JSON.parse(JSON.stringify(initialMatrix)) as NotificationMatrixType,
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const toggle = (event: EventType, role: StaffRole) => {
    setMatrix((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as NotificationMatrixType;
      next[event][role] = !prev[event][role];
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bff/admin/school/notifications", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, matrix }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Failed to save settings.");
        return;
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-iw-ink-muted">
        Choose which email notifications each staff role receives for each event.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-left font-semibold text-iw-ink">Event</th>
              {ALL_STAFF_ROLES.map((role) => (
                <th key={role} className="p-3 text-center font-semibold text-iw-ink">
                  {STAFF_ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_EVENT_TYPES.map((event) => (
              <tr key={event} className="border-t border-iw-border">
                <td className="p-3 text-iw-ink">{EVENT_TYPE_LABELS[event]}</td>
                {ALL_STAFF_ROLES.map((role) => {
                  const checked = matrix[event][role];
                  const checkId = `notif-${event}-${role}`;
                  return (
                    <td key={role} className="p-3 text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          id={checkId}
                          checked={checked}
                          onCheckedChange={() => toggle(event, role)}
                          aria-label={`Send ${EVENT_TYPE_LABELS[event]} to ${STAFF_ROLE_LABELS[role]}`}
                        />
                        <Label htmlFor={checkId} className="sr-only">
                          {EVENT_TYPE_LABELS[event]} for {STAFF_ROLE_LABELS[role]}
                        </Label>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-aivo-success">
          Notification settings saved.
        </p>
      )}

      <Button onClick={handleSave} disabled={isSaving} type="button">
        {isSaving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
