# Sprint UX-02 — Visual Design System and Component Library

**Scope**: One design system that drives `apps/web-v2` (Next.js 15 + Tailwind v4), one unified mobile app (`apps/mobile`, Expo SDK 54 — currently fragmented per UX-00 §11), and the tablet learner experience (web responsive).
**Source of truth (today)**: `apps/web-v2/app/globals.css` (5 role themes via `[data-theme]`), `apps/web-v2/components/ui/*` (19 primitives — see §4.1), `apps/web-v2/components/{layout,learner,parent,admin}/*` (domain composites). Anything below marked **⬜ planned** is a UX-02 backlog item, not currently in the codebase.
**Personality**: warm, calm, trustworthy, intelligent, friendly, school-credible, child-safe, neurodiversity-aware, modern-SaaS quality.

---

## 1. Color system

Tokens are defined as **OKLCH** in `@theme` and overridden per role via `[data-theme="parent|learner|teacher|admin|platform"]`. OKLCH is non-negotiable — perceptual lightness is what lets us shift hue per role without recomputing every contrast pair.

### 1.1 Base tokens (all themes)

| Token                                       | Role                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `--color-aivo-ink`                          | primary text                                           |
| `--color-aivo-ink-soft`                     | secondary text                                         |
| `--color-aivo-muted`                        | tertiary/helper text                                   |
| `--color-aivo-surface`                      | card / panel background                                |
| `--color-aivo-surface-2`                    | recessed background                                    |
| `--color-aivo-border`                       | hairlines                                              |
| `--color-aivo-primary`                      | role-tinted brand action                               |
| `--color-aivo-primary-fg`                   | text on primary                                        |
| `--color-aivo-primary-soft`                 | active/selected pill background                        |
| `--color-aivo-accent`                       | secondary accent (badges, charts)                      |
| `--color-aivo-success / warning / danger`   | state colors                                           |
| `--color-aivo-sidebar-{bg,fg,muted,border}` | sidebar chrome (lets us go dark on learner + platform) |
| `--color-aivo-page-bg`                      | the page background behind cards                       |

### 1.2 Role tints (current values — see globals.css)

| Role                          | Primary                    | Sidebar                  | Card radius | Density                   |
| ----------------------------- | -------------------------- | ------------------------ | ----------- | ------------------------- |
| **parent**                    | indigo 0.56 0.14 265       | warm cream               | 16px        | base                      |
| **learner**                   | sunny coral 0.65 0.22 30   | dark coral (FG light)    | 28px        | larger font + 1.75rem pad |
| **teacher**                   | calm teal 0.52 0.10 210    | light teal-gray          | 10px        | tighter                   |
| **admin** (school + district) | slate 0.45 0.08 250        | light slate              | 10px        | tighter                   |
| **platform**                  | utility blue 0.50 0.15 220 | **dark navy** (FG light) | 8px         | tighter                   |

### 1.3 State colors (semantic — same across themes)

| Token                              | Use                             | Sample copy                                           |
| ---------------------------------- | ------------------------------- | ----------------------------------------------------- |
| `success`                          | confirmed save, lesson complete | "Saved." · "Lesson complete."                         |
| `warning`                          | review queue, soft block        | "Needs review." · "Consent will expire in 14 days."   |
| `danger`                           | error, hard block               | "We couldn't save." · "Consent required to continue." |
| `info` (= primary-soft + ink-soft) | neutral context                 | "AI generated this — review before sending."          |

### 1.4 Focus

`*:focus-visible { outline: 3px solid var(--color-aivo-primary); outline-offset: 2px }` — already in `globals.css`. Per-theme overrides for dark sidebars (learner, platform) use `color-mix(sidebar-fg 18%)` for active nav items so focus + active are both legible on the dark chrome.

### 1.5 High-contrast variants ⬜ planned

Not in `globals.css` today. Spec: per role, define a `[data-theme="…"][data-contrast="high"]` block that:

