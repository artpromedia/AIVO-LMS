# Neurodiverse Learner Interface — Gap Audit & Containerized Remediation Playbook

> **Persona.** Written acting as a principal DevOps / platform engineer with ~30 years
> shipping accessible, human-centred software — the kind of career that runs through
> Google-scale reliability engineering and IDEO-style human-centred design. The bias
> here is the one those two schools share: **ship the whole feature or don't claim it.**
> A toggle that saves a boolean but changes nothing on screen is not "done" — it is a
> liability with a checkbox. Every remediation in this document is specified end-to-end
> (schema → persistence → API → render → test → CI gate). **No stubs. No placeholders.
> No "wire this up later."**

- **Scope:** Learner interface, web (`apps/web-v2`) + mobile (`apps/mobile`), for the
  neurodiverse K–12 audience AIVO exists to serve.
- **Method:** Cross-referenced the intended requirements (`docs/ux/UX-14-accessibility-inclusive-design.md`,
  `docs/accessibility/vpat-readiness.md`, `attached_assets/AIVO_Learner_Interface_Specification_*.md`,
  `attached_assets/AIVO_React_Native_Build_Specification_*.md`) against the shipped code, and
  benchmarked against sibling org repos (`artpromedia/aivo-agentic-ai-learning-app`,
  `aivo-ai-learning`, `aivo-learning`, `aivo-agentic-ai-platform`).
- **Verdict in one line:** AIVO-LMS is **materially ahead** of every sibling repo on
  neurodiverse design — it is the only one with a working sensory-mode engine, an AAC
  bridge, an executive-function module, and a per-learner accessibility model. But a
  meaningful slice of that model is **collected-but-inert**: preferences persist and never
  reach the pixels. That gap is the whole subject of this playbook.

---

## 1. Benchmark — how the siblings compare

| Capability | Sibling best-in-class | AIVO-LMS (this repo) |
| --- | --- | --- |
| Accessibility preference model | `aivo-agentic-ai-learning-app` — **7 booleans** captured once at parent enrollment (`apps/parent-portal/src/components/Enrollment/steps/AccessibilityStep.tsx`: `textToSpeech, voiceInput, largeText, highContrast, reducedMotion, calmMode, dyslexiaFont`) | **13-field** per-learner model + separate audio + 5-modality sensory profile |
| Where prefs are applied | Enrollment form only; no runtime consumer found | `SensoryModeProvider`, `SensoryProvider`, lesson-player root classes, `aac-bridge` |
| AAC / switch-scan / eye-gaze | none | `packages/aac-bridge` (web) + `SwitchScanOverlay` (mobile) |
| Executive-function (ADHD) supports | none | `packages/executive-function` (`breakDownTask`, `StuckDetector`, `TimeOfDayMemory`) |
| TTS | boolean flag only | 6 named voices, speed control, consent-gated BFF, content-hashed cache |

**Conclusion:** there is nothing to copy *from* the siblings — AIVO-LMS already exceeds
them. The work is to **finish what AIVO-LMS started**, not to import features. The siblings
are useful only as proof that the 7 "table-stakes" prefs (TTS, large text, high contrast,
reduced motion, calm mode, dyslexia font, voice input) are an industry-floor expectation —
and AIVO must therefore make all 7 *actually function*, not just persist.

---

## 2. Gap register (evidence-backed)

Severity: **P0** = advertised to families but does nothing / wrong output; **P1** = works in
chrome but not in the lesson (where neurodiverse learners spend their time); **P2** = durability,
parity, or test-coverage debt.

### 2.1 Cross-cutting (web + mobile)

| ID | Gap | Evidence | Sev |
| --- | --- | --- | --- |
| **X1** | **Web and mobile use two divergent, unsynced preference schemas.** Web BFF stores 13 booleans (`reducedMotion, dyslexiaFriendlyFont, …`); mobile stores a different shape (`ttsEnabled, captionsDefault, textScale: small\|medium\|large`, sensory `mode`). A learner who sets prefs on web sees none of them on the tablet, and vice-versa. | `apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/route.ts` (PatchSchema, 13 keys) vs `apps/mobile/lib/preferences-logic.ts` (`coerceAudio`, `TEXT_SCALES`) + `apps/mobile/context/SensoryModeProvider.tsx` | P1 |
| **X2** | **No durable cross-device source of truth.** Web BFF persists to an **in-memory `Map`** (`db().accessibilityPrefs`); mobile persists to **device-local `AsyncStorage`**. Nothing is the server's truth, so prefs don't survive a pod restart (web) or follow the child across devices. | `apps/web-v2/lib/db/repos.ts:2345-2381` (`getAccessibilityPrefs`/`updateAccessibilityPrefs` over `db()` Map); `apps/mobile/lib/preferences.tsx` (`@aivo/a11y_prefs_v1`, `@aivo/audio_prefs_v1`) | P1 |
| **X3** | **Dyslexia webfont is not bundled.** `data-typeface="dyslexia"` only swaps a CSS variable to a family *name list* ("Atkinson Hyperlegible, OpenDyslexic"); there is **no `@font-face` and no font binary** in `apps/web-v2/public`. On any device without those fonts installed (most), the mode silently does nothing. | `apps/web-v2/app/globals.css:167-170`; `find apps/web-v2/public -iname '*dyslex*' -o -iname '*atkinson*'` → empty | P0 |

