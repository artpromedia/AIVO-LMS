import expoConfig from "eslint-config-expo/flat.js";
import reactNativeA11y from "eslint-plugin-react-native-a11y";

// Phase 5.last (api-client guard): hand-rolled `interface FooResponse`
// shapes drift from the real wire format. The generated typed client
// at `@aivo/api-client/<svc>` exposes the wire format as
// `paths["/api/..."]['responses']['200']['content']['application/json']`
// which stays in sync with the service's Fastify schema. New call-sites
// must import from the generated client instead of declaring a fresh
// interface. Existing offenders are explicitly allowlisted below.
//
// Severity: `warn` for now to match the corresponding drift workflow,
// which is currently a soft signal (continue-on-error). When 5.2 is
// complete for every service, flip both to `error` in lockstep.
const interfaceResponseSelector = {
  selector: "TSInterfaceDeclaration[id.name=/Response$/]",
  message:
    "Do not declare hand-rolled `interface *Response` types. Import the response shape from `@aivo/api-client/<svc>` via `paths[\"/your/path\"]['responses']['200']['content']['application/json']` so it stays in sync with the service. If the source service has not been migrated to per-route schemas yet, add an explicit `// eslint-disable-next-line no-restricted-syntax` with a TODO referencing the service.",
};

export default [
  ...expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*", "android/*", "ios/*"],
  },
  {
    files: ["scripts/**/*.{js,cjs}"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        global: "readonly",
        exports: "writable",
      },
      sourceType: "commonjs",
    },
  },
  {
    // ESM script files use `import`/`export` and must be parsed as modules.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", Buffer: "readonly" },
      sourceType: "module",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn", interfaceResponseSelector],
    },
  },
  // Sprint A4 — screen-reader floor. Every interactive element must carry
  // an accessibility role/label/state; violations are build-breaking
  // (lint runs with the repo gate). The companion ratchet
  // (scripts/mobile-a11y-label-ratchet.mjs) keeps coverage from regressing
  // in files eslint can't parse.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    plugins: { "react-native-a11y": reactNativeA11y },
    rules: {
      "react-native-a11y/has-accessibility-hint": "off",
      "react-native-a11y/has-accessibility-props": "error",
      "react-native-a11y/has-valid-accessibility-actions": "error",
      "react-native-a11y/has-valid-accessibility-component-type": "error",
      "react-native-a11y/has-valid-accessibility-descriptors": "error",
      "react-native-a11y/has-valid-accessibility-ignores-invert-colors": "error",
      "react-native-a11y/has-valid-accessibility-live-region": "error",
      "react-native-a11y/has-valid-accessibility-role": "error",
      "react-native-a11y/has-valid-accessibility-state": "error",
      "react-native-a11y/has-valid-accessibility-states": "off",
      "react-native-a11y/has-valid-accessibility-traits": "off",
      "react-native-a11y/has-valid-accessibility-value": "error",
      "react-native-a11y/no-nested-touchables": "error",
    },
  },
  // Sprint 13 — the decomposed learning surfaces are `any`-clean by
  // construction; lock that in. The repo-wide rule stays `warn` (60
  // recorded escape hatches outside this tree await a future pass);
  // inside the learning dir a new `any` is a build break.
  {
    files: ["src/components/learning/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // Phase 5.last allowlist: existing hand-rolled `interface *Response`
  // declarations predate the api-client guard. Each entry should be
  // removed in a follow-up PR that replaces the interface with the
  // corresponding `paths[...]` import once the source service has its
  // per-route response schema declared. Do not extend this list.
  {
    files: [
      "src/components/settings/MfaFactorsCard.tsx",
      "hooks/useLearnerMilestones.ts",
      "hooks/useParentInbox.ts",
      "hooks/useFamily.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
