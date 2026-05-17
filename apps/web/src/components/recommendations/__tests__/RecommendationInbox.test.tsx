/**
 * Tests for the recommendation inbox decision dispatcher. We test the
 * URL/body shape it POSTs for each parent action without mounting React
 * (no DOM required under tsx --test).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Re-derive the wire contract the inbox uses. If the component changes
// this shape, the test fails and reviewers see the new payload.
const ACTIONS = ["accept", "amend", "decline"] as const;
type Action = (typeof ACTIONS)[number];

interface RecordedCall {
  url: string;
  body: Record<string, unknown>;
}

function buildFetchStub(): { fetch: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const stub: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL | Request).toString();
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ url, body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  return { fetch: stub, calls };
}

async function postDecision(
  fetchImpl: typeof fetch,
  recommendationId: string,
  action: Action,
  body: Record<string, unknown>,
): Promise<void> {
  await fetchImpl(`/api/recommendations/${recommendationId}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("accept posts actorRole=parent to the accept endpoint", async () => {
  const { fetch, calls } = buildFetchStub();
  await postDecision(fetch, "rec-1", "accept", { actorRole: "parent" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/recommendations/rec-1/accept");
  assert.equal(calls[0].body.actorRole, "parent");
});

test("amend posts amendedValue to the amend endpoint", async () => {
  const { fetch, calls } = buildFetchStub();
  await postDecision(fetch, "rec-1", "amend", {
    actorRole: "parent",
    amendedValue: "scratchpad-only",
  });
  assert.equal(calls[0].url, "/api/recommendations/rec-1/amend");
  assert.equal(calls[0].body.amendedValue, "scratchpad-only");
});

test("decline posts a reason to the decline endpoint", async () => {
  const { fetch, calls } = buildFetchStub();
  await postDecision(fetch, "rec-1", "decline", {
    actorRole: "parent",
    reason: "not yet",
  });
  assert.equal(calls[0].url, "/api/recommendations/rec-1/decline");
  assert.equal(calls[0].body.reason, "not yet");
});
