---
name: Post-merge pnpm install resource exhaustion in this repl
description: Why scripts/post-merge.sh must serialize builds, cap threads, lock, and retry — and how to tune it.
---

# Post-merge `pnpm install` fails under resource pressure unless tamed

`scripts/post-merge.sh` runs `pnpm install`, which executes every workspace
package's `prepare`/build lifecycle script (mostly `tsc`; ~39 of the ~73
packages have one). This runs **while all dev workflows stay resident**
(Marketing, Web App, Brain, Identity, mockup-sandbox), so the container is
already loaded when the install starts.

There are TWO distinct failure modes, both environmental (not code bugs):

1. **Heap OOM abort.** Parallel `tsc` compilers exhaust memory →
   `ELIFECYCLE ... exit code -11` / "Aborted" on several packages at once.
   **Fix:** `--child-concurrency=1` so only one lifecycle build (one tsc heap)
   runs at a time.

2. **PID/thread exhaustion.** The cgroup caps the container at
   `pids.max=1024`, and the resident workflows alone sit at ~900 PIDs
   (`/sys/fs/cgroup/pids.current`), leaving only ~100 free. A `pnpm install`
   adds its link-worker pool (~`nproc`=8 node Worker threads) + tsc forks; when
   several merges land close together, each fires its own post-merge install
   and they collectively blow past 1024. Symptoms: `tsc: 2: Cannot fork` from
   the `.bin/tsc` shim and `new Worker (node:internal/worker...)` failures
   during pnpm's `symlinkAllModules`. NOTE: `ulimit -u` is ~64k and
   `memory.current` is ~10/16G during these — so it is the **cgroup pids cap**,
   not heap memory or the per-user nproc limit. Check `pids.current` vs
   `pids.max`, not `free`/`ulimit`, when you see "Cannot fork".

## Fix / rules (all four are load-bearing; do not remove)

- `--child-concurrency=1` on both the frozen-lockfile call and its fallback
  (mode 1).
- **flock mutex** on fd 9 (`/tmp/aivo-post-merge-install.lock`) around the
  install so overlapping post-merge runs from near-simultaneous merges QUEUE
  instead of colliding into the PID ceiling (mode 2). **MUST be bounded
  (`flock -w 120 9 || …`), never unbounded `flock 9`.** A post-merge cancelled
  mid-install can leave an orphaned `pnpm install` child (reparented to pid 1)
  that *inherited* fd 9 and never releases the lock — `exec 9>file` is NOT
  close-on-exec, so children keep it. An unbounded `flock 9` on the next merge
  then blocks forever until the platform cancels it, surfacing as
  **`Error in river, code: CANCEL`** (empty message) on both post-merge setup
  AND workflow reconciliation. Bounded `-w` waits briefly then proceeds, so a
  stale holder can never wedge future merges. To clear a live wedge: find the
  pid whose `/proc/<pid>/fd` points at the lock file (`pgrep -f "pnpm install"`,
  it'll be ppid=1), `kill -9` it, and `rm -f` the lock file.
- **`export UV_THREADPOOL_SIZE=2`** shrinks each node process's libuv pool
  (default 4) so pnpm + every tsc child claim fewer of the scarce PIDs.
- **retry-with-backoff** loop (`until install_deps`) for genuinely momentary
  fork spikes; invoked as an `until` condition so `set -e` doesn't abort on one
  attempt's failure.

## How to apply / tune
- Post-merge timeout is 1800000 ms (30 min) via `setPostMergeConfig` — keep the
  headroom; a timeout-kill mid-install is worse than a slow finish. A clean
  single pass takes ~130 s.
- Do NOT pass `--ignore-scripts`: the `prepare` hooks (package builds, Drizzle
  codegen) are required for downstream services to boot.
- Validation gotcha: a manual `nohup bash scripts/post-merge.sh &` gets
  SIGKILLed when the bash tool call returns (the platform reaps spawned process
  trees). Validate with `runPostMergeSetup()` (code_execution) instead — it is
  platform-managed and survives. If concurrent runaway `pnpm install`
  processes pile up (ppid=1, long `etime`, queued on the pnpm store lock), kill
  them to free PIDs before re-validating.
