"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { CopyIcon, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  initialStaffInviteState,
  inviteStaffAction,
  revokeStaffInviteAction,
} from "./actions";

type SchoolOption = { id: string; name: string };

export function StaffInviteSection({
  schools,
  pendingInvites,
}: {
  schools: SchoolOption[];
  pendingInvites: Array<{
    id: string;
    email: string;
    role: "district_admin" | "school_admin" | "teacher";
    displayName: string;
    invitedAt: string;
    schoolId: string | null;
  }>;
}) {
  const t = useTranslations("admin.district_staff");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    inviteStaffAction,
    initialStaffInviteState,
  );
  const [role, setRole] = useState<"district_admin" | "school_admin" | "teacher">(
    "teacher",
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form whenever a success bounces back.
  useEffect(() => {
    if (state.status === "success" || state.status === "invited") {
      formRef.current?.reset();
      setRole("teacher");
    }
  }, [state]);

  return (
    <Card className="p-[var(--aivo-density-card-pad)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-aivo-muted">
            {t("pending_invitations")}
          </h2>
          <p className="mt-0.5 text-xs text-aivo-ink-soft">
            {pendingInvites.length === 0
              ? "No invitations are currently pending."
              : `${pendingInvites.length} invitation${pendingInvites.length === 1 ? "" : "s"} awaiting acceptance.`}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm">
          <UserPlus className="mr-1.5 h-4 w-4" /> {t("invite_staff_btn")}
        </Button>
      </div>

      {pendingInvites.length > 0 ? (
        <ul className="divide-y divide-aivo-border">
          {pendingInvites.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <div>
                <span className="font-medium">{i.displayName}</span>{" "}
                <span className="text-aivo-ink-soft">— {i.email}</span>{" "}
                <span className="text-xs text-aivo-muted">
                  ({roleLabel(i.role)})
                </span>
              </div>
              <RevokeButton inviteId={i.id} />
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-md p-6">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-lg font-bold">{t("invite_staff_member")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-aivo-surface-2"
                aria-label={t("close_aria")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {state.status === "success" ? (
              <SuccessPanel state={state} onClose={() => setOpen(false)} />
            ) : state.status === "invited" ? (
              <InvitedPanel
                email={state.email}
                displayName={state.displayName}
                onClose={() => setOpen(false)}
              />
            ) : (
              <form ref={formRef} action={formAction} className="space-y-3">
                <label className="block">
                  <span className="text-xs font-medium">{t("field_display_name")}</span>
                  <Input name="displayName" required minLength={2} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">Email</span>
                  <Input name="email" type="email" required />
                </label>
                <label className="block">
                  <span className="text-xs font-medium">Role</span>
                  <select
                    name="role"
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as "district_admin" | "school_admin" | "teacher")
                    }
                    className="mt-1 block w-full rounded-md border border-aivo-border bg-aivo-surface px-3 py-2 text-sm"
                  >
                    <option value="teacher">{t("role_teacher")}</option>
                    <option value="school_admin">{t("role_school_admin")}</option>
                    <option value="district_admin">{t("role_district_admin")}</option>
                  </select>
                </label>
                {role !== "district_admin" ? (
                  <label className="block">
                    <span className="text-xs font-medium">{t("assign_to_school")}</span>
                    <select
                      name="schoolId"
                      required
                      className="mt-1 block w-full rounded-md border border-aivo-border bg-aivo-surface px-3 py-2 text-sm"
                    >
                      <option value="">{t("pick_school")}</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {state.status === "error" ? (
                  <p
                    role="alert"
                    className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700"
                  >
                    {state.error}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> {t("sending")}
                      </span>
                    ) : (
                      "Send invitation"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      ) : null}
    </Card>
  );
}

function SuccessPanel({
  state,
  onClose,
}: {
  state: { status: "success"; email: string; temporaryPassword: string; displayName: string };
  onClose: () => void;
}) {
  const t = useTranslations("admin.district_staff");
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm">
        {t("invited_success", { name: state.displayName })} ({state.email}).
      </div>
      <div className="rounded-lg border border-aivo-border bg-aivo-surface-2 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-aivo-muted">
          {t("temporary_password")}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 rounded bg-aivo-surface px-2 py-1 font-mono text-sm">
            {state.temporaryPassword}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(state.temporaryPassword);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <CopyIcon className="mr-1 h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-aivo-ink-soft">
          Share this with the new staff member out-of-band. They&apos;ll be
          prompted to change it on first sign-in.
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function InvitedPanel({
  email,
  displayName,
  onClose,
}: {
  email: string;
  displayName: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm">
        <p className="font-medium text-aivo-ink">
          Invitation emailed to {displayName} ({email}).
        </p>
        <p className="mt-1 text-aivo-ink-soft">
          They&apos;ll follow the link to set their own password, then appear in your staff list
          once they accept. The link expires in 72 hours — you can resend or revoke it below.
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function RevokeButton({ inviteId }: { inviteId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd) => startTransition(() => revokeStaffInviteAction(fd))}
    >
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={pending}
      >
        {pending ? "Revoking…" : "Revoke"}
      </Button>
    </form>
  );
}

function roleLabel(r: "district_admin" | "school_admin" | "teacher"): string {
  if (r === "district_admin") return "District admin";
  if (r === "school_admin") return "School admin";
  return "Teacher";
}
