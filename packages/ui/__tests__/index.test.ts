/**
 * Sprint 12.6 — smoke test for @aivo/ui.
 *
 * The bulk of @aivo/ui is React component primitives that need a DOM
 * + JSX runtime to assert against. To keep this smoke test minimal
 * (no jsdom, no @testing-library/react) we only exercise the
 * non-React utility surface — `cn` (class-name composer) — which
 * proves the package is importable and its build/exports map work.
 *
 * Coverage of the actual React primitives lives in Storybook +
 * apps/web-v2 / apps/marketing integration tests; this file only
 * exists to satisfy the CI coverage gate.
 */
import { describe, it, expect } from "vitest";
import { cn } from "../src/utils/cn";

describe("@aivo/ui smoke", () => {
  it("cn composes string class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("cn drops falsy values per the clsx contract", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("cn flattens conditional object form", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });
});