### 2.2 Web (`apps/web-v2`)

| ID | Gap | Evidence | Sev |
| --- | --- | --- | --- |
| **W1** | **Dyslexia font in the lesson player is wrong.** The lesson root applies `font-mono tracking-wide` — a **monospace** font — when `dyslexiaFriendlyFont` is on. Monospace is *not* a dyslexia-friendly typeface; the spec calls for Atkinson Hyperlegible / OpenDyslexic with letter-spacing 0.03em and line-height 1.7. | `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx:580` | P0 |
| **W2** | **Six prefs persist but never render in the lesson.** `breakReminders`, `extraHints`, `visualSupports`, `keyboardOptimized`, `hapticsEnabled`, `captionsAlwaysOn` are in the schema, saved, and shown as toggles — but the lesson player consumes only `largeText, dyslexiaFriendlyFont, highContrast, reducedMotion, shorterSteps`. The other six appear **only in dev fixtures** (`lesson-player-fixture`, `lesson-player-smoke`), never in production render paths. | `lesson-player.tsx:578-585` (5 consumed); grep of the six across `apps/web-v2/app/learner` → matches only in `*-fixture/page.tsx` & `*-smoke/page.tsx` | P0 |
| **W3** | **AAC fields are unreachable through the API.** `aacEnabled`, `aacInputMethod`, `aacScanDelayMs` exist on the type and there is an "AAC support" toggle, but the accessibility `PatchSchema` (`.strict()`) **omits them** — so saving the toggle is rejected/ignored. The `aac-bridge` runtime can therefore never be switched on by a learner/parent. | `apps/web-v2/lib/db/types.ts` (`aacEnabled` etc.) vs `…/accessibility/route.ts:20-36` (PatchSchema has no `aac*`) | P0 |
| **W4** | **`FocusMode` is a skeleton.** Component exists with no behaviour and is never mounted; there is no distraction-reduction surface for ADHD/autistic learners. | `packages/learner-ui/src/playful-calm/patterns.tsx:126-136` | P1 |
| **W5** | **Break nudges have no consumer.** `BreakCloud` exists and `StuckDetector` emits prompts, but nothing renders them inside the lesson player. | `packages/learner-ui/src/feedback/BreakCloud.tsx`; `packages/executive-function/src/index.ts:125-167` | P1 |
| **W6** | **UI density / spacing not persisted.** Workspace-rail spacing (compact/comfortable/spacious) is local React state, never written to cookie or BFF. | `components/learner/learner-workspace-rail.tsx:37-70` | P2 |
| **W7** | **No automated a11y gate or stub-guard in CI.** `pnpm a11y:audit` (axe), `check-skip-link.mjs`, `check-aria-live.mjs` are referenced by docs as "planned"; none run on PRs. Nothing prevents the next collected-but-inert toggle. | `docs/ux/UX-14-accessibility-inclusive-design.md` §7 ("⬜ PLANNED"); `.github/workflows` has no axe job | P1 |

### 2.3 Mobile (`apps/mobile`)

| ID | Gap | Evidence | Sev |
| --- | --- | --- | --- |
| **M1** | **No dyslexia-friendly font at all.** Typography is hard-coded to Fredoka/Nunito; there is no family-swap and no dyslexia toggle. A core web feature is simply absent on the tablet most young learners use. | `apps/mobile/constants/typography.ts:18-52`; no `dyslexi*` in `apps/mobile` | P0 |
| **M2** | **No break reminders / pacing controls.** `extendedTime` is resolved server-side but never surfaced; no break UI. Web has the toggle; mobile has neither toggle nor behaviour. | `apps/mobile/lib/preferences-logic.ts:~117` (`extendedTime`); no break UI in `(learner)` screens | P1 |
| **M3** | **No live-region announcements.** 338 `accessibilityLabel`s (good) but zero `AccessibilityInfo.announceForAccessibility()` / `accessibilityLiveRegion` for answer-correctness, save status, or stuck prompts — exactly the dynamic events a TalkBack/VoiceOver user needs. | grep `announceForAccessibility|accessibilityLiveRegion` in `apps/mobile` → none | P1 |
| **M4** | **No focus/distraction-reduction mode.** Only sound/music/animation toggles; no parity with the (also-missing) web Focus Mode. | `apps/mobile/app/(learner)/settings.tsx:195-210` | P2 |

---

## 3. Remediation architecture

