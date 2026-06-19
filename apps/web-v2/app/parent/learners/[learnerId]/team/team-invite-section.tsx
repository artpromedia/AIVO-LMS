"use client";

/**
 * TeamHub invite card (TeamHub.dc.html). One card: pick a role from three
 * selectable tiles, add an email, send a warm invitation. Optional per-role
 * fields (caregiver relationship, therapist specialty/credentials) reveal
 * inline when that role is chosen — keeping the richer existing data while
 * matching the handoff's single-card flow. The pending-invite list below
 * shows humanized statuses (never raw enums, C-03) and is unchanged.
 */
import * as React from "react";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, HeartHandshake, Brain, Send, Check } from "lucide-react";
import {
  inviteTeamMemberAction,
  revokeTeamMemberAction,
  type InviteFormState,
} from "@/app/parent/learners/[learnerId]/team/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InviteStatus, LearnerCareTeam, TeamRole } from "@/lib/db/team-invites";

type Props = {
  learnerId: string;
  careTeam: LearnerCareTeam;
};

/** i18n keys (under `parent.learner_team`) for invite statuses — parents see
 *  plain language ("Invited — waiting to join"), never raw enums (C-03). */
const STATUS_LABEL_KEY: Record<InviteStatus, string> = {
  PENDING: "status_pending",
  ACCEPTED: "status_accepted",
  DECLINED: "status_declined",
  REVOKED: "status_revoked",
};

const ROLE_META: Record<
  TeamRole,
  { label: string; desc: string; icon: React.ReactNode; accent: string }
> = {
  teacher: {
    label: "Teacher",
    desc: "Classroom + assignments",
    icon: <GraduationCap className="h-4 w-4" />,
    accent: "bg-iw-accent-soft text-iw-teal-700 border-iw-accent",
  },
  caregiver: {
    label: "Caregiver",
    desc: "Family member or aide",
    icon: <HeartHandshake className="h-4 w-4" />,
    accent: "bg-iw-success-subtle text-iw-success-strong border-iw-success",
  },
  therapist: {
    label: "Therapist",
    desc: "Speech, OT, counseling",
    icon: <Brain className="h-4 w-4" />,
    accent: "bg-iw-purple-100 text-iw-primary border-iw-purple-200",
  },
};

const initialState: InviteFormState = { ok: false, error: null };

export function TeamInviteSection({ learnerId, careTeam }: Props) {
  const t = useTranslations("parent.learner_team");
  const [role, setRole] = useState<TeamRole>("teacher");
  const [state, formAction, pending] = useActionState(inviteTeamMemberAction, initialState);
  const [revokePending, startRevoke] = useTransition();

  const seat = careTeam.seats[role];
  const full = seat.used >= seat.max;

  return (
    <div className="space-y-4">
      <Card className="p-5 md:p-6">
        <h3 className="font-iw-display text-base font-bold text-iw-text-strong">
          {t("invite_member")}
        </h3>
        <p className="mt-0.5 text-sm text-iw-text-muted">{t("invite_blurb")}</p>

        <p className="mb-2.5 mt-4 text-[13px] font-bold text-iw-text-strong">{t("their_role")}</p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {(Object.keys(ROLE_META) as TeamRole[]).map((r) => {
            const meta = ROLE_META[r];
            const sel = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={sel}
                className={cn(
                  "flex items-center gap-2.5 rounded-[14px] border-[1.5px] p-3 text-left transition-colors",
                  sel
                    ? "border-[var(--aivo-sensory-primary)] bg-iw-primary-soft"
                    : "border-iw-border bg-white hover:bg-[var(--aivo-color-surface-sunken)]",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border",
                    meta.accent,
                  )}
                  aria-hidden="true"
                >
                  {meta.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold text-iw-text-strong">
                    {meta.label}
                  </span>
                  <span className="block text-[11.5px] text-iw-text-muted">{meta.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="learnerId" value={learnerId} />
          <input type="hidden" name="role" value={role} />
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="min-w-[240px] flex-1">
              <label
                htmlFor="invite-email"
                className="mb-1.5 block text-[13px] font-bold text-iw-text-strong"
              >
                {t("email_address")}
              </label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="teammate@email.com"
              />
            </div>
            <Button type="submit" disabled={pending || full}>
              <Send className="mr-1 h-4 w-4" aria-hidden="true" />
              {full ? t("seats_full") : pending ? t("sending") : t("send_invite")}
            </Button>
          </div>

          {/* Optional per-role detail — kept from the richer existing flow. */}
          {role === "caregiver" ? (
            <div>
              <label
                htmlFor="invite-relationship"
                className="mb-1 block text-xs font-medium text-iw-text-muted"
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
          {role === "therapist" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="invite-specialty"
                  className="mb-1 block text-xs font-medium text-iw-text-muted"
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
                  className="mb-1 block text-xs font-medium text-iw-text-muted"
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
            </div>
          ) : null}

          <p className="text-xs text-iw-text-muted">
            {seat.used}/{seat.max} {ROLE_META[role].label.toLowerCase()} seats used
          </p>

          {state.error ? (
            <p
              role="alert"
              className="rounded-md bg-iw-error-subtle px-2 py-1 text-xs font-medium text-iw-error-strong"
            >
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p
              role="status"
              className="inline-flex items-center gap-1.5 rounded-[11px] bg-iw-success-subtle px-3 py-2 text-[13px] font-semibold text-iw-success-strong"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {t("invite_sent")}
            </p>
          ) : null}
        </form>
      </Card>

      <PendingInviteList
        learnerId={learnerId}
        careTeam={careTeam}
        onRevoke={(formData) => startRevoke(() => revokeTeamMemberAction(formData))}
        revoking={revokePending}
      />
    </div>
  );
}

function PendingInviteList({
  learnerId,
  careTeam,
  onRevoke,
  revoking,
}: {
  learnerId: string;
  careTeam: LearnerCareTeam;
  onRevoke: (formData: FormData) => void;
  revoking: boolean;
}) {
  const t = useTranslations("parent.learner_team");
  const rows = (
    [
      ["teacher", careTeam.teachers],
      ["caregiver", careTeam.caregivers],
      ["therapist", careTeam.therapists],
    ] as [TeamRole, typeof careTeam.teachers][]
  ).flatMap(([role, list]) => list.map((r) => ({ role, record: r })));
  if (rows.length === 0) return null;
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold">{t("care_team_invites")}</h3>
      <ul className="divide-y divide-iw-border">
        {rows.map(({ role, record }) => {
          const meta = ROLE_META[role];
          return (
            <li key={record.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{record.email}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-iw-ink-muted">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.accent}`}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <Badge tone={record.status === "ACCEPTED" ? "success" : "neutral"}>
                    {t(STATUS_LABEL_KEY[record.status])}
                  </Badge>
                  {record.relationship ? <span>· {record.relationship}</span> : null}
                  {record.specialty ? <span>· {record.specialty}</span> : null}
                  {record.credentials ? <span>· {record.credentials}</span> : null}
                </p>
              </div>
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
                  className="text-iw-error-strong"
                >
                  {t("revoke")}
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