- Pins `--color-aivo-ink` to `oklch(0.10 …)` and `--color-aivo-ink-soft` to `oklch(0.25 …)`.
- Pins `--color-aivo-border` to `oklch(0.40 …)` (no hairlines below 4.5:1 against surface).
- Replaces all `primary-soft` with `primary` directly + white text (no soft pills).
- Forces `:focus-visible` outline to 4px with an inner ring offset of 3px.

To be wired from `<html data-contrast={user.contrastMode}>` in `app/layout.tsx`, persisted in an `aivo_a11y` cookie set by `/settings/accessibility`. Neither the data attribute nor the cookie exist today — backlog item.

### 1.6 Reward / accent colors (learner only) ⬜ planned

Not in `globals.css` today. Spec: define only inside `[data-theme="learner"]` — never inherited by parent/teacher/admin surfaces (avoids "gamified-everywhere" feel).

| Token                                              | Use                 |
| -------------------------------------------------- | ------------------- |
| `--color-aivo-reward-coin` `oklch(0.78 0.18 75)`   | coins, currency     |
| `--color-aivo-reward-streak` `oklch(0.65 0.20 30)` | streak              |
| `--color-aivo-reward-quest` `oklch(0.62 0.18 150)` | quest progress      |
| `--color-aivo-reward-badge` `oklch(0.70 0.17 280)` | unlocked badge halo |

### 1.7 Mobile role-mode accents

Single design system. The role-mode **switcher** chip and the active-mode tab indicator color comes from `--color-aivo-primary` of that role's theme. Each tab navigator wraps its content tree in `data-theme={activeRoleMode}` so the OKLCH tokens drive native styles via a token bridge — see §9.1 (planned).

---

## 2. Typography

### 2.1 Type families

| Family                         | Use                                              | Status                 |
| ------------------------------ | ------------------------------------------------ | ---------------------- |
| **Fredoka** (`--font-display`) | display headings; primary face for learner theme | ✅ shipped in `@theme` |
| **Nunito** (`--font-sans`)     | body text everywhere except learner shell        | ✅ shipped in `@theme` |
| `ui-monospace`                 | platform-admin IDs, audit logs                   | ✅ ambient             |
| **OpenDyslexic** _(DD-13)_     | optional dyslexia-friendly text mode             | ⬜ planned             |

Mode wiring (⬜ planned): `<html data-typeface="default|dyslexic">` swaps `--font-sans` and tightens letter-spacing to `0.03em` + line-height to `1.7`. Neither the attribute nor an OpenDyslexic `@font-face` is in the codebase today.

### 2.2 Scale (tokenized)

Density tokens per role (already shipping):

| Token                      | parent   | learner   | teacher   | admin     | platform  |
| -------------------------- | -------- | --------- | --------- | --------- | --------- |
| `--aivo-density-base-font` | 1rem     | 1.0625rem | 0.9375rem | 0.9375rem | 0.9375rem |
| `--aivo-density-h1-font`   | 1.875rem | 2.25rem   | 1.625rem  | 1.625rem  | 1.625rem  |
| `--aivo-density-card-pad`  | 1.25rem  | 1.75rem   | 1rem      | 1rem      | 1rem      |

Heading scale (per-theme `h1` is bound; `h2`–`h4` use Tailwind utilities):

- `h2`: `1.5 * base`, `line-height: 1.25`
- `h3`: `1.25 * base`, `line-height: 1.3`
- `h4`: `1.1 * base`, `line-height: 1.4`
- `body`: `1.5 * base` line-height (parent/admin) or `1.6` (learner).

### 2.3 Mobile scale

Multiplier `0.95` applied to all `--aivo-density-*` when viewport `< 600px`. Learner Mode keeps `1.0625rem` body to preserve neurodiversity targets.

### 2.4 Admin data scale

Inside `<DataTable>`: `--aivo-density-base-font: 0.875rem`, tabular numbers via `font-variant-numeric: tabular-nums`, row height `40px`.

