"use client";

import { useActionState, useState, useTransition } from "react";
import { GraduationCap, HeartHandshake, Brain, UserPlus, X } from "lucide-react";
import {
  inviteTeamMemberAction,
  revokeTeamMemberAction,
  type InviteFormState,
} from "@/app/parent/learners/[learnerId]/team/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { LearnerCareTeam, TeamRole } from "@/lib/db/team-invites";

type Props = {
  learnerId: string;
  careTeam: LearnerCareTeam;
};

const ROLE_META: Record<TeamRole, { label: string; icon: React.ReactNode; accent: string }> = {
  teacher: {
    label: "Teacher",
    icon: <GraduationCap className="h-4 w-4" />,
    accent: "bg-sky-50 text-sky-700 border-sky-200",
  },
  caregiver: {
    label: "Caregiver",
    icon: <HeartHandshake className="h-4 w-4" />,
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  therapist: {
    label: "Therapist",
    icon: <Brain className="h-4 w-4" />,
    accent: "bg-violet-50 text-violet-700 border-violet-200",
  },
};

const initialState: InviteFormState = { ok: false, error: null };

export function TeamInviteSection({ learnerId, careTeam }: Props) {
  const [openRole, setOpenRole] = useState<TeamRole | null>(null);
  const [state, formAction, pending] = useActionState(inviteTeamMemberAction, initialState);
  const [revokePending, startRevoke] = useTransition();

  // Close the dialog the moment the action resolves with ok=true.
  if (state.ok && openRole) {
    // Defer to next tick to let action finalise before closing.
    queueMicrotask(() => setOpenRole(null));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(ROLE_META) as TeamRole[]).map((role) => {
          const seat = careTeam.seats[role];
          const full = seat.used >= seat.max;
          const meta = ROLE_META[role];
          return (
            <Card key={role} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.accent}`}
                >
                  {meta.icon} {meta.label}
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
                <UserPlus className="mr-1 h-4 w-4" />
                {full ? "Seats full" : `Invite ${meta.label.toLowerCase()}`}
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
            aria-label="Cancel invite"
            className="absolute right-3 top-3 text-aivo-ink-soft hover:text-aivo-ink"
          >
            <X className="h-4 w-4" />
          </button>
          <h3 className="mb-3 text-sm font-semibold">
            Invite a {ROLE_META[openRole].label.toLowerCase()}
          </h3>
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="learnerId" value={learnerId} />
            <input type="hidden" name="role" value={openRole} />
            <div>
              <label
                htmlFor="invite-email"
                className="mb-1 block text-xs font-medium text-aivo-ink"
              >
                Email address
              </label>
              <Input id="invite-email" name="email" type="email" required autoFocus />
            </div>
            {openRole === "caregiver" ? (
              <div>
                <label
                  htmlFor="invite-relationship"
                  className="mb-1 block text-xs font-medium text-aivo-ink"
                >
                  Relationship (optional)
                </label>
                <Input
                  id="invite-relationship"
                  name="relationship"
                  type="text"
                  placeholder="e.g. Co-parent, Grandparent"
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
                    Specialty (optional)
                  </label>
                  <Input
                    id="invite-specialty"
                    name="specialty"
                    type="text"
                    placeholder="e.g. Speech-language"
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-credentials"
                    className="mb-1 block text-xs font-medium text-aivo-ink"
                  >
                    Credentials (optional)
                  </label>
                  <Input
                    id="invite-credentials"
                    name="credentials"
                    type="text"
                    placeholder="e.g. M.S., CCC-SLP"
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
                {pending ? "Sending…" : "Send invite"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpenRole(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

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
      <h3 className="mb-2 text-sm font-semibold">Care-team invites</h3>
      <ul className="divide-y divide-aivo-border">
        {rows.map(({ role, record }) => {
          const meta = ROLE_META[role];
          return (
            <li key={record.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{record.email}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-aivo-ink-soft">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.accent}`}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <Badge tone={record.status === "ACCEPTED" ? "success" : "neutral"}>
                    {record.status}
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
                  className="text-rose-700"
                >
                  Revoke
                </Button>
              </form>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
