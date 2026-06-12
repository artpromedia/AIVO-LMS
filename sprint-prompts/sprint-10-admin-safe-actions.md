# Sprint 10 — Admin operator safety: confirmations for destructive actions, feedback out of the URL

## Goal

At the end of this sprint, no destructive admin action (revoke, delete, disable, rotate) executes from a single click — each demands an explicit confirmation (type-to-confirm for irreversible credential cuts), and form feedback renders in an **accessible, non-navigating flash region with form state preserved**, instead of today's `redirect("?error=…")` round-trips. A CI gate keeps future destructive actions from shipping unconfirmed. Closes audit gap **M1 (⚠️)** — verified: zero `confirm(`/`AlertDialog`/`ConfirmDialog` matches across `apps/web-admin` and `packages/admin-ui`; error strings travel as URL query params (`apps/web-admin/app/platform/security/controls/page.tsx:30-33`).

## Context

- **App shape:** `apps/web-admin` is Next.js 15, **server-first** (only ~6 client components; the largest is `app/district/sis/scim-section.tsx`). React 19 — `useActionState` is available for action-state-without-navigation. Auth/roles via `packages/admin-auth` (`requirePageRole`, `requirePagePermission` — `src/server.ts:101-137`). All mutations call `@aivo/admin-api` (`packages/admin-api/src/client.ts` — throws `AdminApiError`; backend `admin-svc` writes the hash-chained audit log per privileged action).
- **House feedback pattern today:** server action validates → `redirect("/page?error=<msg>")` or `?notice=` → page renders `<p className="admin-error">{params.error}</p>` (see `security/controls/page.tsx:17-50` for the canonical create/status-update pair, and `lib/action-errors.ts:19` for the logging helper).
- **Verified destructive one-clicks to convert (the demonstration set):**
  1. SCIM token revoke — `apps/web-admin/app/district/sis/scim-section.tsx:117-127` (client component, optimistic, no confirm).
  2. District-admin invite revoke — `apps/web-admin/app/platform/districts/page.tsx` (invite lifecycle incl. revoke) and parent-invite revoke in `apps/web-admin/app/district/parents/page.tsx`.
  3. API key revoke/rotate — `apps/web-admin/app/platform/settings/api-keys/page.tsx`.
  4. Webhook endpoint disable — `apps/web-admin/app/platform/settings/webhooks/page.tsx`.
  Open each page first and enumerate its mutating server actions; anything matching revoke/delete/disable/rotate joins the set.
- **Component kit:** `packages/admin-ui/src/` (`index.tsx`, `AdminKpiCard.tsx`, `data-table.tsx`, `charts/`). **No Radix anywhere in admin deps — do not add it.** Use the native `<dialog>` element (`showModal()` gives focus trap + Esc + backdrop for free) styled with the existing `.admin-*` classes from `apps/web-admin/app/globals.css`. Styling stays in the `.admin-*` token system — no raw hex beyond what `globals.css` already defines.
- **e2e:** admin specs live at root `e2e/specs/admin/*.spec.ts` and run against `docker-compose.e2e.yml` (boots `web-admin` + `identity-svc` + `admin-svc` + Postgres; CI job `sprint12-e2e`, `.github/workflows/ci.yml:742`). Follow an existing spec (e.g., `pilot-provision.spec.ts`) for login/session plumbing.
- **CI gate precedent:** `scripts/ci/check-no-coming-soon.mjs` + manifest-style configs (`scripts/ci/gate-manifest.json`).

## Work orders

### DELETE
- None up front (each one-click path is replaced in-place by the confirm flow; no orphaned code may remain after conversion).

### CREATE
1. `packages/admin-ui/src/ConfirmDangerDialog.tsx` — client component on native `<dialog>`:
   - props: `{ title, body, confirmLabel, requireTypedValue?: string, children }` — wraps a server-action `<form>`; intercepts submit, `showModal()`s, and only dispatches the real form action on confirm. When `requireTypedValue` is set (token/key revocation), the confirm button stays disabled until the operator types the resource name/id exactly.
   - a11y: `aria-labelledby`/`aria-describedby` wired to title/body; initial focus on Cancel; `role` semantics native to `<dialog>`; Esc cancels; works without JS by degrading to a two-step confirm page **or** (acceptable fallback) rendering the form's native submit — pick one, implement it fully, and state the choice in the checkpoint.
   - Export from `packages/admin-ui/src/index.tsx`. Unit-test open/confirm/cancel/typed-gate.
