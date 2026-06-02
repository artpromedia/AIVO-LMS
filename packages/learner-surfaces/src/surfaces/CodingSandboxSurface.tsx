import { useMemo, useState } from "react";
import { buildSnippetTelemetry, runJavascriptRubricTests } from "../CodingSandbox/index.js";
import type { CodingRunResult } from "../CodingSandbox/types.js";
import { createSurfaceEvent, type SurfaceTelemetryEvent } from "../telemetry/surface-events.js";
import type { LearnerSurfaceSpec, SurfaceResponse } from "../types.js";

export interface CodingSandboxSurfaceProps {
  surface: LearnerSurfaceSpec;
  disabled?: boolean;
  onSubmit?: (response: SurfaceResponse) => void;
  onEvent?: (event: SurfaceTelemetryEvent) => void;
}

async function executeJsInIframe(input: { code: string; stdin: string }): Promise<{
  stdout: string;
  stderr: string;
  runtimeMs: number;
  exportsMap: Record<string, unknown>;
}> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      stdout: "",
      stderr: "Execution unavailable outside browser.",
      runtimeMs: 0,
      exportsMap: {},
    };
  }
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.setAttribute("aria-hidden", "true");
  const token = `coding-${Math.random().toString(36).slice(2)}`;
  frame.srcdoc = `
<!doctype html>
<html><body>
<script>
const getExportNames = (code) => {
  const names = new Set();
  const re = /export\\s+(?:async\\s+)?(?:function|const|let|var|class)\\s+([A-Za-z_$][\\w$]*)/g;
  let m;
  while ((m = re.exec(code)) !== null) names.add(m[1]);
  return Array.from(names);
};
const stripExport = (code) => code
  .replace(/export\\s+default\\s+/g, "const __default_export__ = ")
  .replace(/export\\s+(?=(?:async\\s+)?(?:function|const|let|var|class))/g, "");
window.addEventListener("message", async (evt) => {
  const data = evt.data || {};
  if (data.type !== "execute" || data.token !== "${token}") return;
  const logs = [];
  const errors = [];
  const origLog = console.log;
  const origErr = console.error;
  const start = performance.now();
  try {
    console.log = (...args) => { logs.push(args.map((v) => String(v)).join(" ")); };
    console.error = (...args) => { errors.push(args.map((v) => String(v)).join(" ")); };
    const exportNames = getExportNames(data.code || "");
    const transformed = stripExport(String(data.code || ""));
    const runner = new Function("stdin", "\\n" + transformed + "\\nconst __all = {};\\nfor (const n of arguments[1]) { if (typeof globalThis[n] !== 'undefined') __all[n] = globalThis[n]; else { try { __all[n] = eval(n); } catch {} } }\\nif (typeof __default_export__ !== 'undefined') __all.default = __default_export__;\\nreturn __all;");
    const exportsMap = runner(data.stdin || "", exportNames);
    const runtimeMs = Math.max(0, Math.round(performance.now() - start));
    parent.postMessage({ type: "execute-result", token: "${token}", stdout: logs.join("\\n"), stderr: errors.join("\\n"), runtimeMs, exportsMap }, "*");
  } catch (err) {
    const runtimeMs = Math.max(0, Math.round(performance.now() - start));
    parent.postMessage({ type: "execute-result", token: "${token}", stdout: logs.join("\\n"), stderr: String(err && err.message ? err.message : err), runtimeMs, exportsMap: {} }, "*");
  } finally {
    console.log = origLog;
    console.error = origErr;
  }
});
</script>
</body></html>`;

  document.body.appendChild(frame);

  return await new Promise((resolve) => {
    const onMessage = (evt: MessageEvent) => {
      const data = evt.data as
        | {
            type?: string;
            token?: string;
            stdout?: string;
            stderr?: string;
            runtimeMs?: number;
            exportsMap?: Record<string, unknown>;
          }
        | undefined;
      if (!data || data.type !== "execute-result" || data.token !== token) return;
      window.removeEventListener("message", onMessage);
      frame.remove();
      resolve({
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        runtimeMs: data.runtimeMs ?? 0,
        exportsMap: data.exportsMap ?? {},
      });
    };
    window.addEventListener("message", onMessage);
    const submit = () =>
      frame.contentWindow?.postMessage(
        { type: "execute", token, code: input.code, stdin: input.stdin },
        "*",
      );
    if (frame.contentWindow) {
      submit();
    } else {
      frame.addEventListener("load", submit, { once: true });
    }
  });
}

