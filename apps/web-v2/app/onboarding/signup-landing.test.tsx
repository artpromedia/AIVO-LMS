// @vitest-environment jsdom

/**
 * Task #40 — "signed up → lands on the right starting screen" end-to-end guard.
 *
 * This couples three things the signup funnel relies on, which were previously
 * only tested in isolation:
 *
 *  1. The signup form emits a per-persona `next` destination. We render the
 *     REAL `SignupPage`, click each role, and read the hidden `role` / `next`
 *     inputs the form would post — proving the live mapping, not a copy of it.
 *  2. A freshly-registered account actually LANDS on that destination. We feed
 *     the exact `role` + `next` the form produced into the REAL `registerAction`
 *     and assert it redirects there (parent → /onboarding/parent-setup, staff →
 *     /onboarding/invite/{school,district}).
 *  3. Each landing page renders the right onboarding for a brand-new account
 *     without an auth error — the persona's destination mounts and shows its
 *     own copy.
 *
 * `registerAction` ends in `redirect()` (which throws in Next), so its calls
 * are expected to reject — the assertion is on the thrown destination.
 */
import * as React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/lib/i18n/messages/en.json";

// next/navigation: redirect() halts by throwing (Next contract); the client
// pages also pull useSearchParams / useRouter, stubbed to inert defaults.
const redirectMock = vi.fn((url: string): never => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  useSearchParams: () => ({ get: (_key: string) => null }),
  useRouter: () => ({ push: routerPush, replace: vi.fn(), prefetch: vi.fn() }),
}));

const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet, get: (_k: string) => undefined }),
}));

// Force a real (non-mock) auth mode so registerAction takes the identity-svc
// path and redirects to `next` instead of bouncing to the demo login.
vi.mock("@/lib/env", () => ({
  serverEnv: { AUTH_MODE: "custom" },
}));

const identityRegister = vi.fn();
const extractRefreshToken = vi.fn((..._a: unknown[]) => "refresh_tok");
const toSessionProfile = vi.fn();
vi.mock("@/lib/auth/identity-client", () => ({
  identityRegister: (...a: unknown[]) => identityRegister(...a),
  extractRefreshToken: (...a: unknown[]) => extractRefreshToken(...a),
  toSessionProfile: (...a: unknown[]) => toSessionProfile(...a),
  identityJoinOrganization: vi.fn(),
  IDENTITY_ACCESS_TOKEN_COOKIE: "aivo_at",
}));

const setAuthSessionCookies = vi.fn();
vi.mock("@/lib/auth/session-cookies", () => ({
  setAuthSessionCookies: (...a: unknown[]) => setAuthSessionCookies(...a),
}));

// Brand wordmark relies on Next's automatic JSX runtime (no React import), which
// vitest's classic transform rejects; stub it — it has no bearing on the funnel.
vi.mock("@/components/auth/auth-brand-mark", () => ({
  AivoBrandMark: () => null,
}));

// The presentational @aivo/ui pieces are exercised by their own package tests;
// stub them to lightweight DOM so the client surfaces mount under jsdom while
// still rendering their i18n-driven titles/labels and child controls.
vi.mock("@aivo/ui/icon", () => ({
  AivoIcon: () => null,
}));
vi.mock("@aivo/ui/auth", () => ({
  AuthSplitLayout: ({ children, panel }: { children: React.ReactNode; panel?: React.ReactNode }) => (
    <div>
      {panel}
      {children}
    </div>
  ),
  AuthSidePanel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AuthTrustCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AuthSecureFooter: () => null,
  AuthShell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AuthCard: ({
    title,
    children,
    actions,
  }: {
    title?: React.ReactNode;
    children?: React.ReactNode;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
      {actions}
    </div>
  ),
  AuthInput: ({ id, label }: { id?: string; label?: React.ReactNode }) => (
    <label>
      {label}
      <input id={id} />
    </label>
  ),
  ReassuranceCard: () => null,
  StepperHeader: () => null,
}));

import SignupPage from "@/app/signup/page";
import { registerAction } from "@/lib/auth/auth-actions";
import ParentSetupPage from "@/app/onboarding/parent-setup/page";
import SchoolInvitePage from "@/app/onboarding/invite/school/page";
import DistrictInvitePage from "@/app/onboarding/invite/district/page";

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {node}
    </NextIntlClientProvider>
  );
}

const VALID = {
  name: "Sam Signup",
  email: "sam@example.com",
  password: "S3cure-Signup-Pass!9",
};

/** The persona → starting-screen contract the funnel must honor. */
const PERSONAS = [
  { role: "PARENT", next: "/onboarding/parent-setup" },
  { role: "TEACHER", next: "/onboarding/invite/school" },
  { role: "SCHOOL_ADMIN", next: "/onboarding/invite/school" },
  { role: "DISTRICT_ADMIN", next: "/onboarding/invite/district" },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  identityRegister.mockResolvedValue({
    kind: "ok",
    user: { id: "u_1", email: VALID.email, name: VALID.name, role: "PARENT", tenantId: "t_1" },
    accessToken: "access_tok",
    setCookies: [],
  });
  toSessionProfile.mockReturnValue({
    userId: "u_1",
    tenantId: "t_1",
    role: "parent",
    email: VALID.email,
    displayName: VALID.name,
    permissions: [],
  });
});

afterEach(() => {
  cleanup();
});

describe("signup form emits a per-persona `next` destination", () => {
  it("maps each role button to its onboarding starting screen", () => {
    const { container } = render(withIntl(<SignupPage />));

    // The four role cards are the only aria-pressed buttons; the submit button
    // lives outside the form (via `form=`) and carries no aria-pressed.
    const roleButtons = container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]");
    expect(roleButtons).toHaveLength(PERSONAS.length);

    const roleInput = () => container.querySelector<HTMLInputElement>('input[name="role"]')!;
    const nextInput = () => container.querySelector<HTMLInputElement>('input[name="next"]')!;

    PERSONAS.forEach((persona, i) => {
      fireEvent.click(roleButtons[i]);
      expect(roleInput().value).toBe(persona.role);
      expect(nextInput().value).toBe(persona.next);
    });
  });
});

describe("a freshly-registered account lands on its starting screen", () => {
  for (const persona of PERSONAS) {
    it(`registering as ${persona.role} redirects to ${persona.next}`, async () => {
      const form = new FormData();
      form.set("name", VALID.name);
      form.set("email", VALID.email);
      form.set("password", VALID.password);
      form.set("role", persona.role);
      form.set("next", persona.next);

      await expect(registerAction(form)).rejects.toThrow(`NEXT_REDIRECT:${persona.next}`);
      expect(identityRegister).toHaveBeenCalledWith(expect.objectContaining({ role: persona.role }));
      expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
    });
  }
});

describe("landing pages render the right onboarding for a brand-new account", () => {
  it("parent → /onboarding/parent-setup shows the household setup", () => {
    render(withIntl(<ParentSetupPage />));
    expect(
      screen.getByRole("heading", { name: messages.onboarding.parent_setup.title }),
    ).toBeDefined();
  });

  it("teacher / school admin → /onboarding/invite/school shows the join-school screen", () => {
    render(withIntl(<SchoolInvitePage />));
    expect(
      screen.getByRole("heading", { name: messages.onboarding.invite_school.title }),
    ).toBeDefined();
  });

  it("district admin → /onboarding/invite/district shows the join-district screen", () => {
    render(withIntl(<DistrictInvitePage />));
    expect(
      screen.getByRole("heading", { name: messages.onboarding.invite_district.title }),
    ).toBeDefined();
  });
});
