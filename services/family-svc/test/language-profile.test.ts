/**
 * AAC board fallback tests for the family-svc language-profile route
 * (Sprint 12.5).
 *
 * Exercises the brain-svc client wrapper in isolation:
 *   - When brain-svc returns a board, we surface it.
 *   - When brain-svc 5xxs / times out / 404s, we return null so the
 *     route can fall back to the default core board.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAacBoard } from "../src/services/brain-svc-client.js";

const ORIGINAL_FETCH = globalThis.fetch;

function withMockFetch<T>(
  responder: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  fn: () => Promise<T>,
): Promise<T> {
  globalThis.fetch = responder as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });
}

test("fetchAacBoard returns the parsed board on 200", async () => {
  const body = {
    items: [
      {
        symbol_id: "core.yes",
        label: "yes",
        image_url: "https://cdn/aac/core.yes.svg",
        category: "core",
        frequency_rank: 1,
      },
    ],
    source_domains: ["communication"],
  };
  const board = await withMockFetch(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    () => fetchAacBoard("learner-1"),
  );
  assert.ok(board);
  assert.equal(board!.items.length, 1);
  assert.equal(board!.items[0].symbol_id, "core.yes");
});

test("fetchAacBoard returns null on 5xx", async () => {
  const board = await withMockFetch(
    async () => new Response("internal", { status: 502 }),
    () => fetchAacBoard("learner-2"),
  );
  assert.equal(board, null);
});

test("fetchAacBoard returns null on 404 (learner has no brain state)", async () => {
  const board = await withMockFetch(
    async () => new Response("not found", { status: 404 }),
    () => fetchAacBoard("learner-3"),
  );
  assert.equal(board, null);
});

test("fetchAacBoard returns null on network failure", async () => {
  const board = await withMockFetch(
    async () => {
      throw new Error("ECONNREFUSED");
    },
    () => fetchAacBoard("learner-4"),
  );
  assert.equal(board, null);
});

test("fetchAacBoard URL-encodes the learner id and hits the brain-svc endpoint", async () => {
  let capturedUrl = "";
  await withMockFetch(
    async (input) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    },
    () => fetchAacBoard("weird/id with space"),
  );
  assert.match(capturedUrl, /\/api\/brain\/aac-board\/weird%2Fid%20with%20space$/);
});

test("fetchAacBoard returns null when response body is malformed", async () => {
  const board = await withMockFetch(
    async () => new Response('{"oops": true}', { status: 200 }),
    () => fetchAacBoard("learner-5"),
  );
  assert.equal(board, null);
});
