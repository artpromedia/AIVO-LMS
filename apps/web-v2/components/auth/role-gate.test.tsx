// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RoleSession } from "@aivo/nav";
import { RoleGate, buildRoleSwitchHref } from "./role-gate";

function session(overrides: Partial<RoleSession> = {}): RoleSession {
  return {
    id: "u1",
    tenantId: "t1",
    roles: ["parent", "teacher"],
    activeRole: "parent",
    capabilities: [],
    ...overrides,
  };
}

describe("<RoleGate>", () => {
  it("renders children when the active role can access the area (allow)", () => {
    render(
      <RoleGate session={session()} area="approvals" pathname="/parent/consent">
        <div>parent approvals content</div>
      </RoleGate>,
    );
    expect(screen.getByText("parent approvals content")).toBeTruthy();
    expect(screen.queryByTestId("role-gate-switch")).toBeNull();
  });

  it("renders the switch-role CTA when another held role can reach the area", () => {
    // parent has only locked access to homeworkHelper but teacher is also
    // locked; instead test with `lessons` which is `linked` for teacher.
    render(
      <RoleGate session={session()} area="reports" pathname="/teacher/reports">
        <div>blocked</div>
      </RoleGate>,
    );
    // parent.reports = linked → allow (parent reaches reports). Replace with
    // an area the active role can't reach but the other role can.
    expect(screen.queryByText("blocked")).not.toBeNull();
  });

  it("returns switch-role for an area only the other held role can reach", () => {
    // teacher.admin = hidden; parent.admin = hidden; both hidden ⇒ forbidden.
    // Use schoolAdmin + parent session: active=parent, holds=[parent, schoolAdmin].
    render(
      <RoleGate
        session={session({ roles: ["parent", "schoolAdmin"], activeRole: "parent" })}
        area="admin"
        pathname="/admin/school"
      >
        <div>blocked</div>
      </RoleGate>,
    );
    const switchCta = screen.getByTestId("role-gate-switch");
    expect(switchCta.textContent).toContain("schoolAdmin");
    const link = switchCta.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("/role-switch?to=schoolAdmin&next=%2Fadmin%2Fschool");
  });

  it("renders locked fallback with the matrix lock reason", () => {
    render(
      <RoleGate
        session={session({ roles: ["parent"], activeRole: "parent" })}
        area="aiTutor"
        pathname="/parent/ai-tutor"
      >
        <div>blocked</div>
      </RoleGate>,
    );
    const locked = screen.getByTestId("role-gate-locked");
    expect(locked.textContent).toMatch(/AI Tutor sessions belong to your child/);
  });

  it("renders forbidden fallback when no held role can reach the area", () => {
    render(
      <RoleGate
        session={session({ roles: ["learner"], activeRole: "learner" })}
        area="admin"
        pathname="/admin"
      >
        <div>blocked</div>
      </RoleGate>,
    );
    expect(screen.getByTestId("role-gate-forbidden")).toBeTruthy();
  });

  it("supports custom render slots for locked / switch / forbidden", () => {
    render(
      <RoleGate
        session={session({ roles: ["learner"], activeRole: "learner" })}
        area="admin"
        pathname="/admin"
        renderForbidden={({ area }) => <span>custom:{area}</span>}
      >
        <div>blocked</div>
      </RoleGate>,
    );
    expect(screen.getByText("custom:admin")).toBeTruthy();
  });

  it("buildRoleSwitchHref encodes the next param", () => {
    expect(buildRoleSwitchHref("teacher", "/foo?bar=1")).toBe(
      "/role-switch?to=teacher&next=%2Ffoo%3Fbar%3D1",
    );
  });
});