2. `packages/admin-ui/src/FlashRegion.tsx` — renders action results: `aria-live="polite"` for notices, `role="alert"` for errors, styled `.admin-notice`/`.admin-error`; accepts `{ state }` from `useActionState` consumers **and** falls back to reading `?error=`/`?notice=` so unconverted pages keep working during migration.
3. `scripts/ci/check-admin-destructive-confirm.mjs` + `scripts/ci/admin-destructive-allowlist.json` — scans `apps/web-admin/app/**` for server actions whose exported/declared name or form intent matches `/revoke|delete|disable|rotate/i`; the containing file must import `ConfirmDangerDialog`, else the gate fails. Allowlist starts **empty** (the demonstration set is fully converted this sprint); wire as a step in the `lint-and-typecheck` job of `.github/workflows/ci.yml`, no `continue-on-error`.
4. `e2e/specs/admin/destructive-confirm.spec.ts` — compose-lane spec: attempt an invite revoke → dialog appears → cancel leaves the invite intact → confirm (typed value where required) revokes it → the audit log (reuse the read pattern from `e2e/specs/admin/audit-reads.spec.ts`) shows the action.

### REFACTOR
1. `apps/web-admin/app/district/sis/scim-section.tsx:117-127` — wrap `revoke(id)` in `ConfirmDangerDialog` with `requireTypedValue` = the token name; keep the optimistic refresh on confirm; surface failures through `FlashRegion` instead of the local error paragraph.
2. The server-action pages in the demonstration set (districts invites, parent invites, api-keys, webhooks) — convert each destructive form to `useActionState` + `ConfirmDangerDialog` + `FlashRegion`: errors render without navigation and the surrounding form inputs keep their values. Non-destructive forms on the same pages may stay on the redirect pattern (do not boil the ocean), but route their display through `FlashRegion` for consistency where it's a one-line change.
3. `apps/web-admin/app/platform/security/controls/page.tsx` — the create + status-update forms adopt `useActionState` + `FlashRegion` (this is the canonical pattern page others copy; leaving it on URL-params would propagate the old pattern).

### EDIT
1. `apps/web-admin/app/globals.css` — add the minimal `.admin-dialog*` styles for the native dialog (reuse existing tokens/vars only).
2. Field-level errors on the converted forms: associate via `aria-describedby` + `aria-invalid` (the audit flagged admin forms as page-level-error-only).
3. `README.md` admin section (or `docs/` admin doc if present): three lines documenting the destructive-action rule + the CI gate.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Compose run (`docker compose -f docker-compose.e2e.yml up …` per the `sprint12-e2e` job steps), then in the booted admin: revoking a SCIM token demands typing its name; canceling does nothing; confirming revokes + flashes success without a full navigation; an intentionally failing action (e.g., revoke an already-revoked invite) shows the error in the `role="alert"` flash with the form state intact.
2. `node scripts/ci/check-admin-destructive-confirm.mjs` green with an **empty allowlist**; negative proof: temporarily add an unconfirmed `deleteX` action in a scratch file → gate fails → remove.
3. `e2e/specs/admin/destructive-confirm.spec.ts` green in the compose lane (locally if Docker available, else on the PR's CI run — state which).
4. `corepack pnpm --filter @aivo/web-admin typecheck && corepack pnpm --filter @aivo/web-admin lint && corepack pnpm --filter @aivo/web-admin test` green; `packages/admin-ui` tests green including the new dialog tests.
5. Axe coverage from Sprint 02's admin specs still green (the dialog must introduce no violations).

## Tests

- New: `ConfirmDangerDialog` + `FlashRegion` unit tests (admin-ui), `destructive-confirm.spec.ts` (compose).
- Update: any admin spec that previously one-clicked a revoke (search `e2e/specs/admin` for revoke flows).
- Run the full admin unit suite + the admin compose lane; green stays green.

## Out of scope

- Bulk actions and table ergonomics (Sprint 11 — it will consume `ConfirmDangerDialog`). Toast systems from web-v2 (admin keeps its own `.admin-*` flash idiom). Undo/soft-delete semantics (server-side change — note as follow-up if requested). Admin i18n (decision-gated). Non-destructive form modernization beyond the listed pages.

## Depends on

Nothing hard. **Sprint 11 depends on this sprint** (bulk ops need the confirm dialog).

## Checkpoint

Summarize: the destructive-action inventory found (file → action → conversion status — must be 100% converted or explicitly non-destructive), dialog/flash API, gate output incl. negative proof, compose e2e results. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**