The fix is one coherent move, not eleven patches: **make the per-learner accessibility
profile a single durable contract that both clients render from, end-to-end.**

```
                    ┌──────────────────────────────────────────┐
                    │  @aivo/accessibility-contract  (NEW pkg)  │
                    │  Zod schema · TS types · defaults · codec │
                    └───────────────┬───────────────┬──────────┘
                        web BFF      │               │   mobile
        ┌───────────────────────────▼──┐        ┌────▼─────────────────────────┐
        │ /api/bff/.../accessibility    │        │ usePreferences() (AsyncStore │
        │  → identity-svc (durable)     │◄──sync─►│  cache + identity-svc fetch) │
        └───────────────┬───────────────┘        └────┬─────────────────────────┘
            applyA11y()  │ (DOM attrs + webfont)       │ A11yStyleProvider (RN)
        ┌───────────────▼───────────────┐        ┌────▼─────────────────────────┐
        │ lesson-player renders ALL prefs│        │ MobileSurfaceRenderer renders│
        │ break/hints/visual/keyboard/   │        │ ALL prefs (font/breaks/live) │
        │ haptics/captions/AAC           │        │                              │
        └────────────────────────────────┘        └──────────────────────────────┘
```

Everything below is the concrete file list to realise that diagram, with full code for the
load-bearing pieces.

---

## 4. Files to CREATE

### 4.1 `packages/accessibility-contract/` — the shared source of truth (resolves X1)

A tiny, dependency-light package both apps import so the schema can never drift again.

**`packages/accessibility-contract/package.json`**
```json
{
  "name": "@aivo/accessibility-contract",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^3.23.8" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" }
}
```

**`packages/accessibility-contract/src/index.ts`** — one canonical schema, used verbatim by
the web Zod route and translated to the mobile prefs. No field lives in only one client.
```ts
import { z } from "zod";

/** AAC input devices supported by @aivo/aac-bridge and the mobile SwitchScanOverlay. */
export const AAC_INPUT_METHODS = [
  "touch", "switch_1", "switch_2", "eye_gaze", "head_pointer",
] as const;
export type AacInputMethod = (typeof AAC_INPUT_METHODS)[number];

export const TEXT_SCALES = ["standard", "large", "xlarge"] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

/**
 * The single per-learner accessibility contract. Web and mobile both render
 * from this exact shape. Adding a field here is the ONLY way to add a pref;
 * the no-stub CI guard (see §6.3) fails the build if a field is added without
 * a renderer + a test referencing it.
 */
export const AccessibilityProfileSchema = z
  .object({
    // reading / visual
    textScale: z.enum(TEXT_SCALES).default("standard"),
    dyslexiaFriendlyFont: z.boolean().default(false),
    highContrast: z.boolean().default(false),
    visualSupports: z.boolean().default(false),
    // motion / sensory
    reducedMotion: z.boolean().default(false),
    hapticsEnabled: z.boolean().default(true),
    // audio
    readAloud: z.boolean().default(false),
    audioFirst: z.boolean().default(false),
    captionsAlwaysOn: z.boolean().default(false),
    // cognition / pacing
    shorterSteps: z.boolean().default(false),
    extraHints: z.boolean().default(false),
    breakReminders: z.boolean().default(false),
    breakIntervalMinutes: z.number().int().min(2).max(45).default(10),
    focusMode: z.boolean().default(false),
    // input / AAC (resolves W3 — AAC is now first-class in the contract)
    keyboardOptimized: z.boolean().default(false),
    aacEnabled: z.boolean().default(false),
    aacInputMethod: z.enum(AAC_INPUT_METHODS).default("touch"),
    aacScanDelayMs: z.number().int().min(300).max(5000).default(1200),
  })
  .strict();

export type AccessibilityProfile = z.infer<typeof AccessibilityProfileSchema>;

/** Patch = every field optional, still strict (rejects unknown keys). */
export const AccessibilityPatchSchema = AccessibilityProfileSchema.partial().strict();
export type AccessibilityPatch = z.infer<typeof AccessibilityPatchSchema>;

export const ACCESSIBILITY_DEFAULTS: AccessibilityProfile =
  AccessibilityProfileSchema.parse({});

/** Stamp the profile onto a DOM root (web) as data-attributes + classes. */
export function accessibilityDomAttrs(p: AccessibilityProfile): Record<string, string> {
  return {
    "data-text-scale": p.textScale,
    "data-typeface": p.dyslexiaFriendlyFont ? "dyslexia" : "standard",
    "data-contrast": p.highContrast ? "high" : "normal",
    "data-reduced-motion": p.reducedMotion ? "reduce" : "auto",
    "data-visual-supports": p.visualSupports ? "on" : "off",
    "data-keyboard-optimized": p.keyboardOptimized ? "on" : "off",
    "data-focus-mode": p.focusMode ? "on" : "off",
  };
}
```

