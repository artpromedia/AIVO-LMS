#!/usr/bin/env node
// Self-test for the paging-URL-leak guardrail. Runs the scanner against
// a few fixtures and asserts both the positive (must catch) and negative
// (must allow) cases.
//
// Sprint 10 (#200) extension: the original scanner caught the URL when it
// appeared on a line tagged with paging-shaped key names. The case we
// care about is when the URL value is hard-coded into a generically-named
// field — `expo.extra.notifyUrl = "https://hooks.slack.com/..."` — that
// the *key-name* guardrail does NOT see. The scanner matches on the URL
// pattern itself, so it must catch this; this test pins that contract so
// future refactors don't silently lose it.
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here = fileURLToPath(new URL(".", import.meta.url));
const guardrail = join(here, "check-paging-url-leaks.mjs");

function runOnFixture(files) {
  const dir = mkdtempSync(join(tmpdir(), "paging-leak-test-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content);
  }
  spawnSync("git", ["init", "-q"], { cwd: dir });
  spawnSync("git", ["add", "."], { cwd: dir });
  return spawnSync("node", [guardrail], { cwd: dir, encoding: "utf8" });
}

// Case 1 (existing): bare slack URL on its own line.
{
  const result = runOnFixture({
    "leaky.ts": [
      "// real-looking slack webhook url",
      "const SLACK = \"https://hooks.slack.com/services/REDACTED/FOR/TESTING\";",
      "fetch(SLACK);",
    ].join("\n"),
  });
  assert.notEqual(result.status, 0,
    `expected non-zero exit; stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stderr, /slack-webhook/);
}

// Case 2 (#200): paging URL hidden inside a generically-named field.
// The key-name guardrail wouldn't see `notifyUrl`, but the URL-pattern
// scanner must.
{
  const result = runOnFixture({
    "app.config.ts": [
      "export default {",
      "  expo: {",
      "    extra: {",
      "      // note: not named *Webhook* / *Pager* — the key-name guardrail",
      "      // wouldn't see this; the URL-pattern scanner must.",
      "      notifyUrl: \"https://hooks.slack.com/services/REDACTED/FOR/TESTING\",",
      "    },",
      "  },",
      "};",
    ].join("\n"),
  });
  assert.notEqual(result.status, 0,
    `expected non-zero exit for hidden URL; stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stderr, /slack-webhook/);
  assert.match(result.stderr, /app\.config\.ts/);
}

// Case 3 (#200): pagerduty events URL embedded in a config blob.
{
  const result = runOnFixture({
    "config.json": JSON.stringify({
      featureFlags: { newRetry: true },
      // No paging-shaped key, but a real PD events URL.
      destination: "https://events.pagerduty.com/v2/enqueue",
    }, null, 2),
  });
  assert.notEqual(result.status, 0,
    `expected non-zero exit for PD events URL; stdout=${result.stdout} stderr=${result.stderr}`);
  assert.match(result.stderr, /pagerduty-events/);
}

// Case 4 (negative): an unrelated example URL that isn't a paging vendor
// must not trip the scanner.
{
  const result = runOnFixture({
    "ok.ts": [
      "fetch(\"https://example.com/hooks/services/abc\");",
      "// also a 32-char hex blob that's NOT a routing key (no pagerduty keyword)",
      "const sha = \"abcdef0123456789abcdef0123456789\";",
    ].join("\n"),
  });
  assert.equal(result.status, 0,
    `expected zero exit on clean fixture; stdout=${result.stdout} stderr=${result.stderr}`);
}

// Case 5 (negative): a `// paging-url-leaks: ignore` comment on the same
// line allows an intentional fixture (test data, docs).
{
  const result = runOnFixture({
    "doc.md": [
      "Example webhook URL (do not actually use):",
      "https://hooks.slack.com/services/TXX/BYY/zzzzzzzzzzzz // paging-url-leaks: ignore",
    ].join("\n"),
  });
  assert.equal(result.status, 0,
    `expected zero exit on ignored line; stdout=${result.stdout} stderr=${result.stderr}`);
}

console.log("guardrail self-test: OK");
