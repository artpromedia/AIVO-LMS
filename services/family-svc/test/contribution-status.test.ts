/**
 * Sprint C-08 — per-role contribution-status derivation (pure, no DB).
 *
 * Pins the rule the team hub + voices chip depend on: who counts as having
 * "contributed", per kind, and how a member's status/resendable/last-date roll
 * up. The route's DB integration + authz live in collaboration.test.ts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveContributionStatus,
  summariseVoices,
  type MemberInput,
  type ContributionSignal,
} from "../src/lib/contribution-status.js";

const T0 = new Date("2026-06-01T00:00:00.000Z");
const T1 = new Date("2026-06-10T12:00:00.000Z");

function teacher(over: Partial<MemberInput> = {}): MemberInput {
  return {
    id: "t1",
    kind: "teacher",
    email: "teacher@x.com",
    displayName: "Ms. Rivera",
    status: "ACCEPTED",
    acceptedAt: T0,
    memberUserId: "u-teacher",
    ...over,
  };
}

test("teacher with a completed assessment authored by them is contributed", () => {
  const members = [teacher()];
  const signals: ContributionSignal[] = [
    { kind: "teacher", contributorUserId: "u-teacher", at: T1 },
  ];
  const [s] = deriveContributionStatus(members, signals);
  assert.equal(s.contributed, true);
  assert.equal(s.lastContributionAt, T1.toISOString());
  assert.equal(s.acceptedAt, T0.toISOString());
  assert.equal(s.resendable, false); // accepted ⇒ not resendable
});

test("teacher with NO completed assessment is not contributed", () => {
  const [s] = deriveContributionStatus([teacher()], []);
  assert.equal(s.contributed, false);
  assert.equal(s.lastContributionAt, null);
});

test("unattributed completed teacher assessment credits the single teacher seat", () => {
  // submittedBy null (legacy row) ⇒ credited to the one accepted teacher.
  const signals: ContributionSignal[] = [{ kind: "teacher", contributorUserId: null, at: T1 }];
  const [s] = deriveContributionStatus([teacher()], signals);
  assert.equal(s.contributed, true);
});

test("therapist mirrors teacher (single-seat, attributed or legacy)", () => {
  const m: MemberInput = {
    id: "th1",
    kind: "therapist",
    email: "ot@x.com",
    displayName: null,
    status: "ACCEPTED",
    acceptedAt: T0,
    memberUserId: "u-ot",
  };
  const attributed = deriveContributionStatus(
    [m],
    [{ kind: "therapist", contributorUserId: "u-ot", at: T1 }],
  );
  assert.equal(attributed[0].contributed, true);
  const legacy = deriveContributionStatus(
    [m],
    [{ kind: "therapist", contributorUserId: null, at: T1 }],
  );
  assert.equal(legacy[0].contributed, true);
});

test("caregiver requires an AUTHORED observation — legacy/unattributed never credits", () => {
  const cg: MemberInput = {
    id: "cg1",
    kind: "caregiver",
    email: "grandma@x.com",
    displayName: null,
    status: "ACCEPTED",
    acceptedAt: T0,
    memberUserId: "u-grandma",
  };
  // Unattributed observation must NOT credit a caregiver (2 seats — ambiguous).
  const unattributed = deriveContributionStatus(
    [cg],
    [{ kind: "caregiver", contributorUserId: null, at: T1 }],
  );
  assert.equal(unattributed[0].contributed, false);
  // An observation authored by this caregiver does credit them.
  const authored = deriveContributionStatus(
    [cg],
    [{ kind: "caregiver", contributorUserId: "u-grandma", at: T1 }],
  );
  assert.equal(authored[0].contributed, true);
});

test("two caregivers: a note from one does not credit the other", () => {
  const a: MemberInput = {
    id: "cgA",
    kind: "caregiver",
    email: "a@x.com",
    displayName: null,
    status: "ACCEPTED",
    acceptedAt: T0,
    memberUserId: "u-a",
  };
  const b: MemberInput = { ...a, id: "cgB", email: "b@x.com", memberUserId: "u-b" };
  const out = deriveContributionStatus(
    [a, b],
    [{ kind: "caregiver", contributorUserId: "u-a", at: T1 }],
  );
  assert.equal(out.find((s) => s.id === "cgA")!.contributed, true);
  assert.equal(out.find((s) => s.id === "cgB")!.contributed, false);
});

test("pending member is resendable; the most recent contribution date wins", () => {
  const pending = teacher({ id: "tp", status: "PENDING", acceptedAt: null });
  const [s] = deriveContributionStatus([pending], []);
  assert.equal(s.resendable, true);
  assert.equal(s.acceptedAt, null);

  const earlier = new Date("2026-06-05T00:00:00.000Z");
  const [s2] = deriveContributionStatus(
    [teacher()],
    [
      { kind: "teacher", contributorUserId: "u-teacher", at: earlier },
      { kind: "teacher", contributorUserId: "u-teacher", at: T1 },
    ],
  );
  assert.equal(s2.lastContributionAt, T1.toISOString());
});

test("summariseVoices counts live (non-revoked) members and the contributed subset", () => {
  const members: MemberInput[] = [
    teacher({ id: "a", memberUserId: "ua" }),
    teacher({ id: "b", memberUserId: "ub", status: "PENDING", acceptedAt: null }),
    teacher({ id: "c", memberUserId: "uc", status: "REVOKED" }),
  ];
  const signals: ContributionSignal[] = [{ kind: "teacher", contributorUserId: "ua", at: T1 }];
  const statuses = deriveContributionStatus(members, signals);
  const v = summariseVoices(statuses);
  // a (contributed) + b (pending) are live; c is revoked and excluded.
  assert.equal(v.invited, 2);
  assert.equal(v.contributed, 1);
});
