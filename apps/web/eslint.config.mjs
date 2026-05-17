import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

// Phase 5.last (api-client guard): hand-rolled `interface FooResponse`
// shapes drift from the real wire format. The generated typed client
// at `@aivo/api-client/<svc>` exposes the wire format as
// `paths["/api/..."]['responses']['200']['content']['application/json']`
// which stays in sync with the service's Fastify schema. New call-sites
// must import from the generated client instead of declaring a fresh
// interface. Existing offenders are explicitly allowlisted below until
// each is migrated.
//
// Severity: `warn` for now to match the corresponding drift workflow,
// which is currently a soft signal (continue-on-error). When 5.2 is
// complete for every service, flip both to `error` in lockstep.
const interfaceResponseSelector = {
  selector: "TSInterfaceDeclaration[id.name=/Response$/]",
  message:
    "Do not declare hand-rolled `interface *Response` types. Import the response shape from `@aivo/api-client/<svc>` via `paths[\"/your/path\"]['responses']['200']['content']['application/json']` so it stays in sync with the service. If the source service has not been migrated to per-route schemas yet, add an explicit `// eslint-disable-next-line no-restricted-syntax` with a TODO referencing the service.",
};

// Tier-theme contract: dashboard surfaces must drive colour off the
// `--tier-*` / `--visual-*` CSS variables (or HSL fragments referencing
// them) so promoting a learner across age tiers re-skins the UI without
// touching components. Raw hex literals — both `#RRGGBB` and the
// `#RRGGBBAA` alpha-channel form — bypass this contract.
const dashboardHexLiteralSelector = {
  // {6} matches #RRGGBB, {8} matches #RRGGBBAA. The negative lookahead
  // on `[0-9a-fA-F]` after the {6,8} run prevents false matches against
  // e.g. 10+ char hex hashes / IDs.
  selector: "Literal[value=/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])/]",
  message:
    "Avoid raw #RRGGBB/#RRGGBBAA hex in dashboard files. Prefer hsl(var(--visual-*)) / var(--tier-*) so the surface re-skins per age tier. If unavoidable (e.g. third-party brand mark), add an eslint-disable comment with rationale.",
};
const dashboardHexTemplateSelector = {
  selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?(?![0-9a-fA-F])/]",
  message:
    "Avoid raw #RRGGBB/#RRGGBBAA hex in dashboard files. Prefer hsl(var(--visual-*)) / var(--tier-*) so the surface re-skins per age tier. If unavoidable (e.g. third-party brand mark), add an eslint-disable comment with rationale.",
};

export default tseslint.config(
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    plugins: {
      "jsx-a11y": jsxA11y,
      "react-hooks": reactHooks,
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": ["error", {
        controlComponents: ["Toggle", "AccessibleToggle"],
        assert: "either",
        depth: 3,
      }],
      "no-restricted-syntax": ["warn", interfaceResponseSelector],
    },
  },
  // Dashboard files: layer the tier-theme hex guard on top of the
  // global api-client guard. ESLint replaces (not merges) rule
  // configurations across blocks, so we re-list the interface guard
  // here too — otherwise it would be silently dropped for dashboard
  // files. The corresponding hex regression tests live in
  // `src/app/dashboard/**` smoke tests.
  {
    files: ["src/app/dashboard/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        interfaceResponseSelector,
        dashboardHexLiteralSelector,
        dashboardHexTemplateSelector,
      ],
    },
  },
  // Phase 5.last allowlist: existing hand-rolled `interface *Response`
  // declarations predate the api-client guard. Each entry should be
  // removed in a follow-up PR that replaces the interface with the
  // corresponding `paths[...]` import once the source service has its
  // per-route response schema declared. Do not extend this list — new
  // call-sites must import from `@aivo/api-client/<svc>`.
  {
    files: [
      "src/lib/session-heartbeat.ts",
      "src/app/dashboard/admin/compliance/audit-log/page.tsx",
      "src/app/dashboard/admin/ai/moderation/page.tsx",
      "src/app/dashboard/admin/billing/daily-batch/page.tsx",
      "src/app/dashboard/admin/jobs/freshness/page.tsx",
    ],
    rules: {
      // The hex-literal selectors only apply to dashboard files; the
      // four dashboard entries below would lose them if we just
      // disabled the rule. Re-enable hex guard, drop the interface
      // selector. session-heartbeat is not a dashboard file so the
      // hex selectors are no-ops there but harmless.
      "no-restricted-syntax": [
        "warn",
        dashboardHexLiteralSelector,
        dashboardHexTemplateSelector,
      ],
    },
  },
);
