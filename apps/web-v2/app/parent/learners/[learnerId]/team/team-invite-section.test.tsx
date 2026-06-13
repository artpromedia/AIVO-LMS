// @vitest-environment jsdom

/**
 * Sprint C-03 — no raw `PENDING`/`ACCEPTED` enum strings rendered to parents.
 * The invite list badge must show the humanized i18n label (key-echoing mock
 * here), never the enum constant from the persistence layer.
 */
import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({
  useTranslations: (_ns?: string) => stableT,
}));

// Server actions are exercised by their own integration paths; this test
// only cares about what the parent sees.
vi.mock("@/app/parent/learners/[learnerId]/team/actions", () => ({
  inviteTeamMemberAction: vi.fn(),
  revokeTeamMemberAction: vi.fn(),
}));

import { TeamInviteSection } from "./team-invite-section";
import type { LearnerCareTeam, TeamMemberRecord } from "@/lib/db/team-invites";

function member(overrides: Partial<TeamMemberRecord>): TeamMemberRecord {
  return {
    id: "inv-1",
    tenantId: "t-1",
    learnerId: "lrn-1",
    email: "person@example.com",
    memberUserId: null,
    invitedBy: "usr-parent",
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
  teachers: [member({ id: "inv-t", email: "teacher@example.com", status: "PENDING" })],
  caregivers: [
    member({
      id: "inv-c",
      email: "grandma@example.com",
      status: "ACCEPTED",
      acceptedAt: "2026-06-02T00:00:00.000Z",
    }),
  ],
  therapists: [],
  seats: {
    teacher: { used: 1, max: 1 },
    caregiver: { used: 1, max: 2 },
    therapist: { used: 0, max: 1 },
  },
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TeamInviteSection invite statuses", () => {
  it("renders humanized status labels, never the raw enum", () => {
    render(<TeamInviteSection learnerId="lrn-1" careTeam={CARE_TEAM} />);
    expect(screen.getByText("status_pending")).toBeTruthy();
    expect(screen.getByText("status_accepted")).toBeTruthy();
    expect(screen.queryByText("PENDING")).toBeNull();
    expect(screen.queryByText("ACCEPTED")).toBeNull();
  });
});
