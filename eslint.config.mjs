import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "**/.venv/**",
      "**/*.config.{js,mjs,ts}",
      "**/*.config.cjs",
      "**/next-env.d.ts",
      "**/vitest.setup.ts",
      "**/lighthouserc.js",
      "**/scripts/**",
      // apps/mobile owns its own ESLint config.
      "apps/mobile/**",
      // Generated OpenAPI typed client.
      "packages/api-client/src/_generated/**",
      "packages/api-client/openapi/**",
      // Drizzle generated SQL/meta.
      "packages/db/drizzle/**",
      "**/migrations/**",
      // Build/test snapshot output.
      "**/__snapshots__/**",
      "**/*.snap",
      // Public static assets — not source code, served as-is.
      "apps/*/public/**",
    ],
  },
  {
    // Default rules — strict, applies to root-level scripts and any file not
    // matched by the fleet-wide override below.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Fleet-wide expansion: ESLint now also inspects every Node service and
    // the previously-ignored shared packages. Findings are warnings rather
    // than errors so the gate can be tightened incrementally as the backlog
    // is cleared. Run via `pnpm lint:fleet`.
    files: [
      "services/**/*.{ts,tsx,js,mjs,cjs}",
      "packages/db/**/*.{ts,tsx,js,mjs,cjs}",
      "packages/events/**/*.{ts,tsx,js,mjs,cjs}",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "no-empty": "warn",
      "no-prototype-builtins": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "no-async-promise-executor": "warn",
      "no-misleading-character-class": "warn",
      "no-fallthrough": "warn",
      "no-case-declarations": "warn",
      "no-undef": "off",
      // Drizzle/Fastify generics often legitimately use `any` at boundaries.
    },
  },
  {
    // Inclusive-Lab Warm: forbid hardcoded hex colors in `apps/web-v2` and
    // `apps/marketing` so all surface colors flow through the brand tokens
    // (`@aivo/brand/tokens.css` CSS variables and `iw-*` Tailwind utilities).
    // Replaces the legacy `apps/web-v2/.eslintrc.json` which was tied to the
    // deprecated `next lint` wrapper and incompatible with ESLint 10.
    files: ["apps/web-v2/**/*.{ts,tsx}", "apps/marketing/**/*.{ts,tsx}"],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/*.spec.{ts,tsx}",
      "apps/web-v2/e2e/**",
      "apps/web-v2/lib/env.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message:
            "Do not hardcode hex colors. Use Inclusive-Warm Tailwind utilities (bg-iw-*, text-iw-*, border-iw-*) or the @aivo/brand CSS variables instead.",
        },
        {
          selector:
            "TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message:
            "Do not hardcode hex colors. Use Inclusive-Warm Tailwind utilities (bg-iw-*, text-iw-*, border-iw-*) or the @aivo/brand CSS variables instead.",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(className|style|class)$/] Literal[value=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]",
          message:
            "Do not hardcode hex colors in JSX className/style attributes. Use Inclusive-Warm Tailwind utilities (bg-iw-*, text-iw-*, border-iw-*) or the @aivo/brand CSS variables instead.",
        },
      ],
    },
  },
  // Sprint 08 — client data-path discipline: components/ are client-heavy;
  // new network calls go through lib/api/client.ts (bffFetch) or a Query
  // hook. The CI ratchet (scripts/ci/check-bare-fetch.mjs) is the hard
  // gate; this rule is the in-editor nudge at the highest-traffic spot.
  {
    // Enforced where the migration is complete; remaining families (admin
    // legacy, auth, forms, admin-adjacent) are frozen by the CI ratchet's
    // baseline and join this list as they are migrated.
    files: [
      "apps/web-v2/components/parent/**/*.{ts,tsx}",
      "apps/web-v2/components/learner/**/*.{ts,tsx}",
      "apps/web-v2/components/layout/**/*.{ts,tsx}",
      "apps/web-v2/components/system/**/*.{ts,tsx}",
      "apps/web-v2/components/ui/**/*.{ts,tsx}",
      "apps/web-v2/components/playful-calm/**/*.{ts,tsx}",
    ],
    // components/admin/** predate the data layer and belong to the legacy
    // /admin surfaces (now served by apps/web-admin); they are frozen by the
    // CI ratchet's baseline rather than migrated piecemeal here.
    ignores: ["**/*.test.*", "**/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "Use bffFetch from @/lib/api/client (or a TanStack Query hook) instead of bare fetch — typed envelope, retries and error surfacing come free.",
        },
      ],
    },
  },
);

