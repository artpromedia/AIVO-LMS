/**
 * Pure run-loop tests for the server-authoritative adaptive baseline.
 * No DB / no Fastify (mirrors the learning-profile + iep-packet pattern).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startRun,
  respondToItem,
  finalizeRun,
  serializeSession,
  hydrateSession,
  type RunSession,
} from "../src/services/adaptive-baseline-runner.js";
import type { BaselineItem } from "@aivo/adaptive-baseline";

function item(id: string, skillId: string, difficulty: number): BaselineItem {
  return { id, skillId, difficulty, modalities: ["reading"], lightReading: false };
}

// Two items per difficulty band so there is always a candidate on either
// side of θ.
const BANK: BaselineItem[] = [
  item("f1", "sk1", -1.0),
  item("f2", "sk2", -1.0),
  item("a1", "sk3", -0.3),
  item("a2", "sk4", -0.3),
  item("g1", "sk5", 0.4),
  item("g2", "sk6", 0.4),
  item("s1", "sk7", 1.2),
  item("s2", "sk8", 1.2),
];

function diff(id: string): number {
  return BANK.find((b) => b.id === id)!.difficulty;
}

test("startRun serves the item nearest the prior θ", () => {
  const fromZero = startRun({ bank: BANK, priorTheta: 0 });
  assert.equal(fromZero.nextItem?.difficulty, -0.3); // approaching is nearest 0
  assert.equal(fromZero.session.lastServedItemId, fromZero.nextItem?.id);
  assert.equal(fromZero.stop.stop, false);

  const fromHigh = startRun({ bank: BANK, priorTheta: 1.0 });
  assert.equal(fromHigh.nextItem?.difficulty, 1.2); // stretch is nearest 1.0
});

test("respondToItem rejects an answer to an item we did not serve", () => {
  const { session } = startRun({ bank: BANK, priorTheta: 0 });
  const wrongId = BANK.find((b) => b.id !== session.lastServedItemId)!.id;
  const out = respondToItem({ session, itemId: wrongId, correct: true, bank: BANK });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "unexpected_item");
});

test("respondToItem rejects an item missing from the bank (anti-spoof)", () => {
  const session: RunSession = {
    state: {
      theta: 0,
      infoSum: 0,
      administered: [],
      coveredSkills: new Set(),
      readingDifficulty: false,
    },
    lastServedItemId: "ghost",
  };
  const out = respondToItem({ session, itemId: "ghost", correct: true, bank: BANK });
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, "unknown_item");
});

test("respondToItem rejects re-answering an administered item", () => {
  const start = startRun({ bank: BANK, priorTheta: 0 });
  const first = start.session.lastServedItemId!;
  const out1 = respondToItem({ session: start.session, itemId: first, correct: true, bank: BANK });
  assert.equal(out1.ok, true);
  if (!out1.ok) return;
  // Force the just-answered item to look "served again".
  const replay: RunSession = { ...out1.session, lastServedItemId: first };
  const out2 = respondToItem({ session: replay, itemId: first, correct: true, bank: BANK });
  assert.equal(out2.ok, false);
  if (!out2.ok) assert.equal(out2.reason, "duplicate_item");
});

test("a correct answer drives the next item harder than a wrong answer does", () => {
  const start = startRun({ bank: BANK, priorTheta: 0 });
  const served = start.session.lastServedItemId!;

  const correct = respondToItem({ session: start.session, itemId: served, correct: true, bank: BANK });
  const wrong = respondToItem({ session: start.session, itemId: served, correct: false, bank: BANK });
  assert.equal(correct.ok, true);
  assert.equal(wrong.ok, true);
  if (!correct.ok || !wrong.ok) return;

  assert.ok(correct.theta > wrong.theta);
  assert.ok(diff(correct.nextItem!.id) > diff(wrong.nextItem!.id));
});

test("a full run terminates and finalize emits a profile", () => {
  let session = startRun({ bank: BANK, priorTheta: 0 }).session;
  let served = session.lastServedItemId;
  let answered = 0;
  while (served) {
    const out = respondToItem({ session, itemId: served, correct: answered % 2 === 0, bank: BANK });
    assert.equal(out.ok, true);
    if (!out.ok) break;
    session = out.session;
    answered += 1;
    served = out.nextItem ? out.session.lastServedItemId : null;
  }
  assert.ok(answered >= 6); // honored MIN_ITEMS
  assert.ok(answered <= BANK.length);

  const result = finalizeRun(session, BANK);
  assert.equal(result.itemsAdministered, answered);
  assert.equal(typeof result.finalTheta, "number");
  assert.ok(Array.isArray(result.profile.modalityFit));
});

test("G5 parity: a struggling run is served the easier item under the ceiling", () => {
  // A session with a trailing wrong run; answering the current item wrong
  // pushes it to a high frustration level, tightening the ceiling so the
  // (nearer) hard item is excluded in favour of the easier one.
  const bank = [item("cur", "sc", 0.0), item("hard", "sh", 0.4), item("easy", "se", -0.8)];
  const session = hydrateSession({
    theta: 0,
    infoSum: 0,
    administered: [
      { itemId: "d0", correct: false, responseTimeMs: 0 },
      { itemId: "d1", correct: false, responseTimeMs: 0 },
      { itemId: "d2", correct: false, responseTimeMs: 0 },
    ],
    coveredSkills: [],
    readingDifficulty: false,
    lastServedItemId: "cur",
  });
  const out = respondToItem({ session, itemId: "cur", correct: false, bank });
  assert.equal(out.ok, true);
  if (!out.ok) return;
  assert.equal(out.nextItem?.id, "easy");
});

test("serialize/hydrate round-trips the session incl. lastServedItemId", () => {
  const start = startRun({ bank: BANK, priorTheta: 0.2 });
  const out = respondToItem({
    session: start.session,
    itemId: start.session.lastServedItemId!,
    correct: true,
    bank: BANK,
  });
  assert.equal(out.ok, true);
  if (!out.ok) return;

  const round = hydrateSession(serializeSession(out.session));
  assert.equal(round.state.theta, out.session.state.theta);
  assert.equal(round.state.infoSum, out.session.state.infoSum);
  assert.equal(round.lastServedItemId, out.session.lastServedItemId);
  assert.deepEqual([...round.state.coveredSkills], [...out.session.state.coveredSkills]);
  assert.equal(round.state.administered.length, out.session.state.administered.length);
});

test("legacy session (no lastServedItemId) skips the sequence check", () => {
  const legacy = hydrateSession({
    theta: 0,
    infoSum: 0,
    administered: [],
    coveredSkills: [],
    readingDifficulty: false,
    // lastServedItemId intentionally absent
  });
  assert.equal(legacy.lastServedItemId, null);
  const out = respondToItem({ session: legacy, itemId: "g1", correct: true, bank: BANK });
  assert.equal(out.ok, true); // no integrity rejection when null
});
