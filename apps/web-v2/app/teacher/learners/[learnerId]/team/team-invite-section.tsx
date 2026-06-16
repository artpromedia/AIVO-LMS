"use client";

/**
 * Teacher team-building surface — the mirror of the parent care-team invite
 * panel, scoped to a teacher's authority. A teacher can invite the NON-teaching
 * adults who also know the learner (family caregivers and related-service
 * therapists) so their read shapes the child's learning profile alongside the
 * teacher's own classroom assessment.
 *
 * Differences from the parent panel (intentional):
 *   - Only caregiver + therapist are invitable (the teacher already holds the
 *     single teacher seat; that seat is parent-owned).
 *   - The "invites you've sent" list shows ONLY invites this teacher created
 *     (`invitedBy === viewerId`); a teacher can withdraw their own invite but
 *     never a parent's or another collaborator's. The server action re-checks
 *     authorship, so this is defense-in-depth, not the only guard.
 *
 * WCAG: status is text + badge (never color alone); the invite dialog is a real
 * labelled form; the close control is a labelled button.
 */
import * as React from "react";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { HeartHandshake, Brain, UserPlus, X } from "lucide-react";
import {
  inviteTeamMemberAction,
  revokeTeamMemberAction,
  type TeacherInviteFormState,
} from "@/app/teacher/learners/[learnerId]/team/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { InviteStatus, LearnerCareTeam } from "@/lib/db/team-invites";

type InvitableRole = "caregiver" | "therapist";

type Props = {
  learnerId: string;
  careTeam: LearnerCareTeam;
  /** The signed-in teacher's user id — used to show Withdraw only on the
   *  invites this teacher sent. */
  viewerId: string;
};

const STATUS_LABEL_KEY: Record<InviteStatus, string> = {
  PENDING: "status_pending",
  ACCEPTED: "status_accepted",
  DECLINED: "status_declined",
  REVOKED: "status_revoked",
};

const ROLE_META: Record<
  InvitableRole,
  { labelKey: string; icon: React.ReactNode; accent: string }
