# UX-14 — Accessibility, Inclusive Design, and WCAG Audit

> **Last refreshed**: 2026-05-17 — drafted in this sprint.
>
> **Source of truth.** Grounded in `apps/web-v2/app/globals.css` (`:focus-visible` token at line 38), `apps/web-v2/components/ui/*` (19 primitives), `apps/web-v2/components/learner/accessibility-form.tsx`, `apps/web-v2/app/learner/settings/{accessibility,audio}`, `apps/web-v2/app/parent/learners/[id]/accessibility{,/audio}`, and the per-role theme contract in `lib/design/theme.ts`. AIVO targets **WCAG 2.2 AA** (every shipped surface) with **AAA aspirations** for the learner Stage and baseline runner (one-task screens used by neurodiverse learners).
>
> **Status legend:** ✅ shipped · 🟡 partial · ⬜ planned.

---

## 1. Why accessibility is not a separate sprint

AIVO's primary audience is neurodiverse learners. Accessibility is the product, not a checklist applied at the end. Every UX-0x sprint already calls out a11y inline. This doc collects the cross-cutting contract, the audit method, and the gap list.

---

## 2. WCAG 2.2 AA conformance summary

| Principle | Status | Where covered |
|---|---|---|
| **Perceivable** — text alternatives, captions, contrast, resize, reflow | 🟡 | Per-role themes meet 4.5:1 body / 3:1 large; captions default-on planned (DD-13) |
| **Operable** — keyboard, focus visible, no seizure risk, skip links, page titled, focus order, link purpose | 🟡 | Global `:focus-visible` token shipped; skip link claimed in `replit.md` but not present in `components/layout` (gap) |
| **Understandable** — language, predictable, input assistance, error identification + suggestion | 🟡 | `next-intl` shipped 10 locales; inline form errors are toast-only on most settings forms (gap) |
| **Robust** — name/role/value, status messages, parsing | 🟡 | Primitives wrap Radix where used; `aria-live` is inconsistent (UX-00 §6 a11y risk) |

**Headline gaps** (from UX-00 §6 + this audit):
- A1. **Skip link is not actually rendered** in `app/layout.tsx` / `components/layout/app-shell.tsx`. `replit.md` mentions it but the component file is absent. P0.
- A2. `aria-live` regions for AI generation, save status, and toast are inconsistent. P0 — see UX-15.
- A3. Form-error association (`aria-describedby` → inline error id) is missing on most settings forms; errors live in a toast only. P1.
- A4. Reduced-motion gating is not wired into Stage / quest / baseline animations. P1.
- A5. Per-theme `:focus-visible` outline contrast on dark sidebars (learner, platform) not verified at 3:1. P1.
- A6. Tab order in admin data tables (37 tables) not re-verified after S31 additions. P2.

---

## 3. Accessibility modes

AIVO ships modes a learner / parent / teacher can toggle. Each mode is a **persistent preference** (web: cookie + `apps/web-v2/lib/learner/accessibility-prefs.ts`; mobile: device storage).

| Mode | Toggle path (web) | Implementation | Status |
|---|---|---|---|
| Large text scale | `/learner/settings/accessibility` and `/settings/accessibility` | Adds `data-text-scale="large"` on `<html>`; primitives respect via CSS var | ✅ wired, ⬜ planned scale variants beyond default/large |
| Dyslexia-friendly font | same | Loads OpenDyslexic via `@font-face`; toggles `data-font="dyslexic"` | ⬜ planned (DD-13) |
| Reduced motion | same | `data-motion="reduced"` honored by Stage / quest animations | ⬜ planned (DD-13); CSS `@media (prefers-reduced-motion: reduce)` is honored by base primitives |
| High contrast | same | Per-theme variant (DD-14, P2) | ⬜ planned |
| Captions default on | per-learner preference at `/parent/learners/[id]/accessibility` | Any media component reads the preference | 🟡 preference stored, ⬜ no media components yet |
| TTS read-aloud | `/parent/learners/[id]/accessibility/audio` | `audioPreferences.ttsVoice`, `ttsRate`, `readAloudDefaults` | 🟡 (preferences shipped; TTS playback ⬜) |
| Switch / AAC input | per-learner preference | Tap-anywhere mode in Stage | ⬜ |

The accessibility settings page itself is a model for the contract: every field has an explicit label, every group is a `<fieldset>` with `<legend>`, every change posts immediately (no "Save" button — autosave with a status pill). See `components/learner/accessibility-form.tsx`.

---

## 4. Per-component a11y contract

Every primitive in `components/ui/*` (Button, Input, Textarea, Select, Checkbox, RadioGroup, Tabs, Card, Dialog, Drawer, Toast, Alert, Badge, Tooltip, Progress, Stepper, EmptyState, ErrorState, Skeleton) follows this contract:

1. **Name** — explicit `aria-label` or visible `<label>` association via `htmlFor` / `aria-labelledby`. No bare `<input>` ever.
2. **Role** — semantics first (`<button>` not `<div role="button">`); role attribute only when no native equivalent exists.
3. **State** — `aria-disabled` / `aria-pressed` / `aria-expanded` / `aria-checked` / `aria-current` / `aria-invalid` set as appropriate.
4. **Focus** — visible focus via the global `:focus-visible` token; never `outline: none` without a replacement.
5. **Live regions** — Toast roots are `role="status" aria-live="polite"`; error toasts are `role="alert"`. Save-status text is `aria-live="polite"`.
6. **Touch target** — minimum 44×44 CSS pixels (WCAG 2.5.5 AAA preferred 44×44 — adopted as default on web; mobile uses 56pt).
7. **Color** — never the only signal. Badge tones carry text labels; mastery levels carry words not just bar colors.