### 2.5 Paragraph rules

- Max line length `72ch` for parent/teacher/admin copy; `60ch` for learner.
- Avoid all-caps except in `--font-display` micro-labels ≤ 12px.
- Letter-spacing: `0` default; `0.03em` in dyslexic mode; `0.06em` for all-caps labels.

---

## 3. Spacing and layout

### 3.1 Spacing scale

Use Tailwind's `space-*` scale (4px base). The role density tokens already shift card padding; everything else uses `gap-2 / 3 / 4 / 6 / 8` (8/12/16/24/32px).

### 3.2 Grids

| Surface                 | Columns                      | Gutter  | Max width                            |
| ----------------------- | ---------------------------- | ------- | ------------------------------------ |
| Parent home (desktop)   | 12                           | `gap-6` | 1200px                               |
| Parent home (tablet)    | 8                            | `gap-4` | 100%                                 |
| Learner home (one-task) | 1 (centered)                 | n/a     | 720px                                |
| Lesson player (Stage)   | full-bleed centered          | n/a     | 1024px content, full-viewport canvas |
| Teacher class detail    | 12 (8/4 split)               | `gap-6` | 1280px                               |
| Admin dense data        | 12 (with sticky filter rail) | `gap-3` | 1440px                               |
| Mobile role shell       | 1                            | `gap-4` | 100% (max 480px on phablet)          |

### 3.3 Role-specific layouts

- **Learner "one-task" layout**: a single primary card centered vertically + horizontally; nothing else above the fold competes for attention.
- **Parent card layout**: a learner rail (top), an inbox card (left 8/12), a recent-activity card (right 4/12).
- **Teacher class layout**: needs-attention rail (top, full width), roster table (full width below).
- **Admin dense data**: sticky filter bar (top), table fills remaining height with sticky header + virtualized rows.
- **Unified mobile role shell**: top safe-area + page title + content scroll + bottom tab nav (5 tabs max per mode) + role-switcher tile in the avatar drawer.

---

## 4. Component library

Status legend: ✅ shipped · 🟡 partial · ⬜ planned.

### 4.1 Primitives (`components/ui/*` — 19 files today)

Status reflects what's actually in the file as of this sprint. "Variants" lists shipped CVA variants; gaps are explicit so this table can't drift.

