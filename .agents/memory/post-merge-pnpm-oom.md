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

## Orphan-accumulation death spiral (the real cause of repeated CANCEL)

The single most important failure mode: when the platform cancels a post-merge
it SIGKILLs the script, but the install's grandchildren — the per-package
`prepare` **tsc** compilers and the `pnpm install` itself — get reparented to
init (ppid=1) and **keep running/hung forever**. They never self-exit. Each
cancelled run leaves a fresh pile; they steadily drain the cgroup
`pids.max=1024` budget (the ~5 resident dev workflows already hold ~900–985,
so only ~40–120 PIDs are ever free). Once headroom is gone the NEXT install
can no longer fork (`tsc: Cannot fork` mid-prepare), runs for many minutes,
and is itself cancelled → even MORE orphans. That feedback loop is what
surfaces as repeated `Error in river, code: CANCEL` (empty message) across
post-merge setup AND workflow reconciliation, cascading over consecutive
merges.

Compounding factor: a killed mid-install leaves the pnpm tree "dirty" (link
done, prepares incomplete, completion flag unset), so the next
`--frozen-lockfile` install re-runs ALL ~73 workspace `prepare` tsc builds
instead of being a fast no-op — maximizing fork pressure exactly when headroom
is lowest. A cleanly-completed install makes subsequent ones cheap.

**Fix: make the script self-healing.** At the very START of post-merge.sh,
reap any ppid==1 process whose cmdline matches `typescript/bin/tsc` or
`pnpm install` (orphans from prior cancelled runs). ppid==1 is the safety
filter: a healthy prepare tsc is a short-lived child of pnpm (ppid!=1) and a
legitimate concurrent peer install is a child of its own post-merge script, so
neither is touched; tsserver/next-dev/services are never bare `tsc`/`pnpm
install` under init. SIGKILL can't be trapped, so start-of-run reaping is the
only reliable cleanup point; add a `trap '… pkill -P $$' TERM INT` too for the
graceful-cancel case. To clear a live wedge by hand: reap the same ppid==1
tsc/pnpm orphans, `kill -9` the `pnpm install` holding the lock fd, and
`rm -f /tmp/aivo-post-merge-install.lock`.

**Why bounded flock + reaping together:** flock `-w` serializes simultaneous
merges so each install runs ALONE with full headroom (instead of colliding and
all hitting the PID ceiling); reaping guarantees each run STARTS with maximum
headroom regardless of how the previous one died. Neither alone is enough.

## Fix / rules (all load-bearing; do not remove)

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