When a primitive doesn't yet meet the contract, the gap is tracked in `docs/ux/a11y-gaps.md` (⬜ planned file — create as part of this sprint's deliverables).

---

## 5. Per-surface a11y notes

| Surface | Special considerations |
|---|---|
| Parent assessment wizard | `<RadioGroup>` is `<fieldset>` + `<legend>`; `<Progress>` for step count has `aria-label="Step X of Y"` (UX-04 §4.5) |
| IEP upload | File input is keyboard-reachable; drop zone has `role="button" tabIndex={0}` + Enter/Space activation |
| Brain profile | Read-only card; `xaiExplanation` paragraph wrapped in `<p>` not `<div>` for screen-reader semantics; "Regenerate" disclosure uses `<details>` |
| Baseline runner | One question full-width, large text by default; hint Card is keyboard-reachable; "Submit answer" button keeps focus until next question is announced via `aria-live` (UX-07 §3) |
| Lesson Player (Stage) | Skip link to "Exit lesson"; beat transitions announced via `aria-live="polite"`; no auto-advancing content (WCAG 2.2.1); reduced-motion gates beat animations |
| Homework Helper | Chat thread is a `role="log" aria-live="polite"`; input retains focus after send; thinking indicator is text not animation |
| Admin tables | Header cells `scope="col"`; row actions reachable in tab order; filter chips are buttons with `aria-pressed`; pagination announces "Page X of Y" |
| Notifications | Toast container `role="status"`; unread badge has accessible text (e.g., "3 unread") |

---

## 6. Cognitive & sensory inclusion (beyond WCAG)

WCAG covers visual / motor / auditory. AIVO's audience also needs explicit support for cognitive load, sensory regulation, and emotional safety:

- **One task at a time.** Stage shows one beat; baseline shows one question; homework shows one chat turn. No multi-column lesson layouts.
- **Plain language.** Parent copy at ~grade 7; learner copy at ~grade 3. No clinical terms in learner copy (no "diagnostic", "deficit", "score", "fail", "broke your streak").
- **Sensory regulation.** Per-learner sensory profile (`/parent/learners/[id]/sensory`) feeds Stage palette, animation tempo, and audio defaults — a learner with sensory sensitivity gets muted colors and minimal motion by default.
- **Non-shaming streaks.** "Your streak rests today" instead of "You broke your streak". Audited across all learner copy (UX-00 LC-04).
- **Predictable navigation.** The same primary CTA shape on every Home variant; same back-button placement; same toast position.
- **Emotional safety.** Errors are never the learner's fault. "We had trouble loading your lesson — let's try again" never "Invalid input" or "Failed".

---

## 7. Automated coverage in CI

Existing:
- `pnpm i18n:audit` — locale-file parity, fails CI on missing keys.
- ESLint rule `jsx-a11y/*` — runs on every PR (verify in `eslint.config.js`).
- Lighthouse a11y score budget on the marketing site (⬜ planned for `apps/web-v2` per DD-10).

Planned (this sprint):
- **`pnpm a11y:audit`** — runs `@axe-core/cli` against the running dev server on a representative route set (one per role × one per state). Fails on any "serious" or "critical" violation.
- **`scripts/check-skip-link.mjs`** — asserts `<SkipLink href="#main">` is rendered before any role shell.
- **`scripts/check-aria-live.mjs`** — asserts every page that mounts a Toast also has a polite live region.
- **Playwright screen-reader trace** for the four critical journeys (parent onboarding, learner Stage, teacher learner detail, admin DSAR).

---

## 8. Manual audit method

Per release candidate, run these four passes on every shipped surface:

1. **Keyboard-only pass.** Unplug mouse. Reach every interactive element via Tab. Activate via Enter/Space. Confirm visible focus at every step.
2. **Screen-reader pass.** macOS VoiceOver + Safari (web) / iOS VoiceOver (mobile) / NVDA + Firefox (web). For each surface, read top to bottom; confirm name + role + state announced.
3. **200% zoom pass.** Browser zoom to 200%; confirm no content cut off, no horizontal scroll except in known data-table contexts.
4. **Reduced-motion pass.** OS-level reduced motion ON; confirm no parallax, no auto-playing animations, no flashing.

Audit results land in `docs/ux/a11y-audits/<date>.md` — one row per surface × pass × outcome.

---

## 9. Deliverables

1. ✅ This contract.
2. ⬜ Render the missing `<SkipLink>` in `components/layout/app-shell.tsx` and the four role shells.
3. ⬜ Wire reduced-motion + dyslexia-font modes (DD-13).
4. ⬜ Add `@axe-core` CI job + skip-link / aria-live scripts (§7).
5. ⬜ Audit the 14 surfaces in §5 manually and file gaps to `docs/ux/a11y-gaps.md`.

---

## 10. Acceptance criteria

- [ ] Every shipped surface passes a Tab-only walkthrough with no keyboard trap.
- [ ] Every form has inline error association (`aria-describedby`) — no toast-only errors.
- [ ] Reduced-motion preference disables all non-essential animation including Stage beat transitions.
- [ ] Dyslexia-friendly font mode is one toggle away.
- [ ] CI fails on a new serious/critical axe violation introduced by any PR.
- [ ] Learner copy contains no clinical terms (see UX-00 §8 audit list).
- [ ] All 14 role-aware Toast and live regions are reachable by SR.
- [ ] The parent and learner Stage flows pass an end-to-end VoiceOver run on macOS Safari and iOS.