| File                  | Status     | Shipped surface                                                                                                                                                                                                                                                                        |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `button.tsx`          | ✅         | CVA: variants `default · outline · ghost · soft · danger`; sizes `sm · md · lg · icon`; `asChild` Slot. **No `loading` prop today** (callers spin manually); **no built-in focus ring** — Button sets `focus-visible:outline-none` and relies on the global `*:focus-visible` outline. |
| `input.tsx`           | ✅         | One styled input with `focus-visible:ring-2 ring-aivo-primary` + `disabled` opacity. No CVA invalid variant — invalid state is communicated via Label + helper text.                                                                                                                   |
| `textarea.tsx`        | ✅         | Mirrors Input. No autosize.                                                                                                                                                                                                                                                            |
| `select.tsx`          | ✅         | Native select. No Combobox.                                                                                                                                                                                                                                                            |
| `checkbox.tsx`        | ✅         | Radix-backed; default / checked / indeterminate / disabled.                                                                                                                                                                                                                            |
| `radio-group.tsx`     | ✅         | Radix-backed, `<fieldset>` semantics expected at the call site.                                                                                                                                                                                                                        |
| `card.tsx`            | ✅         | Reads `--radius-card` + `--aivo-density-card-pad` from theme.                                                                                                                                                                                                                          |
| `tabs.tsx`            | ✅         | Radix Tabs with one TabsList visual (pill on `surface-2`); explicit `focus-visible:ring-2`. No `underlined` variant.                                                                                                                                                                   |
| `stepper.tsx`         | ✅         | Used in parent assessment wizard, IEP review.                                                                                                                                                                                                                                          |
| `dialog.tsx`          | ✅         | Radix Dialog; focus trap + restore + ESC.                                                                                                                                                                                                                                              |
| `drawer.tsx`          | ✅         | Bottom-sheet on `< 768px`, side panel on web.                                                                                                                                                                                                                                          |
| `toast.tsx`           | ✅         | Radix Toast Provider/Viewport/Root pass-through with one styled Root. **No tone variants** — caller applies tone via classes.                                                                                                                                                          |
| `badge.tsx`           | ✅         | Caller-applied tone (no CVA enum today).                                                                                                                                                                                                                                               |
| `progress.tsx`        | ✅         | Linear progress.                                                                                                                                                                                                                                                                       |
| `skeleton.tsx`        | ✅         | One block.                                                                                                                                                                                                                                                                             |
| `empty-state.tsx`     | ✅         | Title + description + CTA slot.                                                                                                                                                                                                                                                        |
| `error-state.tsx`     | ✅         | Inline error with retry slot.                                                                                                                                                                                                                                                          |
| `retry-panel.tsx`     | ✅         | Larger surface wrapping `<ErrorState>` with retry callback.                                                                                                                                                                                                                            |
| `label.tsx`           | ✅         | `<label>` with consistent spacing.                                                                                                                                                                                                                                                     |
| Icon button           | ⬜ planned | Today every call site uses `<Button size="icon">`; promote to its own export so `aria-label` is enforced.                                                                                                                                                                              |
| Toggle (Switch)       | ⬜ planned | Needed for accessibility settings + notification prefs (currently `consent-toggle.tsx` uses an Accept/Revoke Button pair).                                                                                                                                                             |
| Slider                | ⬜ planned | Learner audio rate + admin retention sliders.                                                                                                                                                                                                                                          |
| Data table            | ⬜ planned | Spec below — single primitive replaces ~30 inlined tables.                                                                                                                                                                                                                             |
| Filter bar            | ⬜ planned | Sticky, role-themed; pairs with Data table.                                                                                                                                                                                                                                            |
| Search field          | ⬜ planned | Today every call site composes `<Input>`; promote to `<Search>` with debounced onChange + `/` shortcut.                                                                                                                                                                                |
| Alert                 | ⬜ planned | Today inlined as a Card with tone class; promote to a dedicated `<Alert>` with `role="status"` / `role="alert"`.                                                                                                                                                                       |
| Toast tone variants   | ⬜ planned | Add `tone={success · info · warning · danger}` CVA on the Toast Root.                                                                                                                                                                                                                  |
| Tooltip               | ⬜ planned | Admin tables + parent help icons; must be keyboard-reachable.                                                                                                                                                                                                                          |
| Button `loading` prop | ⬜ planned | Built-in spinner + `aria-busy`; replaces ad-hoc spinning at call sites.                                                                                                                                                                                                                |
| Button focus ring     | ⬜ planned | Remove `focus-visible:outline-none` from `button.tsx` or pair it with an explicit `focus-visible:ring-2 ring-aivo-primary` — today only the global `*:focus-visible` outline applies.                                                                                                  |

### 4.2 Composites (domain)