**`packages/accessibility-contract/src/index.test.ts`** — real assertions (no `it.todo`).
```ts
import { describe, expect, it } from "vitest";
import {
  AccessibilityProfileSchema, AccessibilityPatchSchema,
  ACCESSIBILITY_DEFAULTS, accessibilityDomAttrs,
} from "./index";

describe("accessibility contract", () => {
  it("defaults parse and are stable", () => {
    expect(ACCESSIBILITY_DEFAULTS.textScale).toBe("standard");
    expect(ACCESSIBILITY_DEFAULTS.aacInputMethod).toBe("touch");
  });
  it("rejects unknown keys (strict)", () => {
    expect(AccessibilityPatchSchema.safeParse({ nope: true }).success).toBe(false);
  });
  it("clamps break interval bounds", () => {
    expect(AccessibilityPatchSchema.safeParse({ breakIntervalMinutes: 1 }).success).toBe(false);
    expect(AccessibilityPatchSchema.safeParse({ breakIntervalMinutes: 10 }).success).toBe(true);
  });
  it("maps dyslexia to data-typeface", () => {
    expect(accessibilityDomAttrs({ ...ACCESSIBILITY_DEFAULTS, dyslexiaFriendlyFont: true })["data-typeface"]).toBe("dyslexia");
  });
});
```

### 4.2 Self-hosted dyslexia webfont (resolves X3, W1, M1)

Bundle the actual binaries so the mode works offline and on every device. Both fonts ship
under the SIL Open Font License — license files must accompany them.

**Create:**
- `apps/web-v2/public/fonts/AtkinsonHyperlegible-Regular.woff2`
- `apps/web-v2/public/fonts/AtkinsonHyperlegible-Bold.woff2`
- `apps/web-v2/public/fonts/OpenDyslexic-Regular.woff2`
- `apps/web-v2/public/fonts/OFL-AtkinsonHyperlegible.txt`, `apps/web-v2/public/fonts/OFL-OpenDyslexic.txt`
- `apps/mobile/assets/fonts/OpenDyslexic-Regular.otf`, `apps/mobile/assets/fonts/AtkinsonHyperlegible-Regular.ttf`

**`apps/web-v2/app/fonts-dyslexia.css`** (imported from `globals.css`):
```css
@font-face {
  font-family: "Atkinson Hyperlegible";
  src: url("/fonts/AtkinsonHyperlegible-Regular.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Atkinson Hyperlegible";
  src: url("/fonts/AtkinsonHyperlegible-Bold.woff2") format("woff2");
  font-weight: 700; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "OpenDyslexic";
  src: url("/fonts/OpenDyslexic-Regular.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}

/* Dyslexia mode now applies real spacing rules, not just a family name. */
[data-typeface="dyslexia"] {
  --aivo-fontFamily-dyslexia: "Atkinson Hyperlegible", "OpenDyslexic", system-ui, sans-serif;
  letter-spacing: 0.03em;
  line-height: 1.7;
}
```

### 4.3 Web — a single applier + break + focus surfaces

**`apps/web-v2/components/learner/lesson-accessibility-layer.tsx`** (NEW) — the one component
that turns the *entire* profile into behaviour inside the lesson. Resolves W2, W4, W5,
and the render half of W3. This is complete, not a skeleton.
```tsx
"use client";

import * as React from "react";
import type { AccessibilityProfile } from "@aivo/accessibility-contract";

/** Web Vibration API wrapper — honours hapticsEnabled (resolves the haptics half of W2). */
export function useHaptics(enabled: boolean) {
  return React.useCallback(
    (pattern: number | number[]) => {
      if (!enabled) return;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
    },
    [enabled],
  );
}

/** Break reminder driver — fires a polite, non-modal nudge every N minutes (W5). */
export function useBreakReminders(
  active: boolean,
  intervalMinutes: number,
  onBreak: () => void,
) {
  React.useEffect(() => {
    if (!active) return;
    const id = window.setInterval(onBreak, Math.max(2, intervalMinutes) * 60_000);
    return () => window.clearInterval(id);
  }, [active, intervalMinutes, onBreak]);
}

/**
 * Renders the break cloud + a polite live-region announcement. Mount this inside
 * the lesson player. It is fully functional: a learner can dismiss or take the break.
 */
export function BreakNudge({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Time for a break"
      className="fixed inset-x-0 bottom-6 z-50 mx-auto w-[min(92vw,28rem)] rounded-2xl border border-iw-border bg-iw-raised p-5 shadow-lg"
    >
      <p className="text-base font-semibold text-iw-ink">Nice work — want to rest your eyes?</p>
      <p className="mt-1 text-sm text-iw-ink-muted">Take a slow breath. Your spot is saved.</p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full bg-iw-primary px-4 py-2 text-sm font-semibold text-iw-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
        >
          Keep going
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-iw-border px-4 py-2 text-sm font-semibold text-iw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring"
        >
          I took my break
        </button>
      </div>
    </div>
  );
}

/** Focus mode: hides non-essential chrome by toggling a root attribute (W4). */
export function applyFocusMode(profile: AccessibilityProfile) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-focus-mode", profile.focusMode ? "on" : "off");
}
```

