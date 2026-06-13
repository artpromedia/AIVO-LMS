// @vitest-environment jsdom

/**
 * Sprint C-08 — team hub rendering states.
 *
 * Substitutes the Playwright runtime walk (browsers not installed in CI's
 * sprint sandbox): asserts every per-member stage renders the human status
 * line + badge (never a raw enum), the empty state sells the why, and the
 * affordances appear only where they make sense (Remind hidden once joined;
 * Remove always present). i18n is key-echoed so we assert structure, not copy.
 */
import * as React from "react";
import { render, screen, cleanup, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stableT = (key: string, _vars?: Record<string, unknown>) => key;
vi.mock("next-intl", () => ({ useTranslations: (_ns?: string) => stableT }));

vi.mock("@/app/parent/learners/[learnerId]/team/actions", () => ({
  remindTeamMemberAction: vi.fn(),
  revokeTeamMemberAction: vi.fn(),
}));

import { TeamHub } from "./team-hub";
import type { MemberContributionStatus } from "@/lib/collaboration/contribution-status";

function status(over: Partial<MemberContributionStatus>): MemberContributionStatus {
  return {
    id: "m1",
    kind: "teacher",
    displayName: null,
    email: "person@example.com",
    status: "PENDING",
    acceptedAt: null,
    contributed: false,
    lastContributionAt: null,
    resendable: true,
    acknowledgedAt: null,
    ...over,
  };
}

afterEach(cleanup);

describe("TeamHub", () => {
  it("renders the empty state that sells the why when nobody is invited", () => {
    render(<TeamHub learnerId="l1" learnerName="Sky" members={[]} />);
    expect(screen.getByText("empty_title")).toBeTruthy();
    expect(screen.getByText("empty_body")).toBeTruthy();
  });

  it("shows the invited stage with a remind button and no contributed badge", () => {
    render(
      <TeamHub
        learnerId="l1"
        learnerName="Sky"
        members={[status({ id: "inv", status: "PENDING", email: "t@x.com" })]}
      />,
    );
    expect(screen.getByText("stage_invited")).toBeTruthy();
    expect(screen.getByText("stage_invited_line")).toBeTruthy();
    // Remind is offered for a not-yet-joined member.
    expect(screen.getByText("remind")).toBeTruthy();
    // Remove is always available.
    expect(screen.getByText("remove")).toBeTruthy();
    expect(screen.queryByText("stage_contributed")).toBeNull();
  });

  it("shows the accepted stage with a dated line and no remind button", () => {
    render(
      <TeamHub
        learnerId="l1"
        learnerName="Sky"
        members={[
          status({
            id: "acc",
            status: "ACCEPTED",
            acceptedAt: "2026-06-02T00:00:00.000Z",
            contributed: false,
          }),
        ]}
      />,
    );
    expect(screen.getByText("stage_accepted")).toBeTruthy();
    // Accepted members are on the team — no "Remind" affordance.
    expect(screen.queryByText("remind")).toBeNull();
    // Dated line key is used (acceptedAt present).
    expect(screen.getByText("stage_accepted_on")).toBeTruthy();
  });

  it("shows the contributed stage with the success badge", () => {
    render(
      <TeamHub
        learnerId="l1"
        learnerName="Sky"
        members={[
          status({
            id: "con",
            status: "ACCEPTED",
            acceptedAt: "2026-06-02T00:00:00.000Z",
            contributed: true,
            lastContributionAt: "2026-06-10T00:00:00.000Z",
          }),
        ]}
      />,
    );
    expect(screen.getByText("stage_contributed")).toBeTruthy();
    expect(screen.getByText("stage_contributed_on")).toBeTruthy();
  });

  it("renders one card per member with the role label, never a raw enum", () => {
    render(
      <TeamHub
        learnerId="l1"
        learnerName="Sky"
        members={[
          status({ id: "a", kind: "teacher", status: "PENDING" }),
          status({ id: "b", kind: "caregiver", status: "ACCEPTED", acceptedAt: "2026-06-02T00:00:00.000Z" }),
          status({ id: "c", kind: "therapist", status: "DECLINED", resendable: true }),
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("role_teacher")).toBeTruthy();
    expect(screen.getByText("role_caregiver")).toBeTruthy();
    expect(screen.getByText("role_therapist")).toBeTruthy();
    // No raw status enums leak to the parent.
    expect(screen.queryByText("PENDING")).toBeNull();
    expect(screen.queryByText("ACCEPTED")).toBeNull();
    expect(screen.queryByText("DECLINED")).toBeNull();
  });

  it("prefers the display name over the email when present", () => {
    render(
      <TeamHub
        learnerId="l1"
        learnerName="Sky"
        members={[status({ id: "d", displayName: "Ms. Rivera", email: "rivera@x.com" })]}
      />,
    );
    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Ms. Rivera")).toBeTruthy();
    expect(within(item).getByText("rivera@x.com")).toBeTruthy();
  });
});