| Component                | Status | Notes                                                                              |
| ------------------------ | ------ | ---------------------------------------------------------------------------------- |
| Mission card             | ✅     | `components/learner/mission-card.tsx`                                              |
| Learner card             | ✅     | `components/parent/learner-card.tsx` — readiness state + next-action CTA           |
| Tutor card               | 🟡     | `tutor-badge` exists; needs full card with avatar + role + "what they help with"   |
| Subject card             | 🟡     | `subject-icon` exists; needs card with mastery bar + last-activity                 |
| Lesson step card         | ✅     | `components/learner/lesson-step-card.tsx`                                          |
| Progress card            | 🟡     | inlined per dashboard; promote to one composite                                    |
| Assessment question card | ⬜     | used in baseline + parent assessment; today inlined                                |
| IEP upload card          | ⬜     | drag-drop area + size/type allow-list + extracted-fields preview                   |
| Parent summary card      | ⬜     | plain-language "what happened today" — UX-04                                       |
| Teacher assignment card  | ⬜     | one row per assignment in `/teacher/assignments`                                   |
| Quest chapter card       | ⬜     | locked / unlocked / completed states; learner theme only                           |
| Admin stat card          | 🟡     | inlined per overview page; one composite with `label · value · delta · sparkline`  |
| Notification item        | ⬜     | role-icon + title + meta + action                                                  |
| Audit log row            | ⬜     | actor · action · target · diff toggle                                              |
| Mobile role card         | ⬜     | used on `/role-chooser` after login                                                |
| Mobile role switcher     | ⬜     | drawer surface w/ active-mode indicator + last-used mode + sign-out                |
| Parent lock modal        | ⬜     | prompts parent PIN to leave Learner Mode                                           |
| Admin re-auth prompt     | ⬜     | forces re-confirmation for destructive admin actions (DSAR fulfill, tenant delete) |
| Read-aloud control       | ⬜     | learner-only; pill button + speaking-state animation respecting reduced-motion     |
| Hint button              | ⬜     | learner-only; revealing scaffolds (UX-06)                                          |
| Scaffold panel           | ⬜     | slides in from the right inside Stage; never auto-opens                            |
| Accessibility toolbar    | ⬜     | persistent in learner shell + reachable in others via `/settings/accessibility`    |

### 4.3 Component spec — `<DataTable>` (the highest-leverage new primitive)

```tsx
<DataTable
  rows={incidents}
  columns={[
    { key: "id", label: "ID", monospace: true, width: 96 },
    { key: "severity", label: "Severity", cell: SeverityBadge, sortable: true },
    { key: "title", label: "Title", primary: true },
    { key: "openedAt", label: "Opened", cell: RelativeTime, sortable: true },
    { key: "actor", label: "Last actor" },
    { key: "actions", label: "", cell: RowActions, align: "right" }
  ]}
  empty={<EmptyState title="No open incidents" />}
  loading={<TableSkeleton rows={8} />}
  error={(err, retry) => <RetryPanel error={err} onRetry={retry} />}
  pagination={{ pageSize: 25 }}
  selection={{ enabled: true, onChange: setSelected }}
  filters={<FilterBar … />}
  rowAriaLabel={(r) => `Incident ${r.id}, severity ${r.severity}`}
/>
```

Replaces ~30 inlined `<table>` blocks across admin (S31 + earlier sprints). Must include: keyboard nav (arrow keys, home/end, page-up/down), `aria-sort`, sticky header, optional virtualization at `rows.length > 200`.

### 4.4 Component spec — `<Toggle>` (Switch)

- Wraps native `<input type="checkbox" role="switch">`.
- Variants: `default`, `disabled`, `loading` (replaces thumb with spinner inside the track).
- Sizes: `sm` (24px), `md` (32px).
- Active state: track fills with `primary`, thumb is `primary-fg`.
- Used by: `consent-toggle` (current `Button` pair → swap to `Toggle` + status pill), accessibility settings, notification preferences.

---

## 5. Interaction states

All interactive primitives must define **all 14** states. Today's coverage by component:

