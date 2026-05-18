/**
 * Unit tests for the IEP packet builder. These exercise the pure
 * `buildIepPacket` function — no database, no Fastify wiring — so they
 * run regardless of whether DATABASE_URL is set in the environment.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIepPacket, type IepPacketInput } from "../src/services/iep-packet.js";

const minimal: IepPacketInput = {
  learner: { id: "l-1", fullName: "Sara Smith" },
  profile: {},
  goals: [],
};

const full: IepPacketInput = {
  learner: {
    id: "l-2",
    fullName: "Alex Rivera",
    dateOfBirth: "2017-04-12",
    gradeBand: "K",
    studentId: "S-2233",
    schoolName: "Lincoln Elementary",
    caseManagerName: "Ms. Park",
    functioningLevel: "SUPPORTED",
  },
  profile: {
    presentLevels:
      "Alex reads at the kindergarten level and identifies sight words 1–25 with 90% accuracy.",
    accommodations: ["Extended time on tests", "Visual schedule"],
    modifications: ["Reduced item count"],
    assessmentAccommodations: ["Read-aloud directions"],
    services: [
      { service: "Speech therapy", frequency: "30 min/wk", provider: "Ms. Lopez" },
      { service: "OT", frequency: "20 min/wk" },
    ],
    participation: "80% of the day in general education.",
    effectiveAt: "2026-09-01T00:00:00Z",
    nextReviewAt: "2027-09-01T00:00:00Z",
  },
  goals: [
    {
      id: "g1",
      statement: "Alex will read 30 words per minute with 90% accuracy.",
      alignment: "ccss.ela.k.rf.4",
      domain: "academic",
      benchmarks: ["20 wpm by Q1", "25 wpm by Q2"],
      progressNote: "On track at 22 wpm.",
    },
    {
      id: "g2",
      statement: "Alex will request a break using a picture card 4 of 5 trials.",
      domain: "behavior",
    },
  ],
  attendance: [
    { date: "2026-09-05", status: "present" },
    { date: "2026-09-06", status: "absent", notes: "doctor" },
  ],
  meta: {
    districtName: "Sunnyvale USD",
    preparedBy: "AIVO Assessment Service",
    preparedAt: "2026-09-10T08:00:00Z",
  },
};

test("buildIepPacket → minimal input renders all 7 sections", () => {
  const out = buildIepPacket(minimal);
  assert.equal(out.sections, 7);
  for (const heading of [
    "Student Demographics",
    "Present Levels of Academic Achievement",
    "Annual Goals",
    "Special Education Services",
    "Participation in General Education",
    "Attendance and Progress",
    "Signatures",
  ]) {
    assert.match(out.markdown, new RegExp(heading), `missing section "${heading}"`);
  }
});

test("buildIepPacket → minimal input shows placeholders, not crashes", () => {
  const out = buildIepPacket(minimal);
  assert.match(out.markdown, /No goals on file\./);
  assert.match(out.markdown, /_None on file\._/);
  assert.match(out.markdown, /To be drafted by the IEP team\./);
});

test("buildIepPacket → full input includes goals, services, and attendance", () => {
  const out = buildIepPacket(full);
  assert.match(out.markdown, /Goal g1 \(academic\)/);
  assert.match(out.markdown, /Goal g2 \(behavior\)/);
  assert.match(out.markdown, /aligned to:.*ccss\.ela\.k\.rf\.4/i);
  assert.match(out.markdown, /Speech therapy — 30 min\/wk \(Ms\. Lopez\)/);
  assert.match(out.markdown, /Extended time on tests/);
  assert.match(out.markdown, /Reduced item count/);
  assert.match(out.markdown, /\| 2026-09-05 \| present \|/);
  assert.match(out.markdown, /\| 2026-09-06 \| absent \| doctor \|/);
  assert.match(out.markdown, /Functioning level:\*\* SUPPORTED/);
  assert.match(out.markdown, /Plan effective:\*\* 2026-09-01/);
});

test("buildIepPacket → HTML output is well-formed and escaped", () => {
  const inj: IepPacketInput = {
    ...minimal,
    learner: { id: "l-x", fullName: "Eve <script>alert(1)</script>" },
  };
  const out = buildIepPacket(inj);
  assert.match(out.html, /<!doctype html>/i);
  assert.match(out.html, /<h1>/);
  assert.match(out.html, /<h2>/);
  // Script tag must be escaped.
  assert.ok(!out.html.includes("<script>alert(1)</script>"), "raw script must not appear in html");
  assert.match(out.html, /Eve &lt;script&gt;/);
});

test("buildIepPacket → throws when learner is missing required fields", () => {
  assert.throws(() => buildIepPacket({ ...minimal, learner: { id: "", fullName: "" } }));
});

test("buildIepPacket → preparedAt is rendered as a date when provided", () => {
  const out = buildIepPacket(full);
  assert.match(out.markdown, /Prepared by AIVO Assessment Service on 2026-09-10/);
});