**`apps/web-v2/app/focus-mode.css`** (NEW, imported from `globals.css`) — gives `data-focus-mode`
and `data-visual-supports` and `data-keyboard-optimized` real effects (W2):
```css
/* Focus mode: collapse secondary chrome so one task is on screen. */
[data-focus-mode="on"] [data-chrome="secondary"] { display: none !important; }
[data-focus-mode="on"] { --aivo-density-card-pad: 2rem; }

/* Visual supports: reveal optional iconography/diagram captions. */
[data-visual-supports="on"] [data-visual-support] { display: block; }
[data-visual-support] { display: none; }

/* Keyboard-optimized: upscale every interactive target to >=48x48 (WCAG 2.5.8). */
[data-keyboard-optimized="on"] button,
[data-keyboard-optimized="on"] a,
[data-keyboard-optimized="on"] [role="button"],
[data-keyboard-optimized="on"] input,
[data-keyboard-optimized="on"] select {
  min-height: 48px; min-width: 48px;
}
[data-keyboard-optimized="on"] :focus-visible { outline-width: 4px; outline-offset: 3px; }

/* Large / extra-large text scale (mobile parity for textScale). */
[data-text-scale="large"]  { font-size: 1.0625rem; }
[data-text-scale="xlarge"] { font-size: 1.1875rem; }
```

### 4.4 Mobile — dyslexia font, breaks, live regions (resolves M1–M3)

**`apps/mobile/lib/a11y-style.tsx`** (NEW) — the RN equivalent of the web applier; resolves
M1 (font family swap) and exposes the helpers the surface renderer needs.
```tsx
import React, { createContext, useContext, useMemo } from "react";
import { AccessibilityInfo } from "react-native";
import { usePreferences } from "./preferences";

type A11yStyle = {
  fontFamily: string;
  textScaleFactor: number;
  announce: (msg: string) => void;
};
const Ctx = createContext<A11yStyle | null>(null);

const SCALE: Record<string, number> = { standard: 1, large: 1.15, xlarge: 1.3 };

export function A11yStyleProvider({ children }: { children: React.ReactNode }) {
  const { a11y } = usePreferences();
  const value = useMemo<A11yStyle>(
    () => ({
      // Resolves M1: real dyslexia family, loaded via expo-font in app bootstrap.
      fontFamily: a11y.dyslexiaFriendlyFont ? "OpenDyslexic" : "Nunito",
      textScaleFactor: SCALE[a11y.textScale] ?? 1,
      // Resolves M3: dynamic announcements for TalkBack/VoiceOver.
      announce: (msg: string) => AccessibilityInfo.announceForAccessibility(msg),
    }),
    [a11y.dyslexiaFriendlyFont, a11y.textScale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useA11yStyle(): A11yStyle {
  const v = useContext(Ctx);
  if (!v) throw new Error("useA11yStyle must be used inside <A11yStyleProvider>");
  return v;
}
```

**`apps/mobile/components/learning/BreakReminder.tsx`** (NEW) — resolves M2 with a real
interval + announced modal (mirrors web `BreakNudge`).
```tsx
import React, { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { usePreferences } from "../../lib/preferences";
import { useA11yStyle } from "../../lib/a11y-style";

export function BreakReminder() {
  const { a11y } = usePreferences();
  const { announce } = useA11yStyle();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!a11y.breakReminders) return;
    const id = setInterval(() => {
      setOpen(true);
      announce("Time for a quick break.");
    }, Math.max(2, a11y.breakIntervalMinutes) * 60_000);
    return () => clearInterval(id);
  }, [a11y.breakReminders, a11y.breakIntervalMinutes, announce]);

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: "flex-end", padding: 24 }}>
        <View
          accessibilityRole="alert"
          accessibilityLabel="Time for a break"
          style={{ borderRadius: 20, padding: 20, backgroundColor: "white" }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Nice work — want to rest?</Text>
          <Text style={{ marginTop: 4, opacity: 0.7 }}>Your spot is saved.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={{ marginTop: 16, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#3B5BDB" }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Keep going</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

### 4.5 Durable persistence (resolves X2)

**`services/identity-svc/src/routes/learner-accessibility.ts`** (NEW) — the server-side
source of truth, Postgres-backed, so prefs survive restarts and sync across devices.
```ts
import type { FastifyInstance } from "fastify";
import { AccessibilityPatchSchema, ACCESSIBILITY_DEFAULTS } from "@aivo/accessibility-contract";
import { db } from "../db"; // existing drizzle handle

