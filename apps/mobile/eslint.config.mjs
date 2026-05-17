import expoConfig from "eslint-config-expo/flat.js";

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
    files: ["scripts/**/*.{js,cjs,mjs}"],
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
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn", interfaceResponseSelector],
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
