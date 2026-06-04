# Plan — Eliminate NOT-IMPLEMENTED gates in `green:check`

**Status:** 2026-06-04 — drafted by release-captain after green:check reached `YELLOW` (29/29 required PASS, 4 NOT-IMPLEMENTED).

**Goal:** turn the 4 placeholder gates into real, enforced, required gates so that `pnpm green:check` can exit `GREEN` instead of `YELLOW`.

## Constraint

> "We cannot afford any placeholders."

All four gates must (a) have a real implementation script under `scripts/`, (b) be wired into `package.json`, (c) be flipped to `required: true` in `scripts/green-check.mjs`, and (d) be added to `scripts/ci/gate-manifest.json` so the doc-vs-gate consistency check keeps passing.

## The 4 placeholders

| Placeholder         | Owner sprint | Backlog ID | Current state                                                                      |
| ------------------- | ------------ | ---------- | ---------------------------------------------------------------------------------- |
| `mobile:role-audit` | GREEN-07     | P2-207     | `mobile:audit` exists but covers feature-flag + scaffold only                      |
| `ux:parity`         | GREEN-08     | P2-208     | `web:parity` (mobile-parity-check.mjs) exists; cross-role UX matrix does not       |
| `a11y:audit`        | GREEN-09     | P2-209     | `accessibility:audit` covers prefs/TTS/AAC scaffold only — no axe/keyboard/SR runs |
| `security:audit`    | GREEN-12     | P2-212     | No script exists                                                                   |

---

## Phase 1 — `mobile:role-audit` (smallest, fastest win)

**What it must enforce** (per `docs/mobile/unified-app-contract.md`):

1. Single shell: `apps/mobile/app/_layout.tsx` wraps the tree in `<RoleProvider>`.
2. Every BFF call from mobile passes `ACTIVE_ROLE_HEADER` ("x-aivo-active-role").
3. Role chooser route exists at `apps/mobile/app/(auth)/select-role.tsx` and lists exactly the 5 roles.
4. Role-pill component exists, is rendered by the unified shell header, and reads from `useRole()`.
5. Legacy `(parent)`, `(learner)`, `(teacher)`, `(therapist)`, `(caregiver)` route groups eventually go away — keep the soft warning until the migration completes, then flip to hard error.

**Deliverables**

- New `scripts/mobile-role-audit.mjs` (~150 LoC, mirrors structure of `mobile-unified-audit.mjs`).
- New script `mobile:role-audit` in `package.json`.
- `scripts/green-check.mjs`: change gate `mobile:role-audit` from `{ status: "not-implemented" }` to `{ script: "mobile:role-audit", required: true }`.
- Manifest update + allowlist re-bake.

**Definition of done:** `pnpm mobile:role-audit` exits 0; `pnpm green:check` shows it as PASS not NOT-IMPLEMENTED.

**Effort:** 1 small commit. No external deps.

---

## Phase 2 — `ux:parity` (largest payoff, modest cost)

**What it must enforce** (per `docs/quality/ux-parity-matrix.md` and `docs/ux/UX-01-information-architecture.md`):

1. The existing `docs/quality/ux-parity-matrix.md` row count matches the actual route count per role on web-v2 and mobile.
2. Every web-v2 page that has `data-ux-id="..."` has a mobile counterpart with the same `testID` and same role assignment.
3. Design-system primitives are used: no `<button>` outside `@aivo/ui` packages in shipping role routes (admin/dev excluded — same exclusion list as `mobile:parity:strict`).
4. Per-role colour token and motion preset assignment is consistent with `docs/design-language/tokens.md`.

**Deliverables**

- New `scripts/ux-parity-check.mjs` (~250 LoC). Reuses the parity-matrix loader from `scripts/mobile-parity-check.mjs`.
- Replace the empty `web:parity OK` stub line with the union of mobile-parity-strict + UX matrix walk.
- Wire `ux:parity` script in `package.json`.
- Flip the gate to required.
- Manifest + allowlist update.

**Risks**

- The existing matrix may have stale rows. First run will produce noise; we ratchet it down to zero before flipping required.

**Effort:** 1 medium commit. Ratchet pattern matches what we already use for i18n.

---

## Phase 3 — `a11y:audit` (real axe + keyboard + reduced-motion)

**What it must enforce** (per `docs/accessibility/vpat-readiness.md`):

1. Axe-core run against the 18 shipping web-v2 role pages enumerated in the matrix; serious + critical violations = failure.
2. Keyboard-only flow: tab order is non-empty for the auth + onboarding + lesson-runner pages (Playwright trace).
3. Reduced-motion snapshot diff: render `learner/lesson` with `prefers-reduced-motion: reduce` and compare to baseline — no animation diff allowed.
4. AAC + screen-reader contract: each `aria-live` region is paired with a matching `<TutorSurface>` event in tutor-svc fixtures.