| Component      | default | hover | focus | active | pressed | disabled | loading | success | error | retryable | perm-blocked | consent-req | offline | session-expired | role-unavailable |
| -------------- | :-----: | :---: | :---: | :----: | :-----: | :------: | :-----: | :-----: | :---: | :-------: | :----------: | :---------: | :-----: | :-------------: | :--------------: |
| Button         |   ✅    |  ✅   |  ✅   |   ✅   |   ✅    |    ✅    |   ✅    |   n/a   |  ✅   |    n/a    |      ⬜      |     ⬜      |   n/a   |       n/a       |       n/a        |
| Input          |   ✅    |  n/a  |  ✅   |   ✅   |   n/a   |    ✅    |   🟡    |   n/a   |  ✅   |    n/a    |      ⬜      |     n/a     |   n/a   |       n/a       |       n/a        |
| Toggle         |   ⬜    |   —   |   —   |   —    |    —    |    —     |    —    |    —    |   —   |     —     |      ⬜      |     ⬜      |    —    |        —        |        —         |
| Mission card   |   ✅    |  ✅   |  ✅   |   ✅   |   ✅    |    ✅    |   ✅    |   ✅    |  ✅   |    ✅     |      ✅      |     ✅      |   ⬜    |       ⬜        |        ⬜        |
| Data table row |   ⬜    |   —   |   —   |   —    |    —    |    —     |    —    |    —    |   —   |     —     |      —       |      —      |    —    |        —        |        —         |

Page-level states (not per-primitive):

| State                  | Default surface                                       | Where it fires                                              |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| **Offline**            | banner pinned below header                            | mobile-only, listens to `NetInfo`                           |
| **Session expired**    | full-screen overlay with re-auth CTA                  | both web and mobile; preserves intent URL for return        |
| **Role unavailable**   | inline "this role is not part of your account" card   | mobile role-switcher when a delegated role is removed       |
| **Permission blocked** | redirect to `/{role-home}?blocker=permission` + toast | any 403 from a BFF                                          |
| **Consent required**   | redirect with `?blocker=consent&type=<consentType>`   | any BFF return of `PRECONDITION_FAILED` with consent reason |

---

## 6. Motion

Tokenized in CSS custom properties:

| Token                       | Value                          | Use                                                           |
| --------------------------- | ------------------------------ | ------------------------------------------------------------- |
| `--aivo-motion-quick`       | 120ms ease-out                 | hover/focus rings, toast in                                   |
| `--aivo-motion-medium`      | 220ms ease-out                 | drawer slide, dialog scale-in                                 |
| `--aivo-motion-celebration` | 600ms cubic-bezier(.2,.8,.2,1) | learner lesson-complete animation only                        |
| `--aivo-motion-role-switch` | 320ms ease-in-out              | mobile role-mode transition (palette cross-fade + tab reflow) |

Rules:

- **No animation > 220ms during instruction.** Lesson-player beat transitions ≤ 220ms.
- **Reduced motion**: when `@media (prefers-reduced-motion: reduce)` is set OR `data-motion="reduced"` is on `<html>`, drop everything to instant or ≤ 100ms cross-fade. Celebrations become a static "Nice work!" panel.
- **Progress updates**: counter and progress-bar tween 400ms with `ease-out`; suppress when `prefers-reduced-motion`.
- **Role switching transition**: only the palette and tab indicators animate; content is replaced instantly to avoid disorientation.

---

## 7. Do / Don't

| ✅ Do                                                                              | 🚫 Don't                                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Use `bg-aivo-surface` for cards                                                    | Hardcode `bg-white` (it survives theme switches — caught residuals in DD-12) |
| Use `p-[var(--aivo-density-card-pad)]` for card padding                            | Use `p-5` directly (breaks density tokens — DD-11 lint rule)                 |
| Set role on `<html data-theme="…">` via `<AppShell>`                               | Set role colors inline on a component (defeats theming)                      |
| Use Badge for status; always include text                                          | Use color alone (color-only signaling, a11y §6 risk)                         |
| Use Toast for transient confirmations                                              | Use Toast for errors the user must act on — use inline Error state           |
| Mission card / Learner card / Subject card as the only "card with action" patterns | Invent a fourth card pattern per page                                        |
| `aria-live="polite"` for AI-generation status                                      | Spam-update an `aria-live="assertive"` region during streaming               |
| Wrap full-screen learner surfaces in a focus trap with explicit "Exit lesson"      | Rely on the global skip link inside Stage (it gets visually suppressed)      |
| Same component system across web + mobile via the token bridge                     | Build mobile-only or web-only siblings of the same idea                      |

