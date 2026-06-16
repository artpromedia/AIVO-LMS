// @vitest-environment jsdom

/**
 * Render contract for the signup page's failure banner.
 *
 * `registerAction` maps each identity-svc failure to a user-facing `error`
 * code and bounces back to `/signup?error=<code>` (proven in
 * `lib/auth/auth-actions.test.ts`). This closes the other half of that loop:
 * given the resulting `?error=<code>`, the signup page must render the
 * matching translated banner copy — and fall back to the generic message for
 * an unknown code so a stray query value never shows a raw key or nothing.
 */
import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/lib/i18n/messages/en.json";

// useSearchParams drives the banner; each test swaps the returned `error`.
let currentError: string | null = null;
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "error" ? currentError : null) }),
}));

// registerAction is a server action that pulls in next/headers + identity-svc;
// the form's `action` reference is all the page needs, so stub it inert.
vi.mock("@/lib/auth/auth-actions", () => ({
  registerAction: vi.fn(),
}));

// Brand wordmark uses Next's automatic JSX runtime (no React import), which
// vitest's classic transform rejects; stub it — irrelevant to the banner.
vi.mock("@/components/auth/auth-brand-mark", () => ({
  AivoBrandMark: () => null,
}));

// Presentational pieces have their own package tests; reduce them to inert
// DOM so the page mounts under jsdom while the real Banner still renders.
vi.mock("@aivo/ui/icon", () => ({
  AivoIcon: () => null,
}));
vi.mock("@aivo/ui/auth", () => ({
  AuthInput: ({ id, label }: { id?: string; label?: React.ReactNode }) => (
    <label>
      {label}
      <input id={id} />
    </label>
  ),
}));
vi.mock("@/components/auth/auth-split-layout", () => ({
  AuthSplitLayout: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AuthSidePanel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AuthTrustCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AuthSecureFooter: () => null,
}));

import SignupPage from "@/app/signup/page";

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {node}
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  currentError = null;
  cleanup();
});

const ERRORS = messages.auth.signup.errors;

/** Each `?error=<code>` registerAction can emit → its friendly banner copy. */
const ERROR_CASES = [
  { code: "invalid_input", copy: ERRORS.invalid_input },
  { code: "email_taken", copy: ERRORS.email_taken },
  { code: "weak_password", copy: ERRORS.weak_password },
  { code: "service_unavailable", copy: ERRORS.service_unavailable },
  { code: "unsupported_role", copy: ERRORS.unsupported_role },
  { code: "signup_failed", copy: ERRORS.signup_failed },
] as const;

describe("signup page failure banner", () => {
  for (const { code, copy } of ERROR_CASES) {
    it(`shows the friendly message for error=${code}`, () => {
      currentError = code;
      render(withIntl(<SignupPage />));

      const banner = screen.getByRole("alert");
      expect(banner.textContent).toContain(copy);
    });
  }

  it("falls back to the generic message for an unknown error code", () => {
    currentError = "totally_made_up_code";
    render(withIntl(<SignupPage />));

    expect(screen.getByRole("alert").textContent).toContain(ERRORS.signup_failed);
  });

  it("renders no banner when there is no error query param", () => {
    currentError = null;
    render(withIntl(<SignupPage />));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