async function runPythonWithWorker(input: {
  code: string;
  tests: Array<{
    name: string;
    hidden?: boolean;
    kind: "stdout" | "returns";
    input?: string | unknown[];
    expected: string | unknown;
  }>;
  stdin: string;
}): Promise<CodingRunResult> {
  if (typeof Worker === "undefined") {
    return {
      output: {
        stdout: "",
        stderr: "Python execution unavailable in this environment.",
        runtimeMs: 0,
      },
      tests: [],
      passed: 0,
      failed: input.tests.length,
    };
  }
  const workerScript = `
let pyodideReady = null;
async function getPyodideRuntime() {
  if (!pyodideReady) {
    importScripts("https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js");
    pyodideReady = loadPyodide({});
  }
  return pyodideReady;
}
self.onmessage = async (event) => {
  const data = event.data || {};
  if (data.type !== "run") return;
  const start = Date.now();
  const out = [];
  const err = [];
  try {
    const pyodide = await getPyodideRuntime();
    pyodide.setStdout({ batched: (msg) => out.push(String(msg)) });
    pyodide.setStderr({ batched: (msg) => err.push(String(msg)) });
    pyodide.globals.set("__aivo_stdin", String(data.stdin || ""));
    await pyodide.runPythonAsync(data.code || "");
    const tests = Array.isArray(data.tests) ? data.tests : [];
    const results = [];
    for (const t of tests) {
      const tStart = Date.now();
      if (t.kind === "stdout") {
        const actual = out.join("\\n").trim();
        const expected = String(t.expected ?? "").trim();
        const pass = actual === expected;
        results.push({
          name: t.name,
          hidden: !!t.hidden,
          kind: "stdout",
          pass,
          runtimeMs: Date.now() - tStart,
          expected: t.expected,
          actual,
          output: { stdout: out.join("\\n"), stderr: err.join("\\n"), runtimeMs: Date.now() - start }
        });
        continue;
      }
      let actual = null;
      let pass = false;
      try {
        const fnName = String(t.name || "").split(/\\s+/)[0];
        const fn = pyodide.globals.get(fnName);
        const args = Array.isArray(t.input) ? t.input : (t.input === undefined ? [] : [t.input]);
        if (typeof fn === "function") {
          actual = fn(...args);
        } else if (fn && typeof fn.call === "function") {
          actual = fn.call(null, ...args);
        }
        pass = JSON.stringify(actual) === JSON.stringify(t.expected);
      } catch {
        pass = false;
      }
      results.push({
        name: t.name,
        hidden: !!t.hidden,
        kind: "returns",
        pass,
        runtimeMs: Date.now() - tStart,
        expected: t.expected,
        actual,
        output: { stdout: out.join("\\n"), stderr: err.join("\\n"), runtimeMs: Date.now() - start, returnValue: actual }
      });
    }
    const passed = results.filter((r) => r.pass).length;
    self.postMessage({
      ok: true,
      result: {
        output: { stdout: out.join("\\n"), stderr: err.join("\\n"), runtimeMs: Date.now() - start },
        tests: results,
        passed,
        failed: results.length - passed
      }
    });
  } catch (e) {
    self.postMessage({
      ok: false,
      error: String(e && e.message ? e.message : e),
      result: {
        output: { stdout: out.join("\\n"), stderr: err.join("\\n"), runtimeMs: Date.now() - start },
        tests: [],
        passed: 0,
        failed: (Array.isArray(data.tests) ? data.tests.length : 0)
      }
    });
  }
};`;
  const worker = new Worker(
    URL.createObjectURL(new Blob([workerScript], { type: "text/javascript" })),
  );
  return await new Promise((resolve) => {
    worker.onmessage = (event) => {
      const data = event.data as { ok?: boolean; error?: string; result?: CodingRunResult };
      worker.terminate();
      if (!data.ok && data.result) {
        resolve({
          ...data.result,
          output: {
            ...data.result.output,
            stderr: [data.result.output.stderr, data.error].filter(Boolean).join("\n"),
          },
        });
        return;
      }
      resolve(
        data.result ?? {
          output: { stdout: "", stderr: "Unknown Python runner error.", runtimeMs: 0 },
          tests: [],
          passed: 0,
          failed: input.tests.length,
        },
      );
    };
    worker.postMessage({ type: "run", code: input.code, tests: input.tests, stdin: input.stdin });
  });
}

