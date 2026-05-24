import { describe, expect, it } from "vitest";
import {
  buildSnippetTelemetry,
  CODING_FIXTURE_ITEMS,
  runJavascriptRubricTests,
} from "../CodingSandbox/index.js";

describe("coding sandbox runner", () => {
  it("passes stdout and returns rubric tests", async () => {
    const result = await runJavascriptRubricTests({
      tests: [
        { name: "prints", kind: "stdout", expected: "Hello" },
        { name: "sum", kind: "returns", input: [2, 3], expected: 5 },
      ],
      exportsMap: { sum: (a: number, b: number) => a + b },
      output: { stdout: "Hello", stderr: "", runtimeMs: 8 },
    });

    expect(result.failed).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.tests[1]?.output.returnValue).toBe(5);
  });

  it("produces anonymized telemetry unless source capture is enabled", () => {
    const hiddenTelemetry = buildSnippetTelemetry({
      source: "print('hello')",
      language: "python",
      tests: [
        { name: "visible", kind: "stdout", expected: "hello" },
        { name: "hidden", hidden: true, kind: "stdout", expected: "hello" },
      ],
      captureSource: false,
    });
    expect(hiddenTelemetry.source).toBeUndefined();
    expect(hiddenTelemetry.hiddenTestCount).toBe(1);

    const captureTelemetry = buildSnippetTelemetry({
      source: "console.log('hello')",
      language: "javascript",
      tests: [],
      captureSource: true,
    });
    expect(captureTelemetry.source).toContain("hello");
  });

  it("ships 15 coding fixture items across grades 3-8", () => {
    expect(CODING_FIXTURE_ITEMS).toHaveLength(15);
    expect(CODING_FIXTURE_ITEMS.some((f) => f.gradeBand === "3-5")).toBe(true);
    expect(CODING_FIXTURE_ITEMS.some((f) => f.gradeBand === "6-8")).toBe(true);
  });
});
