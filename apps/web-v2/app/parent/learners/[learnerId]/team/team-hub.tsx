"use client";

/**
 * Sprint C-08 — the team orchestration hub.
 *
 * One surface where a parent sees exactly where each invited teammate stands
 * (invited → on the team → contributed, with dates), nudges with one tap, and
 * removes with a confirm step. Built on top of the C-07 "Contributed" state
 * and the C-03 humanized status labels (reused, not duplicated).
 *
 * Every state is designed: loading is handled by the server render (the hub is
 * server-fed), empty sells the why, each member card shows its stage, Remind
 * surfaces rate-limit/Retry-After kindly, Remove confirms before acting.
 * WCAG AA: status is conveyed by text + badge (never color alone); the confirm
 * uses a real disclosure; all transitions respect reduced-motion (no
 * animations are used — state changes are instantaneous).
 */
import * as React from "react";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, HeartHandshake, Brain, Bell, Check, Clock, UserCheck } from "lucide-react";
import {
  remindTeamMemberAction,
  revokeTeamMemberAction,
  type RemindState,
} from "@/app/parent/learners/[learnerId]/team/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { TeamRole } from "@/lib/db/team-invites";
import type { MemberContributionStatus } from "@/lib/collaboration/contribution-status";

type Props = {
  learnerId: string;
  learnerName: string;
  members: MemberContributionStatus[];
};

const ROLE_META: Record<
  TeamRole,
  { labelKey: string; icon: React.ReactNode; accent: string }
> = {
  teacher: {
    labelKey: "role_teacher",
    icon: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
    accent: "bg-sky-50 text-sky-700 border-sky-200",
  },
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

/** Locale-stable short date ("Jun 2, 2026"). Returns null for missing input. */
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function TeamHub({ learnerId, learnerName, members }: Props) {
  const t = useTranslations("parent.team_hub");

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<UserCheck className="h-8 w-8" aria-hidden="true" />}
        title={t("empty_title")}
        description={t("empty_body", { name: learnerName })}
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {members.map((m) => (
        <li key={m.id}>
          <MemberCard learnerId={learnerId} member={m} />
        </li>
      ))}
    </ul>
  );
}

function MemberCard({
  learnerId,
  member,
}: {
  learnerId: string;
  member: MemberContributionStatus;
}) {
  const t = useTranslations("parent.team_hub");
  const meta = ROLE_META[member.kind];

  // Stage: contributed > accepted > invited. Each is human language + a dated
  // line, never a raw enum (C-03).
  const acceptedOn = fmtDate(member.acceptedAt);
  const contributedOn = fmtDate(member.lastContributionAt);

  let stageBadge: React.ReactNode;
  let stageLine: string;
  if (member.contributed) {
    stageBadge = (
      <Badge tone="success">
        <Check className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
        {t("stage_contributed")}
      </Badge>
    );
    stageLine = contributedOn
      ? t("stage_contributed_on", { date: contributedOn })
      : t("stage_contributed_line");
  } else if (member.status === "ACCEPTED") {
    stageBadge = (
      <Badge tone="primary">
        <UserCheck className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
        {t("stage_accepted")}
      </Badge>
    );
    stageLine = acceptedOn
      ? t("stage_accepted_on", { date: acceptedOn })
      : t("stage_accepted_line");
  } else if (member.status === "DECLINED") {
    stageBadge = <Badge tone="warning">{t("stage_declined")}</Badge>;
    stageLine = t("stage_declined_line");
  } else {
    stageBadge = (
      <Badge tone="neutral">
        <Clock className="mr-0.5 inline h-3 w-3" aria-hidden="true" />
        {t("stage_invited")}
      </Badge>
    );
    stageLine = t("stage_invited_line");
  }

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.accent}`}
        >
          {meta.icon} {t(meta.labelKey)}
        </span>
        {stageBadge}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-aivo-ink">
          {member.displayName || member.email}
        </p>
        {member.displayName ? (
          <p className="truncate text-xs text-aivo-ink-soft">{member.email}</p>
        ) : null}
        <p className="mt-1 text-xs text-aivo-ink-soft">{stageLine}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        {/* Remind: only meaningful while they haven't joined. */}
        {member.status !== "ACCEPTED" && member.status !== "REVOKED" ? (
          <RemindButton learnerId={learnerId} member={member} />
        ) : null}
        <RemoveButton learnerId={learnerId} member={member} />
      </div>
    </Card>
  );
}

function RemindButton({
  learnerId,
  member,
}: {
  learnerId: string;
  member: MemberContributionStatus;
}) {
  const t = useTranslations("parent.team_hub");
  const [state, formAction, pending] = useActionState<RemindState, FormData>(
    remindTeamMemberAction,
    { status: "idle" },
  );

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="learnerId" value={learnerId} />
        <input type="hidden" name="role" value={member.kind} />
        <input type="hidden" name="inviteId" value={member.id} />
        <input type="hidden" name="email" value={member.email} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending || state.status === "sent"}
        >
          <Bell className="mr-1 h-4 w-4" aria-hidden="true" />
          {state.status === "sent"
            ? t("remind_sent")
            : pending
              ? t("remind_sending")
              : t("remind")}
        </Button>
      </form>
      {/* Kind, specific feedback — never a bare failure. */}
      {state.status === "sent" ? (
        <p className="text-xs font-medium text-emerald-700" role="status">
          {t("remind_sent_detail")}
        </p>
      ) : null}
      {state.status === "rate_limited" ? (
        <p className="text-xs text-aivo-ink-soft" role="status">
          {t("remind_rate_limited", { minutes: Math.ceil(state.retryAfterSeconds / 60) })}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-xs text-rose-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function RemoveButton({
  learnerId,
  member,
}: {
  learnerId: string;
  member: MemberContributionStatus;
}) {
  const t = useTranslations("parent.team_hub");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-rose-700"
        onClick={() => setConfirming(true)}
      >
        {t("remove")}
      </Button>
    );
  }

  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-rose-200 bg-rose-50 p-2"
      role="group"
      aria-label={t("remove_confirm_title")}
    >
      <p className="text-xs font-medium text-aivo-ink">{t("remove_confirm_title")}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          {t("remove_cancel")}
        </Button>
        <form
          action={(formData) => {
            formData.set("learnerId", learnerId);
            formData.set("role", member.kind);
            formData.set("inviteId", member.id);
            startTransition(() => revokeTeamMemberAction(formData));
          }}
        >
          <Button type="submit" size="sm" className="bg-rose-600 text-white" disabled={pending}>
            {pending ? t("remove_removing") : t("remove_confirm")}
          </Button>
        </form>
      </div>
    </div>
  );
}