export function CodingSandboxSurface({
  surface,
  disabled = false,
  onSubmit,
  onEvent,
}: CodingSandboxSurfaceProps) {
  const cfg = surface.codingSandbox;
  const language = cfg?.correctness?.language ?? cfg?.language ?? "python";
  const rubricTests = cfg?.correctness?.tests ?? [];
  const [code, setCode] = useState<string>(cfg?.correctness?.starterCode ?? cfg?.starterCode ?? "");
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CodingRunResult | null>(null);

  const submitDisabled = disabled || (surface.capture.finalAnswer && code.trim().length === 0);
  const editorStyle = useMemo(() => {
    const a11y = cfg?.accessibility;
    return {
      fontFamily: a11y?.dyslexiaFriendlyFont
        ? `"OpenDyslexic", "Atkinson Hyperlegible", ui-monospace, monospace`
        : `var(--font-aivo-mono, ui-monospace, monospace)`,
      fontSize: a11y?.largeText ? 18 : 14,
      lineHeight: a11y?.largeText ? 1.7 : 1.5,
      color: a11y?.highContrast ? "#fff" : "inherit",
      background: a11y?.highContrast ? "#000" : "#fff",
      borderColor: a11y?.highContrast ? "#fff" : "#d4d4d8",
      borderWidth: 1,
      width: "100%",
      minHeight: 260,
      borderRadius: 8,
      padding: 12,
    } as const;
  }, [cfg?.accessibility]);

  async function runTests() {
    if (running) return;
    setRunning(true);
    const telemetry = buildSnippetTelemetry({
      source: code,
      language,
      tests: rubricTests,
      captureSource: cfg?.captureSource,
    });
    onEvent?.(createSurfaceEvent(surface.id, "code-run", telemetry));
    try {
      const runResult =
        language === "python"
          ? await runPythonWithWorker({ code, tests: rubricTests, stdin })
          : await (async () => {
              const executed = await executeJsInIframe({ code, stdin });
              const jsResult = await runJavascriptRubricTests({
                tests: rubricTests,
                exportsMap: executed.exportsMap,
                output: {
                  stdout: executed.stdout,
                  stderr: executed.stderr,
                  runtimeMs: executed.runtimeMs,
                },
              });
              return jsResult;
            })();
      setResult(runResult);
      runResult.tests.forEach((test) => {
        onEvent?.(
          createSurfaceEvent(surface.id, test.pass ? "code-test-pass" : "code-test-fail", {
            name: test.name,
            hidden: test.hidden,
            kind: test.kind,
            runtimeMs: test.runtimeMs,
            ...telemetry,
          }),
        );
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section aria-label="coding-sandbox-surface" data-language={language}>
      <p>{surface.prompt}</p>
      {surface.instructions ? <p>{surface.instructions}</p> : null}
      {cfg?.prelude ? (
        <pre aria-label="coding sandbox prelude">
          <code>{cfg.prelude}</code>
        </pre>
      ) : null}
      <div aria-label={`coding sandbox (${language})`} style={{ display: "grid", gap: 12 }}>
        <div
          aria-hidden="true"
          data-sandpack-surface={language === "python" ? "pyodide-worker" : "sandpack-iframe"}
          style={{ fontSize: 12, opacity: 0.75 }}
        >
          {language === "python"
            ? "Pyodide worker runtime (background execution)"
            : "Sandpack-compatible iframe runtime"}
        </div>
        <label>
          <span>{`Your ${language} code`}</span>
          <textarea
            aria-label={`code editor (${language})`}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={code}
            disabled={disabled}
            style={editorStyle}
            onChange={(event) => {
              const next = event.currentTarget.value;
              setCode(next);
              onEvent?.(
                createSurfaceEvent(surface.id, "answer_changed", {
                  length: next.length,
                  language,
                }),
              );
            }}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                const target = event.currentTarget;
                const start = target.selectionStart;
                const end = target.selectionEnd;
                const next = code.slice(0, start) + "  " + code.slice(end);
                setCode(next);
                requestAnimationFrame(() => {
                  target.selectionStart = target.selectionEnd = start + 2;
                });
              }
            }}
          />
        </label>
        <label>
          <span>stdin (optional)</span>
          <textarea
            aria-label="stdin input"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            value={stdin}
            disabled={disabled}
            onChange={(event) => setStdin(event.currentTarget.value)}
            style={{ width: "100%", minHeight: 72, borderRadius: 8, padding: 8, borderWidth: 1 }}
          />
        </label>
      </div>
      {cfg?.hint ? <p>{cfg.hint}</p> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          aria-label="run code tests"
          disabled={disabled || running}
          onClick={runTests}
        >
          {running ? "Running…" : "Run tests"}
        </button>
        <button
          type="button"
          aria-label="submit code"
          disabled={submitDisabled}
          onClick={() => {
            if (result && result.failed === 0 && rubricTests.length > 0) {
              onEvent?.(
                createSurfaceEvent(surface.id, "complete", {
                  language,
                  passed: result.passed,
                  total: result.tests.length,
                }),
              );
            }
            onEvent?.(
              createSurfaceEvent(surface.id, "surface_submitted", {
                language,
                length: code.length,
              }),
            );
            onSubmit?.({
              surfaceId: surface.id,
              answer: code,
              durationMs: result?.output.runtimeMs,
            });
          }}
        >
          Submit code
        </button>
      </div>
      {result ? (
        <section aria-label="coding test results" style={{ marginTop: 12 }}>
          <p>{`Tests: ${result.passed}/${result.tests.length} passed`}</p>
          <ul>
            {result.tests.map((test) => (
              <li key={test.name}>
                {test.hidden
                  ? `${test.pass ? "✅" : "❌"} ${test.name} (hidden)`
                  : `${test.pass ? "✅" : "❌"} ${test.name} — expected ${JSON.stringify(test.expected)} got ${JSON.stringify(test.actual)}`}
              </li>
            ))}
          </ul>
          <pre aria-label="stdout">
            <code>{result.output.stdout || "(no stdout)"}</code>
          </pre>
          <pre aria-label="stderr">
            <code>{result.output.stderr || "(no stderr)"}</code>
          </pre>
          <p>{`Runtime: ${result.output.runtimeMs} ms`}</p>
        </section>
      ) : null}
    </section>
  );
}
