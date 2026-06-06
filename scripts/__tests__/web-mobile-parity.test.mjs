import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareSurfaceCapabilities,
  parseTutorTierAssignments,
  sourceMarkerAxis,
  parseSurfaceCapabilities,
  subjectVisibilityAxis,
} from "../lib/web-mobile-parity.mjs";

test("surface parity flags a synthetic support mismatch", () => {
  const parsed = parseSurfaceCapabilities(`
  choice_grid: { web: "full", mobile: "full", note: "ok" },
  music_sequencer: { web: "full", mobile: "fallback", note: "gap" },
`);

  assert.deepEqual(compareSurfaceCapabilities(parsed), [
    { type: "choice_grid", web: "full", mobile: "full", parity: true },
    { type: "music_sequencer", web: "full", mobile: "fallback", parity: false },
  ]);
});

test("subject visibility flags a synthetic client mismatch", () => {
  assert.deepEqual(subjectVisibilityAxis(["math"], { web: true, mobile: false }), [
    { subject: "math", web: true, mobile: false, parity: false },
  ]);
});

test("behavior parity reports missing implementation markers", () => {
  assert.deepEqual(
    sourceMarkerAxis("useStartSession Speech.speak", [
      {
        feature: "agentic chat",
        markers: ["useStartSession", "useSendMessage", "Speech.speak"],
      },
    ]),
    [
      {
        feature: "agentic chat",
        present: false,
        missing: ["useSendMessage"],
      },
    ],
  );
});

test("tutor tier parser detects tutors hidden from PRE-K", () => {
  assert.deepEqual(
    parseTutorTierAssignments(`
  nova: { name: "Nova", tiers: ALL_TIERS, avatar: "nova.png" },
  chrono: { name: "Chrono", tiers: SECONDARY_TIERS, avatar: "chrono.png" },
`),
    [
      { tutor: "nova", tiers: "ALL_TIERS" },
      { tutor: "chrono", tiers: "SECONDARY_TIERS" },
    ],
  );
});
