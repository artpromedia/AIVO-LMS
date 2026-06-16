// @vitest-environment jsdom

/**
 * Teacher team-builder UI guarantees:
 *  - statuses are humanized (i18n key-echo here), never the raw enum (C-03);
 *  - only invites THIS teacher sent (invitedBy === viewerId) are listed with a
 *    Withdraw control — a parent's invite is never withdrawable by a teacher;
 *  - the single teacher seat is not invitable (no Teacher invite card).
 */
import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));

vi.mock("@/app/teacher/learners/[learnerId]/team/actions", () => ({
  inviteTeamMemberAction: vi.fn(),
  revokeTeamMemberAction: vi.fn(),
}));

import { TeamInviteSection } from "./team-invite-section";
import type { LearnerCareTeam, TeamMemberRecord } from "@/lib/db/team-invites";

const VIEWER = "usr-teacher";

function member(overrides: Partial<TeamMemberRecord>): TeamMemberRecord {
  return {
    id: "inv-1",
    tenantId: "t-1",
    learnerId: "lrn-1",
    email: "person@example.com",
    memberUserId: null,
    invitedBy: VIEWER,
    invitedAt: "2026-06-01T00:00:00.000Z",
    acceptedAt: null,
    status: "PENDING",
    relationship: null,
    specialty: null,
    credentials: null,
    ...overrides,
  };
}

const CARE_TEAM: LearnerCareTeam = {
  teachers: [member({ id: "inv-t", email: "teacher@example.com", status: "ACCEPTED" })],
  caregivers: [
    // Sent by this teacher → withdrawable.
    member({ id: "inv-mine", email: "grandma@example.com", status: "PENDING", invitedBy: VIEWER }),
    // Sent by the parent → must NOT be withdrawable by the teacher.
    member({ id: "inv-parent", email: "aunt@example.com", status: "PENDING", invitedBy: "usr-parent" }),
  ],
  therapists: [],
  seats: {
    teacher: { used: 1, max: 1 },
    caregiver: { used: 2, max: 2 },
    therapist: { used: 0, max: 1 },
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Teacher TeamInviteSection", () => {
  it("humanizes invite status, never the raw enum", () => {
    render(<TeamInviteSection learnerId="lrn-1" careTeam={CARE_TEAM} viewerId={VIEWER} />);
    expect(screen.getByText("status_pending")).toBeTruthy();
    expect(screen.queryByText("PENDING")).toBeNull();
  });

  it("lists only invites this teacher sent (own-only Withdraw)", () => {
    render(<TeamInviteSection learnerId="lrn-1" careTeam={CARE_TEAM} viewerId={VIEWER} />);
    // The teacher's own invite is shown…
    expect(screen.getByText("grandma@example.com")).toBeTruthy();
    // …the parent's invite is not surfaced on the teacher's sent list.
    expect(screen.queryByText("aunt@example.com")).toBeNull();
  });

  it("does not offer a Teacher invite card (single teacher seat is parent-owned)", () => {
    render(<TeamInviteSection learnerId="lrn-1" careTeam={CARE_TEAM} viewerId={VIEWER} />);
    expect(screen.queryByText("role_teacher")).toBeNull();
    expect(screen.getAllByText("role_caregiver").length).toBeGreaterThan(0);
    expect(screen.getAllByText("role_therapist").length).toBeGreaterThan(0);
  });
});
