---
name: Post-merge pnpm install OOM in this repl
description: Why scripts/post-merge.sh must serialize pnpm lifecycle builds, and how to tune it.
---

# Post-merge `pnpm install` OOM-aborts unless lifecycle scripts are serialized

`scripts/post-merge.sh` runs `pnpm install` (which executes every workspace
package's `prepare`/build lifecycle script, mostly `tsc`). With the monorepo's
~73 packages, pnpm spawns up to 5 `tsc` compilers in parallel by default.

**Symptom:** the post-merge install aborts almost immediately (~12 s) with
`ELIFECYCLE Command failed with exit code -11` / `Aborted` on several packages
at once (e.g. adaptive-baseline + aac-bridge). Exit -11 / "Aborted" is an
out-of-memory abort, not a code bug.

**Why:** this repl keeps all dev workflows running during a merge (Marketing,
Web App, Brain, Identity, mockup-sandbox). They already hold ~13 GB of the
16 GB container, leaving only ~3 GB free — not enough for 5 concurrent `tsc`
heaps on top.

**Fix / rule:** pass `--child-concurrency=1` to `pnpm install` in the
post-merge script so only one lifecycle build runs at a time. This trades
wall-clock for a build that finishes. Do NOT bump concurrency back up while the
workflows stay resident.

**How to apply:**
- Keep `--child-concurrency=1` on both the frozen-lockfile call and its fallback.
- Serial builds are slower, so the post-merge timeout is set to 1800000 ms
  (30 min) via `setPostMergeConfig` — keep headroom; a timeout-kill mid-install
  is worse than a slow finish.
- Concurrent merges write to and clear `/tmp`, so don't rely on `/tmp` probe
  logs surviving during heavy merge activity; pnpm's store lock serializes
  overlapping installs (the platform's `WAITING_FOR_LOCK`), so they queue rather
  than corrupt node_modules.
