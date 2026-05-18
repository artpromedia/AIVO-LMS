# AIVO Accessibility Guidelines

## Overview

AIVO serves learners across the autism spectrum including non-verbal and pre-symbolic users. Accessibility is not optional — it is a core product requirement. Every component must be usable via keyboard, screen reader, and assistive technology.

## WCAG 2.1 AA Standards

All components must meet WCAG 2.1 Level AA. Key requirements:

### Perceivable

- All images must have meaningful `alt` text or `aria-hidden="true"` for decorative elements
- Color contrast: minimum 4.5:1 for body text, 3:1 for large text (18px+ bold or 24px+)
- Decorative emoji icons must have `aria-hidden="true"`
- Progress bars must use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`

### Operable

- All interactive elements must be keyboard accessible
- Focus order must follow logical reading order
- All pages include a `<SkipLink>` component for keyboard users
- Toggle controls use `<AccessibleToggle>` with `role="switch"` and `aria-checked`
- No keyboard traps — users can navigate freely
- Sidebar collapse/expand buttons need `aria-label` that updates with state

### Understandable

- Form inputs must have visible labels or `aria-label`
- Error messages use `role="alert"` and `aria-live="assertive"`
- Status messages use `role="status"` and `aria-live="polite"`
- Login/signup forms include `autoComplete` attributes

### Robust

- Navigation links use `aria-current="page"` for active state
- Breadcrumbs use `aria-label="Breadcrumb"` on the nav element
- Sidebars use `role="navigation"` with descriptive `aria-label`
- Main content area has `id="main-content"` and `tabIndex={-1}` for skip link target

## Component Patterns

### Dashboard Layouts

- Import and render `<SkipLink />` as first child of the layout wrapper
- Sidebar `<aside>` must have `role="navigation"` and `aria-label="{Role} sidebar"`
- Each nav link needs `aria-current="page"` when active
- Collapse button needs dynamic `aria-label`: "Expand sidebar" / "Collapse sidebar"
- Sign out button needs `aria-label="Sign out"`
- Main content area: `<main id="main-content" tabIndex={-1}>`

### Toggle Switches

- Use `<AccessibleToggle>` from `@/components/a11y/AccessibleToggle`
- Always provide `id`, `label`, and `value`/`onChange` props
- Optional `description` and `color` props

### Forms

- Every input must have a `<label>` element associated by `htmlFor` or wrapping
- Password visibility toggles need `aria-label="Show password"` / `aria-label="Hide password"`
- Submit buttons need `aria-busy={loading}` when processing
- Error containers need `role="alert" aria-live="assertive"`

### Loading States

- Use `role="status"` and `aria-live="polite"` for loading indicators
- Loading spinners are decorative: `aria-hidden="true"` on the SVG

### Data Tables

- Tables must have `<caption>` (can be `className="sr-only"` if visual caption exists)
- Header cells use `<th scope="col">` or `<th scope="row">`

### Interactive Cards (expand/collapse)

- Use `role="button"`, `tabIndex={0}`, `aria-expanded`
- Handle both `Enter` and `Space` key events

## Motion & Sensory

- `prefers-reduced-motion` is respected globally in `globals.css`
- The Stage layout respects `adaptations.motionReduced` for particle effects
- Color saturation is adjustable per-learner via sensory profile

## Testing

- Run `eslint-plugin-jsx-a11y` as part of lint checks
- Manual keyboard testing: Tab through every interactive element
- Screen reader testing with VoiceOver (macOS) or NVDA (Windows)
- Focus visible outlines: 2px solid purple (#8b5cf6) with 2px offset

## Color Palette Contrast Ratios

| Foreground                | Background | Ratio  | Pass? |
| ------------------------- | ---------- | ------ | ----- |
| text-slate-900 (#0f172a)  | bg-white   | 18.3:1 | AA    |
| text-slate-500 (#64748b)  | bg-white   | 5.4:1  | AA    |
| text-purple-600 (#9333ea) | bg-white   | 4.6:1  | AA    |
| text-blue-600 (#2563eb)   | bg-white   | 4.8:1  | AA    |
| text-pink-600 (#db2777)   | bg-white   | 4.6:1  | AA    |
| text-green-600 (#16a34a)  | bg-white   | 4.6:1  | AA    |