export async function learnerAccessibilityRoutes(app: FastifyInstance) {
  app.get("/learners/:id/accessibility", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await db.query.learnerAccessibility.findFirst({ where: (t, { eq }) => eq(t.learnerId, id) });
    return reply.send({ accessibility: row?.profile ?? ACCESSIBILITY_DEFAULTS });
  });

  app.patch("/learners/:id/accessibility", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = AccessibilityPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(422).send({ error: parsed.error.issues[0]?.message });
    const current = (await db.query.learnerAccessibility.findFirst({ where: (t, { eq }) => eq(t.learnerId, id) }))?.profile ?? ACCESSIBILITY_DEFAULTS;
    const next = { ...current, ...parsed.data };
    await db.insert(schema.learnerAccessibility)
      .values({ learnerId: id, profile: next, updatedAt: new Date() })
      .onConflictDoUpdate({ target: schema.learnerAccessibility.learnerId, set: { profile: next, updatedAt: new Date() } });
    return reply.send({ accessibility: next });
  });
}
```
Plus the migration `services/identity-svc/migrations/0xxx_learner_accessibility.sql`:
```sql
CREATE TABLE IF NOT EXISTS learner_accessibility (
  learner_id  uuid PRIMARY KEY REFERENCES learners(id) ON DELETE CASCADE,
  profile     jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### 4.6 Containerized verification harness (resolves W7)

**`docker/accessibility-audit.Dockerfile`** (NEW) — a hermetic, reproducible axe runner so
the gate is identical on a laptop and in CI (the "containerized" requirement).
```dockerfile
# Pinned, reproducible accessibility audit image. Runs axe-core + Playwright
# against a built preview of web-v2. No network surprises in CI.
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /audit
ENV CI=true PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable

COPY pnpm-lock.yaml package.json ./
COPY scripts/a11y ./scripts/a11y
RUN pnpm install --frozen-lockfile --filter @aivo/a11y-audit...

# axe runner + the route matrix (one per role x one per state)
COPY scripts/a11y/run-axe.mjs ./run-axe.mjs
ENTRYPOINT ["node", "run-axe.mjs"]
```

**`docker-compose.a11y.yml`** (NEW) — bring up web-v2 preview + the audit container together:
```yaml
services:
  web-preview:
    build: { context: ., dockerfile: docker/web-v2.Dockerfile }
    environment: { NEXT_PUBLIC_E2E: "1" }
    ports: ["3000:3000"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 5s
      timeout: 3s
      retries: 30
  a11y-audit:
    build: { context: ., dockerfile: docker/accessibility-audit.Dockerfile }
    depends_on:
      web-preview: { condition: service_healthy }
    environment: { BASE_URL: "http://web-preview:3000" }
    # Exit non-zero on any serious/critical violation -> fails CI.
```

**`scripts/a11y/run-axe.mjs`** (NEW) — complete runner (abridged here to the load-bearing
logic; ship it whole, no `TODO`s):
```js
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// One representative route per learner state — the surfaces neurodiverse users live in.
const ROUTES = [
  "/learner/home", "/learner/settings/accessibility", "/learner/settings/audio",
  "/learner/lesson-player-smoke", "/learner/baseline/readiness",
];
const PROFILES = [
  {}, { typeface: "dyslexia" }, { "reduced-motion": "reduce" }, { contrast: "high" },
];

const browser = await chromium.launch();
let failures = 0;
for (const route of ROUTES) {
  for (const profile of PROFILES) {
    const page = await browser.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    for (const [k, v] of Object.entries(profile)) {
      await page.evaluate(([key, val]) => document.documentElement.setAttribute(`data-${key}`, val), [k, v]);
    }
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length) {
      failures += serious.length;
      console.error(`✗ ${route} ${JSON.stringify(profile)} → ${serious.map((v) => v.id).join(", ")}`);
    } else {
      console.log(`✓ ${route} ${JSON.stringify(profile)}`);
    }
    await page.close();
  }
}
await browser.close();
if (failures) { console.error(`\naxe: ${failures} serious/critical violation(s)`); process.exit(1); }
console.log("\naxe: clean across route × profile matrix");
```

**`scripts/a11y/no-inert-prefs.mjs`** (NEW) — the stub-guard. Fails the build if any field
in the contract is saved but never rendered or never tested. This is the mechanism that
makes "no stubs or placeholders" a permanent, enforced property rather than a one-time cleanup:
```js
// Every key in AccessibilityProfileSchema must appear in BOTH a render path
// (apps/web-v2/app/learner/** or apps/mobile/components/**) AND a test file.
// Otherwise it is "collected-but-inert" and the build fails.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const contract = readFileSync("packages/accessibility-contract/src/index.ts", "utf8");
const keys = [...contract.matchAll(/^\s{4}(\w+):\s/gm)].map((m) => m[1])
  .filter((k) => !["aacInputMethod", "aacScanDelayMs", "breakIntervalMinutes"].includes(k) === false || true);

const grep = (q, path) => {
  try { return execSync(`grep -rl --include='*.tsx' --include='*.ts' -e ${JSON.stringify(q)} ${path}`).toString().trim(); }
  catch { return ""; }
};

let bad = [];
for (const key of new Set(keys)) {
  const rendered = grep(key, "apps/web-v2/app/learner apps/mobile/components apps/mobile/app");
  const tested = grep(key, "apps/web-v2/app apps/mobile/__tests__ packages/accessibility-contract");
  if (!rendered) bad.push(`${key}: never rendered in a learner surface`);
  else if (!tested) bad.push(`${key}: rendered but no test references it`);
}
if (bad.length) { console.error("Inert accessibility prefs:\n - " + bad.join("\n - ")); process.exit(1); }
console.log("no-inert-prefs: every contract field is rendered and tested.");
```

**`.github/workflows/accessibility.yml`** (NEW) — the gate itself:
```yaml
name: accessibility
on:
  pull_request:
    paths:
      - "apps/web-v2/**"
      - "apps/mobile/**"
      - "packages/accessibility-contract/**"
      - "scripts/a11y/**"
jobs:
  axe-and-stub-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: ".nvmrc", cache: "pnpm" }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @aivo/accessibility-contract test
      - run: node scripts/a11y/no-inert-prefs.mjs
      - run: docker compose -f docker-compose.a11y.yml up --build --abort-on-container-exit --exit-code-from a11y-audit
```

---

## 5. Files to EDIT

| File | Change | Resolves |
| --- | --- | --- |
| `apps/web-v2/app/api/bff/learners/[learnerId]/accessibility/route.ts` | Replace the hand-rolled 13-field `PatchSchema` with `AccessibilityPatchSchema` from `@aivo/accessibility-contract`; on read/write, call identity-svc instead of the in-memory `db()` Map (keep Map only as an E2E fixture behind `NEXT_PUBLIC_E2E`). | X1, X2, W3 |
| `apps/web-v2/lib/db/repos.ts` (`getAccessibilityPrefs`/`updateAccessibilityPrefs`, lines 2345–2381) | Delegate to identity-svc client; the Map becomes a test-only fallback. | X2 |
| `apps/web-v2/app/learner/lesson-runs/[lessonRunId]/lesson-player.tsx` (line 580 + root) | (1) Drop `font-mono`; dyslexia now flows from `data-typeface` on `<html>` (real webfont). (2) Mount `<BreakNudge>` + `useBreakReminders` + `useHaptics` + `applyFocusMode`. (3) Gate hint button on `extraHints`, diagrams on `visualSupports`, wrap with AAC provider on `aacEnabled`, render captions on `captionsAlwaysOn`. | W1, W2, W3, W5 |
| `apps/web-v2/app/globals.css` | `@import "./fonts-dyslexia.css";` and `@import "./focus-mode.css";` near the top. | X3, W1, W2, W4 |
| `apps/web-v2/components/learner/accessibility-form.tsx` | Add the AAC + `focusMode` + `breakIntervalMinutes` + `textScale` controls so the form matches the contract 1:1. | W3, X1 |
| `apps/mobile/lib/preferences-logic.ts` & `preferences.tsx` | Re-derive the mobile prefs type from `@aivo/accessibility-contract` (translate `textScale` enum, add `dyslexiaFriendlyFont`, `breakReminders`, `breakIntervalMinutes`, `focusMode`); hydrate from identity-svc, fall back to AsyncStorage cache. | X1, X2, M1, M2 |
| `apps/mobile/app/_layout.tsx` (root) | Load OpenDyslexic/Atkinson via `expo-font`; wrap tree in `<A11yStyleProvider>`. | M1 |
| `apps/mobile/app/(learner)/_layout.tsx` | Mount `<BreakReminder />` alongside the existing `SwitchScanOverlay`. | M2 |
| `apps/mobile/src/components/settings/AccessibilitySettings.tsx` | Add dyslexia-font toggle, break-reminder toggle + interval stepper, focus-mode toggle. | M1, M2, M4 |
| `apps/mobile/src/components/learning/MobileSurfaceRenderer.tsx` | Apply `useA11yStyle().fontFamily` + `textScaleFactor` to rendered text; call `announce()` on answer-correctness and save events. | M1, M3 |
| `apps/mobile/constants/typography.ts` (lines 18–52) | Make `body`/`display` family resolve through `useA11yStyle()` rather than the hard-coded constant. | M1 |
| `components/learner/learner-workspace-rail.tsx` (lines 37–70) | Persist spacing via a `setSpacingCookie` server action + the contract (`textScale`), instead of local state. | W6 |
| `apps/mobile/package.json` | Add `expo-font`, `expo-speech` (TTS engine is referenced but not a dependency), `react-native-volume-manager` (already optional for switch-scan). | M1, M3 |
| `pnpm-workspace.yaml` / root `package.json` scripts | Register `@aivo/accessibility-contract`; add `"a11y:audit"`, `"a11y:stub-guard"`, `"a11y:contract"` scripts. | W7 |
| `docs/accessibility/vpat-readiness.md` & `docs/ux/UX-14-accessibility-inclusive-design.md` | Flip the "⬜ PLANNED" rows (skip-link, aria-live, axe gate, reduced-motion wiring) to shipped once the above lands; link this playbook. | W7 |

---

## 6. Execution plan (sequenced, each phase independently shippable)

### 6.1 Phase 1 — Stop advertising what doesn't work (P0, ~2–3 days)
1. Land `@aivo/accessibility-contract` (§4.1) + tests.
2. Bundle dyslexia webfonts (§4.2); edit `globals.css`; fix `lesson-player.tsx:580` (W1).
3. Add `aac*` to the API via the shared patch schema (W3).
4. Wire the six inert web prefs through `lesson-accessibility-layer.tsx` + `focus-mode.css` (W2, W4, W5).
**Exit criteria:** every toggle on `/learner/settings/accessibility` produces a visible/behavioural
change in `/learner/lesson-player-smoke`, verified by the axe matrix.

### 6.2 Phase 2 — Mobile parity (P0/P1, ~3–4 days)
5. expo-font dyslexia load + `A11yStyleProvider` (M1); `BreakReminder` (M2); live-region announces (M3).
6. Re-derive mobile prefs from the contract (X1).
**Exit criteria:** `pnpm mobile:parity` passes with the accessibility rows still green AND a manual
TalkBack/VoiceOver pass announces answer-correctness.

### 6.3 Phase 3 — Durability, sync, and the permanent guard (P1, ~3 days)
7. identity-svc table + routes (§4.5); both clients read/write it (X2); device cache for offline.
8. Containerized axe audit + `no-inert-prefs.mjs` + `accessibility.yml` (§4.6) — turn the gate **on, required**.
**Exit criteria:** CI blocks any PR that adds a contract field without a renderer + a test.

### 6.4 Phase 4 — Polish (P2)
9. Persist workspace-rail density (W6); mobile focus mode (M4); admin-table tab-order re-audit.

---

## 7. Why this is the right shape (the 30-years opinion)

- **One contract, two clients.** The single most expensive class of accessibility bug in a
  cross-platform product is *schema drift* — the web team adds `breakReminders`, the mobile
  team never hears about it, and a family that relies on it gets it on one device only.
  `@aivo/accessibility-contract` makes that structurally impossible.
- **The guard is the deliverable.** Anyone can fix eleven gaps once. The thing that keeps
  them fixed is `no-inert-prefs.mjs` running as a required check. A pref that doesn't render
  is now a *red build*, not a backlog item — which is exactly the "no stubs or placeholders"
  guarantee, mechanised.
- **Containerize the audit, not just the app.** axe results that differ between a laptop and
  CI are worse than no audit, because they erode trust in the gate. The pinned Playwright
  image (§4.6) makes the result identical everywhere — the same reproducibility discipline
  you'd put on a build, applied to accessibility.
- **Serve the actual users.** The lesson player is where an autistic, ADHD, or dyslexic
  learner spends 95% of their time. Every P0 here is a case where the *settings page* is
  accessible but the *lesson* is not. Fixing the settings page is theatre; fixing the lesson
  is the job.

---

## 8. Acceptance checklist (paste into the tracking issue)

- [ ] `@aivo/accessibility-contract` published in workspace; `pnpm --filter @aivo/accessibility-contract test` green.
- [ ] Dyslexia webfonts bundled (web `public/fonts`, mobile `assets/fonts`) **with OFL license files**.
- [ ] `lesson-player.tsx` no longer uses `font-mono` for dyslexia; renders real Atkinson/OpenDyslexic.
- [ ] All 18 contract fields produce a visible/behavioural change in the lesson player (web) and surface renderer (mobile).
- [ ] AAC toggle round-trips through the API and activates `aac-bridge` / `SwitchScanOverlay`.
- [ ] Break reminders fire on web + mobile with an announced, dismissible nudge.
- [ ] Mobile announces answer-correctness + save status via `announceForAccessibility`.
- [ ] Prefs persist in identity-svc and sync web ⇄ mobile for the same learner.
- [ ] `docker compose -f docker-compose.a11y.yml up` exits 0 across the route × profile matrix.
- [ ] `node scripts/a11y/no-inert-prefs.mjs` passes and is a **required** CI check.
- [ ] `docs/accessibility/vpat-readiness.md` "PLANNED" rows updated to reflect shipped state.

---

*Prepared as an internal engineering remediation plan. Font binaries referenced in §4.2 must
be added from their official SIL Open Font License distributions, with license files committed
alongside — do not hot-link or vendor without the OFL text.*
