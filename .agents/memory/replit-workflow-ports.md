---
name: Replit workflow port detection (AIVO monorepo)
description: Why dev-server workflows fail with DIDNT_OPEN_A_PORT even when the server is healthy, and how to pick a working port.
---

# Replit workflow `waitForPort` / DIDNT_OPEN_A_PORT

A workflow's readiness probe (`waitForPort`) is satisfied only when the process
opens a **local** port that is **declared as a `localPort`** in `.replit`'s
`[[ports]]`, and `waitForPort` is set to that same number.

**Why:** During this migration, the Marketing (Next dev) and Mockup (vite)
workflows kept failing with `DIDNT_OPEN_A_PORT` on `5173` / `8000` even though
the servers compiled, served HTTP 200, and a warmup curl succeeded. Root cause:
`5173` and `8000` appear in `.replit` only as `externalPort` *targets*
(`3004 -> 5173`, `3014 -> 8000`), not as declared `localPort`s. The supervisor
watches declared local ports, so a listener on an undeclared port is invisible
to it. Binding to the mapped `localPort` (e.g. 3004) but leaving
`waitForPort = 5173` also fails — the probe number itself must be a declared
clean port.

**How to apply:** Make a dev server bind a "clean" declared port where
`localPort == externalPort`, and set the workflow `waitForPort` to that number.
The working core workflows follow this: Web App→5000, Brain→3002,
Identity→3001. The only other free clean declared port here was **3003**, which
Marketing now uses. `configureWorkflow` only accepts a fixed supported set
(intersection with free declared clean ports was just 3003), so clean ports are
scarce — don't waste them.

Other notes for this repl:
- `.replit` is tool-managed; edit ports/workflows via `configureWorkflow` /
  `removeWorkflow`, not by editing the file.
- Long installs MUST run as a Replit workflow; detached/`setsid`/`nohup`
  processes get reaped between bash tool calls.
- `artifacts/mockup-sandbox` is OUTSIDE the pnpm workspace — install its deps
  with `cd artifacts/mockup-sandbox && pnpm install --ignore-workspace`.
- The platform "Component Preview Server" canvas tool wants port 3014, which
  collides with the Identity fleet's `status-page-svc` (also 3014); it's an
  on-demand canvas tool, not part of the product run path.