**Deliverables**

- New `scripts/a11y-audit.mjs` orchestrator that shells into:
  - `pnpm exec playwright test e2e/a11y-axe.spec.ts` (new — uses @axe-core/playwright)
  - `pnpm exec playwright test e2e/a11y-keyboard.spec.ts` (new)
  - `pnpm exec playwright test e2e/a11y-reduced-motion.spec.ts` (new)
- New devDep: `@axe-core/playwright` (Playwright + e2e infra already exist under `e2e/`).
- Baseline snapshots committed under `artifacts/a11y/baseline/`.
- `a11y:audit` script in `package.json`.
- Flip gate to required.

**Risks**

- This is the only phase that needs CI compute (Playwright). Locally we ratchet against the baseline; CI is the source of truth.
- First baseline must come from a clean run on a Linux runner — easier than fighting Windows-specific font rendering for the snapshot diff.

**Effort:** 1 large commit + 1 follow-up commit per ratchet step. Real engineering hours.

---

## Phase 4 — `security:audit` (longest tail; ship in tiers)

**What it must enforce** (per `docs/security/threat-model.md`, `docs/security/soc2-readiness.md`):

- **Tier A — static (lands first):**
  - `pnpm exec gitleaks detect --redact --no-banner` exits 0.
  - `pnpm audit --audit-level=high` exits 0 (or every finding is in a deliberate `.npm-audit-ignore` with expiration).
  - `pnpm exec semgrep --config p/owasp-top-ten apps services packages` exits 0 (curated rules to keep false-positive rate low).
  - All `httpOnly: true`, `sameSite: "strict|lax"`, and CSP-header set sites are verified by a grep + AST pass (mirrors `consent-gate-audit.mjs`).
- **Tier B — operational (lands second, behind a follow-up gate `security:audit:ops`):**
  - Encryption-at-rest config asserted in Bicep/Terraform (separate repo if applicable).
  - Key rotation schedule asserted in `docs/runbooks/secret-history-rotation.md` + a freshness check against `last_rotated_at`.
  - Backup-restore drill log under `docs/runbooks/audit-restore.md` is dated within last 90 days.

**Deliverables (Tier A only — what closes the green:check placeholder)**

- New `scripts/security-audit.mjs` orchestrator.
- New devDeps: `@gitleaks/cli` wrapper or invoke prebuilt binary; `semgrep` (CI-only — locally we accept "skip if not installed" so Windows dev loop stays fast).
- `security:audit` script in `package.json`.
- Flip gate to required (with a documented escape valve for Tier B until follow-up lands).
- File issue #66 to track Tier B.

**Risks**

- Semgrep + gitleaks both have non-trivial install footprints. We'll need them on the CI runner, and `security:audit` should detect missing binaries and exit with a clear error instead of silently passing.

**Effort:** Tier A is 1 medium commit + tooling install. Tier B is a separate sprint and **stays open** as backlog after the placeholder is gone.

---

## Ordering

1. **Phase 1 — `mobile:role-audit`** — quickest, unblocks the YELLOW→GREEN narrative for the mobile sprint.
2. **Phase 2 — `ux:parity`** — biggest signal-to-noise improvement.
3. **Phase 3 — `a11y:audit`** — legal/compliance lever for VPAT.
4. **Phase 4 — `security:audit`** — most external dependencies; can run in parallel with Phase 3 once tooling is provisioned.

After each phase: re-run `pnpm green:check`, expect the NOT-IMPLEMENTED count to drop by exactly 1.

## When all four are done

- `scripts/green-check.mjs`: zero gates with `status: "not-implemented"`.
- `pnpm green:check` exits 0 with **"Result: GREEN"** (no longer YELLOW).
- `docs/quality/red-to-green-backlog.md` rows P2-207, P2-208, P2-209, P2-212 are struck through and dated.
- `scripts/ci/gate-manifest.json` updated; `node scripts/ci/doc-vs-gate-consistency.mjs` still exits 0.
- Signoff `docs/ENTERPRISE_READINESS_SIGNOFF_2026-06.md` row 23 (green:check) is promoted from YELLOW to GREEN with the new commit SHA as evidence.

## Things this plan deliberately does **not** include

- Re-architecting `mobile:audit` (it stays — it's the scaffold lens; `mobile:role-audit` is the runtime-role lens).
- Replacing `accessibility:audit` (stays — different layer; `a11y:audit` is the dynamic axe/keyboard/SR lens).
- Adding new CI infrastructure beyond what `e2e/` already requires.
- Auto-fixing real findings — the gates only **measure**. Each ratchet step is a separate PR.
