import { describe, it, expect, beforeEach } from "vitest";
import { createCounter, createHistogram, exportMetrics, _resetMetrics } from "../index.js";

beforeEach(() => _resetMetrics());

describe("createCounter()", () => {
  it("increments by 1 by default", () => {
    const c = createCounter("test_counter");
    c.increment();
    const output = exportMetrics();
    expect(output).toContain("test_counter 1");
  });

  it("increments by the specified value", () => {
    const c = createCounter("req_total");
    c.increment(5);
    const output = exportMetrics();
    expect(output).toContain("req_total 5");
  });

  it("tracks separate label sets independently", () => {
    const c = createCounter("http_total", ["method", "status"]);
    c.increment(1, { method: "GET", status: "200" });
    c.increment(2, { method: "POST", status: "201" });
    const output = exportMetrics();
    expect(output).toContain('http_total{method="GET",status="200"} 1');
    expect(output).toContain('http_total{method="POST",status="201"} 2');
  });

  it("accumulates multiple increments for the same labels", () => {
    const c = createCounter("hits");
    c.increment(1);
    c.increment(1);
    c.increment(1);
    const output = exportMetrics();
    expect(output).toContain("hits 3");
  });
});

describe("createHistogram()", () => {
  it("records a value and produces _sum and _count", () => {
    const h = createHistogram("latency_seconds");
    h.record(0.05);
    const output = exportMetrics();
    expect(output).toContain("latency_seconds_sum");
    expect(output).toContain("latency_seconds_count");
  });

  it("uses the +Inf bucket for all observations", () => {
    const h = createHistogram("response_time");
    h.record(0.001);
    const output = exportMetrics();
    expect(output).toContain('le="+Inf"');
  });
});

describe("exportMetrics()", () => {
  it("returns a string", () => {
    expect(typeof exportMetrics()).toBe("string");
  });

  it("includes # TYPE lines for each metric", () => {
    createCounter("my_counter");
    const output = exportMetrics();
    expect(output).toContain("# TYPE my_counter counter");
  });

  it("returns empty string when no metrics registered", () => {
    expect(exportMetrics()).toBe("");
  });
});
