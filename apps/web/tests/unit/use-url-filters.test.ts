/**
 * Sprint 10 (Task #199) — unit tests for the URL-filter helpers used by
 * admin dashboards. The helpers `readParam*` and `serializeFilters` are
 * pure (no React/DOM dependency at the call site), so they can be
 * exercised by `tsx --test` without spinning up jsdom.
 *
 * `useSyncFiltersToUrl` is excluded here because it touches `useEffect`
 * and `window.history`; that hook is covered by the page-level e2e
 * specs that already navigate the dashboards. The pure surface is what
 * refactors are most likely to break, and that's what these tests
 * guard.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  readParamArray,
  readParamNumber,
  readParamString,
  serializeFilters,
} from "../../src/hooks/use-url-filters.js";

test("readParamString returns fallback for null params", () => {
  assert.equal(readParamString(null, "q"), "");
  assert.equal(readParamString(null, "q", "default"), "default");
});

test("readParamString returns the param when present", () => {
  const p = new URLSearchParams("q=hello");
  assert.equal(readParamString(p, "q"), "hello");
});

test("readParamString returns fallback when key is missing", () => {
  const p = new URLSearchParams("other=1");
  assert.equal(readParamString(p, "q", "fb"), "fb");
});

test("readParamString returns fallback for empty string value", () => {
  const p = new URLSearchParams("q=");
  assert.equal(readParamString(p, "q", "fb"), "fb");
});

test("readParamNumber parses integer", () => {
  const p = new URLSearchParams("page=3");
  assert.equal(readParamNumber(p, "page", 1), 3);
});

test("readParamNumber parses negative and zero", () => {
  const p = new URLSearchParams("a=0&b=-2");
  assert.equal(readParamNumber(p, "a", 1), 0);
  assert.equal(readParamNumber(p, "b", 1), -2);
});

test("readParamNumber returns fallback for non-numeric input", () => {
  const p = new URLSearchParams("page=abc");
  assert.equal(readParamNumber(p, "page", 7), 7);
});

test("readParamNumber returns fallback for NaN-shaped input", () => {
  const p = new URLSearchParams("page=NaN");
  assert.equal(readParamNumber(p, "page", 7), 7);
});

test("readParamNumber returns fallback for missing key", () => {
  const p = new URLSearchParams("");
  assert.equal(readParamNumber(p, "page", 1), 1);
});

test("readParamArray splits comma-separated values", () => {
  const p = new URLSearchParams("statuses=ok,partial,failed");
  assert.deepEqual(readParamArray(p, "statuses"), ["ok", "partial", "failed"]);
});

test("readParamArray accepts repeated keys", () => {
  const p = new URLSearchParams("s=a&s=b&s=c");
  assert.deepEqual(readParamArray(p, "s"), ["a", "b", "c"]);
});

test("readParamArray combines repeats and commas", () => {
  const p = new URLSearchParams("s=a,b&s=c");
  assert.deepEqual(readParamArray(p, "s"), ["a", "b", "c"]);
});

test("readParamArray trims whitespace and drops empties", () => {
  const p = new URLSearchParams("s=a, b ,,c");
  assert.deepEqual(readParamArray(p, "s"), ["a", "b", "c"]);
});

test("readParamArray returns fallback when missing", () => {
  const p = new URLSearchParams("other=1");
  assert.deepEqual(readParamArray(p, "s", ["x"]), ["x"]);
});

test("readParamArray returns fallback for null params", () => {
  assert.deepEqual(readParamArray(null, "s", ["x"]), ["x"]);
});

test("serializeFilters omits empty / null / undefined / blank-string values", () => {
  const out = serializeFilters({
    a: "",
    b: null,
    c: undefined,
    d: "x",
  });
  assert.equal(out.toString(), "d=x");
});

test("serializeFilters serialises numbers and skips NaN/Infinity", () => {
  const out = serializeFilters({
    page: 2,
    weird: Number.NaN,
    inf: Number.POSITIVE_INFINITY,
  });
  assert.equal(out.toString(), "page=2");
});

test("serializeFilters joins arrays with commas; drops empty arrays", () => {
  const out = serializeFilters({
    statuses: ["ok", "partial"],
    empty: [],
  });
  assert.equal(out.toString(), "statuses=ok%2Cpartial");
});

test("serializeFilters output keys are stable (sorted)", () => {
  // Two different insertion orders should produce identical query strings
  // so refresh-equality checks in the hook don't churn the URL.
  const a = serializeFilters({ b: "1", a: "2", c: "3" }).toString();
  const b = serializeFilters({ c: "3", a: "2", b: "1" }).toString();
  assert.equal(a, b);
  assert.equal(a, "a=2&b=1&c=3");
});

test("round trip: serialize -> readParam* recovers values", () => {
  const params = serializeFilters({
    q: "hello world",
    page: 4,
    statuses: ["ok", "partial"],
  });
  const round = new URLSearchParams(params.toString());
  assert.equal(readParamString(round, "q"), "hello world");
  assert.equal(readParamNumber(round, "page", 1), 4);
  assert.deepEqual(readParamArray(round, "statuses"), ["ok", "partial"]);
});
