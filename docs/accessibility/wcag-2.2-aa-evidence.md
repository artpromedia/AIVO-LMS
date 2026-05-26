# WCAG 2.2 AA evidence — learner pages

Sprint 15 introduced an axe-core audit covering 12 critical learner-facing
pages. This document captures the per-page audit evidence so any regression
can be traced back to a specific finding. Automated results come from
`e2e/tests/sprint15/screen-reader.spec.ts`; manual screen-reader notes live
under [`manual-evidence/`](./manual-evidence/README.md).

## Scope (12 critical learner pages)

| # | Page | Path |
|---|------|------|
| 1 | Learner home | `/learner/home` |
| 2 | Lesson player | `/learner/lesson-player-smoke` |
| 3 | Baseline assessment | `/learner/baseline` |
| 4 | AAC board | `/learner/aac` |
| 5 | Accessibility settings | `/learner/settings/accessibility` |
| 6 | Today's mission | `/learner/missions` |
| 7 | Homework | `/learner/homework` |
| 8 | Quest | `/learner/quests` |
| 9 | Progress | `/learner/progress` |
| 10 | Family chat | `/parent/notifications` |
| 11 | Problem session (AI tutor) | `/learner/tutor` |
| 12 | Voice response | `/learner/lesson-player-fixture` |

## How the audit runs

```bash
# Bring up the web app on http://localhost:5000 first.
pnpm --filter @aivo/web-v2 dev

# In another shell, run the axe-core suite.
pnpm --filter @aivo/e2e exec playwright test e2e/tests/sprint15/screen-reader.spec.ts

# Keyboard navigation check (no playwright project install required).
node scripts/ci/keyboard-nav-check.mjs
```

CI runs both as blocking steps via `.github/workflows/accessibility.yml`.

## Per-page audit template

Each entry below is filled in by the latest run of the axe-core spec. When a
violation cannot be remediated within the sprint, move it to the
[Known violations](#known-violations) section and add it to the
`ACCEPTED_VIOLATIONS` allow-list in `screen-reader.spec.ts` so we don't
keep flagging the same finding.

### 1. Learner home (`/learner/home`)

- **Axe-core ruleset**: `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`
- **Violations**: _Filled in by CI_
- **Notes**: workspace rail is the primary nav; ensure tab order is rail → primary content.

### 2. Lesson player (`/learner/lesson-player-smoke`)

- **Violations**: _Filled in by CI_
- **Notes**: confirm captions container is mounted for video/audio beats.

### 3. Baseline assessment (`/learner/baseline`)

- **Violations**: _Filled in by CI_
- **Notes**: assistive readiness gate copy must be announced (aria-live polite).

### 4. AAC board (`/learner/aac`)

- **Violations**: _Filled in by CI_
- **Notes**: grid uses `role="grid"`; tiles must meet 44×44 CSS px target size.

### 5. Accessibility settings (`/learner/settings/accessibility`)

- **Violations**: _Filled in by CI_
- **Notes**: switches are `<input type="checkbox" role="switch">` with `aria-describedby`.

### 6. Today's mission (`/learner/missions`)

- **Violations**: _Filled in by CI_

### 7. Homework (`/learner/homework`)

- **Violations**: _Filled in by CI_

### 8. Quest (`/learner/quests`)

- **Violations**: _Filled in by CI_

### 9. Progress (`/learner/progress`)

- **Violations**: _Filled in by CI_

### 10. Family chat (`/parent/notifications`)

- **Violations**: _Filled in by CI_
- **Notes**: parent surface but reachable from learner shell; included for parity.

### 11. Problem session (`/learner/tutor`)

- **Violations**: _Filled in by CI_

### 12. Voice response (`/learner/lesson-player-fixture`)

- **Violations**: _Filled in by CI_
- **Notes**: mic permission prompt must be announced via aria-live.

## Known violations

| Rule | Page(s) | Severity | Remediation owner | Notes |
|------|---------|----------|-------------------|-------|
| _none accepted as of Sprint 15_ | — | — | — | — |

When an exception is added here it must also be added to `ACCEPTED_VIOLATIONS`
in `e2e/tests/sprint15/screen-reader.spec.ts`. The accessibility owner
reviews the list each sprint.

## Output schema (axe-core)

```jsonc
{
  "violations": [
    {
      "id": "color-contrast",
      "impact": "serious",
      "help": "Elements must have sufficient color contrast",
      "helpUrl": "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
      "nodes": [{ "target": ["#submit"], "html": "<button id=\"submit\">…</button>" }]
    }
  ]
}
```