---

## 8. Mobile component rules (unified app)

- **Tab bar** uses `<MobileTabBar>` reading the active role mode's tab list from `useRoleMode()`.
- **Page** wraps all screens; provides safe-area, header back affordance, and the role-aware `data-theme` value.
- **Mobile role card** (`/role-chooser`): full-width card per available role with icon + label + "last used <relative>".
- **Mobile role switcher** (drawer): sticky list of available roles, current marked with primary ring, sign-out at bottom.
- **Parent lock modal**: blocks leaving Learner Mode without parent PIN unless the device has the `parent.unlocked` session flag set in the last 5 minutes.
- **Native primitives**: Button, Input, Card, Toggle, Slider, Tabs, Toast, Dialog, Drawer reuse the OKLCH tokens via the bridge — no second design system.

---

## 9. Engineering handoff notes

All items below are **planned** unless marked ✅. Today the canonical tokens live in `apps/web-v2/app/globals.css` only; there is no `packages/brand` token bridge, no lint rule, no visual-regression script.

1. ⬜ **Token bridge** — promote tokens to `packages/brand/tokens.ts` (single source) + generate `tokens.css` for Tailwind/web + ship a `useToken(name)` hook for RN. Lets a single change propagate to web + native.
2. ⬜ **Lint rule `aivo/no-raw-card-padding`** — block `p-5` on `<Card>` to enforce the density token (DD-11).
3. ⬜ **Visual regression** — `scripts/visual-regress.mjs` snapshots each role's home in light / high-contrast and diffs against `docs/ux/baselines/*.png` (DD-10).
4. ⬜ **Component CRUD checklist** — every new composite ships with: a Storybook entry, a usage example, an a11y note, and an entry in §4.2.
5. ⬜ **High-contrast & dyslexic modes** — wire `<html data-contrast data-typeface>` from a new `aivo_a11y` cookie set by `/settings/accessibility`. Server-side render to avoid FOUC.
6. 🟡 **Density token coverage** — Card today consumes `--aivo-density-card-pad` via theme tokens; after UX-02 also tokenize `<PageHeader>` (h1 already covered), `<DataTable>` row height (when shipped), `<FormField>` gap.
7. ✅ **OKLCH** — Tailwind v4 emits OKLCH directly; the role tokens in `globals.css` are already OKLCH and rendering across browsers in scope.
8. ⬜ **Button focus ring fix** — see §4.1 last row; either remove `focus-visible:outline-none` or pair it with an explicit ring. Until then the "all components have focus states" criterion below is qualified.

---

## Acceptance criteria (per UX-02 brief)

- [x] Every core screen can be built from the component system — primitives in §4.1 + composites in §4.2 cover the catalog; ⬜ items in both tables are the explicit gap list this sprint produces.
- [🟡] All components have focus states — the global `*:focus-visible` outline applies (and §1.4 ensures dark-sidebar legibility), but `button.tsx` sets `focus-visible:outline-none` without a compensating ring; tracked as the §9.8 backlog item. Tabs and Input have explicit `focus-visible:ring-2`.
- [🟡] All interactive components have disabled and loading states — see §5 matrix. Button-level `loading` prop and Toggle/Slider don't exist yet — listed as ⬜ in §4.1.
- [x] Mobile role modes reuse one design system — single token set, role-mode-keyed `data-theme` (§1.7). Native bridge is the backlog item in §9.1.
- [🟡] Design tokens are implementation-ready — already in `globals.css` and consumed throughout `components/ui/*`; cross-platform `packages/brand/tokens.ts` is planned in §9.1.
- [x] Components are suitable for React, Tailwind, shadcn-style implementation, and native mobile translation — primitives follow shadcn-style conventions (CVA + Radix); native bridge spec in §8 + §9.1.