> = {
  caregiver: {
    labelKey: "role_caregiver",
    icon: <HeartHandshake className="h-4 w-4" aria-hidden="true" />,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  therapist: {
    labelKey: "role_therapist",
    icon: <Brain className="h-4 w-4" aria-hidden="true" />,
    accent: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const INVITABLE_ROLES: InvitableRole[] = ["caregiver", "therapist"];
const initialState: TeacherInviteFormState = { ok: false, error: null };

export function TeamInviteSection({ learnerId, careTeam, viewerId }: Props) {
  const t = useTranslations("teacher.learner_team");
  const [openRole, setOpenRole] = useState<InvitableRole | null>(null);
  const [state, formAction, pending] = useActionState(inviteTeamMemberAction, initialState);
  const [revokePending, startRevoke] = useTransition();

  // Close the dialog the moment the action resolves successfully.
  if (state.ok && openRole) {
    queueMicrotask(() => setOpenRole(null));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {INVITABLE_ROLES.map((role) => {
          const seat = careTeam.seats[role];
          const full = seat.used >= seat.max;
          const meta = ROLE_META[role];
          return (
            <Card key={role} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.accent}`}
                >
                  {meta.icon} {t(meta.labelKey)}
                </span>
                <span className="text-xs font-medium text-aivo-ink-soft">
                  {seat.used}/{seat.max}
                </span>
              </div>
              <Button
                type="button"
                variant={full ? "outline" : "default"}
                size="sm"
                disabled={full}
                onClick={() => setOpenRole(role)}
                className="w-full"
              >
                <UserPlus className="mr-1 h-4 w-4" aria-hidden="true" />
                {full ? t("seats_full") : t("invite_role", { role: t(meta.labelKey) })}
              </Button>
            </Card>
          );
        })}
      </div>

      {openRole ? (
        <Card className="relative p-4">
          <button
            type="button"
            onClick={() => setOpenRole(null)}
            aria-label={t("cancel_invite")}
            className="absolute right-3 top-3 text-aivo-ink-soft hover:text-aivo-ink"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="mb-3 text-sm font-semibold">
            {t("invite_dialog_title", { role: t(ROLE_META[openRole].labelKey) })}
          </h3>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="learnerId" value={learnerId} />
            <input type="hidden" name="role" value={openRole} />
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1 block text-xs font-medium text-aivo-ink"
              >
                {t("email_address")}
              </label>
              <Input id="invite-email" name="email" type="email" required autoFocus />
            </div>
            {openRole === "caregiver" ? (
              <div>
                <label
                  htmlFor="invite-relationship"
                  className="mb-1 block text-xs font-medium text-aivo-ink"
                >
                  {t("relationship_optional")}
                </label>
                <Input
                  id="invite-relationship"
                  name="relationship"
                  type="text"
                  placeholder={t("relationship_placeholder")}
                />
              </div>
            ) : null}
            {openRole === "therapist" ? (
              <>
                <div>
                  <label
                    htmlFor="invite-specialty"
                    className="mb-1 block text-xs font-medium text-aivo-ink"
                  >
                    {t("specialty_optional")}
                  </label>
                  <Input
                    id="invite-specialty"
                    name="specialty"
                    type="text"
                    placeholder={t("specialty_placeholder")}
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-credentials"
                    className="mb-1 block text-xs font-medium text-aivo-ink"
                  >
                    {t("credentials_optional")}
                  </label>
                  <Input
                    id="invite-credentials"
                    name="credentials"
                    type="text"
                    placeholder={t("credentials_placeholder")}
                  />
                </div>
              </>
            ) : null}
            {state.error ? (
              <p
                role="alert"
                className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700"
              >
                {state.error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? t("sending") : t("send_invite")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenRole(null)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <SentInviteList
        learnerId={learnerId}
        careTeam={careTeam}
        viewerId={viewerId}
        onRevoke={(formData) => startRevoke(() => revokeTeamMemberAction(formData))}
        revoking={revokePending}
      />
    </div>
  );
}

function SentInviteList({
  learnerId,
  careTeam,
  viewerId,
  onRevoke,
  revoking,
}: {
  learnerId: string;
  careTeam: LearnerCareTeam;
  viewerId: string;
  onRevoke: (formData: FormData) => void;
  revoking: boolean;
}) {
  const t = useTranslations("teacher.learner_team");
  const rows = (
    [
      ["caregiver", careTeam.caregivers],
      ["therapist", careTeam.therapists],
    ] as [InvitableRole, typeof careTeam.caregivers][]
  )
    .flatMap(([role, list]) => list.map((r) => ({ role, record: r })))
    // Only the invites THIS teacher sent — a teacher cannot withdraw a
    // parent's or another collaborator's invite.
    .filter(({ record }) => record.invitedBy === viewerId);

  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="mb-1 text-sm font-semibold">{t("sent_title")}</h3>
        <p className="text-xs text-aivo-ink-soft">{t("sent_empty")}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold">{t("sent_title")}</h3>
      <ul className="divide-y divide-aivo-border">
        {rows.map(({ role, record }) => {
          const meta = ROLE_META[role];
          const canWithdraw = record.status === "PENDING";
          return (
            <li key={record.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{record.email}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-aivo-ink-soft">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.accent}`}
                  >
                    {meta.icon} {t(meta.labelKey)}
                  </span>
                  <Badge tone={record.status === "ACCEPTED" ? "success" : "neutral"}>
                    {t(STATUS_LABEL_KEY[record.status])}
                  </Badge>
                  {record.relationship ? <span>· {record.relationship}</span> : null}
                  {record.specialty ? <span>· {record.specialty}</span> : null}
                  {record.credentials ? <span>· {record.credentials}</span> : null}
                </p>
              </div>
              {canWithdraw ? (
                <form
                  action={(formData) => {
                    formData.set("learnerId", learnerId);
                    formData.set("role", role);
                    formData.set("inviteId", record.id);
                    onRevoke(formData);
                  }}
                >
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={revoking}
                    className="text-rose-700"
                  >
                    {t("revoke")}
                  </Button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
