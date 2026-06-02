import type {
  CodingOutputCapture,
  CodingRubricTest,
  CodingRunResult,
  CodingTestResult,
} from "./types.js";

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
  }

  return false;
}

function toComparableStdout(v: unknown): string {
  return String(v ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function pickFunctionName(
  test: CodingRubricTest,
  exportsMap: Record<string, unknown>,
): string | null {
  if (typeof exportsMap[test.name] === "function") return test.name;
  const fallback = test.name.split(/\s+/)[0]?.trim();
  if (fallback && typeof exportsMap[fallback] === "function") return fallback;
  return null;
}

export async function runJavascriptRubricTests(params: {
  tests: CodingRubricTest[];
  exportsMap: Record<string, unknown>;
  output: CodingOutputCapture;
}): Promise<CodingRunResult> {
  const results: CodingTestResult[] = [];
  for (const test of params.tests) {
    const testStart = performance.now();
    if (test.kind === "stdout") {
      const actual = toComparableStdout(params.output.stdout);
      const expected = toComparableStdout(test.expected);
      const pass = actual === expected;
      const runtimeMs = Math.max(0, Math.round(performance.now() - testStart));
      results.push({
        name: test.name,
        hidden: Boolean(test.hidden),
        kind: "stdout",
        pass,
        runtimeMs,
        expected: test.expected,
        actual: params.output.stdout,
        output: params.output,
      });
      continue;
    }

    const fnName = pickFunctionName(test, params.exportsMap);
    const fn = fnName ? params.exportsMap[fnName] : null;
    let actual: unknown = undefined;
    let pass = false;
    if (typeof fn === "function") {
      const args = Array.isArray(test.input)
        ? test.input
        : test.input === undefined
          ? []
          : [test.input];
      actual = await (fn as (...a: unknown[]) => unknown)(...args);
      pass = deepEqual(actual, test.expected);
    }
    const runtimeMs = Math.max(0, Math.round(performance.now() - testStart));
    results.push({
      name: test.name,
      hidden: Boolean(test.hidden),
      kind: "returns",
      pass,
      runtimeMs,
      expected: test.expected,
      actual,
      output: { ...params.output, returnValue: actual },
    });
  }

  const passed = results.filter((r) => r.pass).length;
  return {
    output: params.output,
    tests: results,
    passed,
    failed: results.length - passed,
  };
}
