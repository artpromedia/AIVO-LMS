import { Platform } from "react-native";

// In development each microservice is reachable on its own port on the host
// machine. iOS simulators see the host as `localhost`; Android emulators see
// it as `10.0.2.2`. On web (Expo web / Metro on web) we hit Next.js's rewrite
// proxy on the same origin, so no host prefix is needed.
const DEV_HOST = Platform.select({
  ios: "http://localhost",
  android: "http://10.0.2.2",
  web: "",
  default: "",
});

// Per-service ports used by the local dev stack. These line up 1:1 with the
// service URLs in `apps/web/next.config.ts` (IDENTITY_SVC_URL, …).
const DEV_PORTS = {
  IDENTITY: 3001,
  BRAIN: 3002,
  ASSESSMENT: 3003,
  AI: 3004,
  LEARNING: 3005,
  TUTOR: 3006,
  FAMILY: 3007,
  ENGAGEMENT: 3008,
  BILLING: 3009,
  COMMS: 3010,
  I18N: 3011,
  INTEGRATIONS: 3012,
  ADMIN: 3013,
} as const;

// In production the mobile app normally talks to a single ingress (the same
// gateway that fronts the web app). EXPO_PUBLIC_API_URL must be the full
// origin (e.g. `https://api.aivo.example.com`) with NO trailing slash and NO
// port. Routing to individual services is handled server-side by path prefix
// (matching the `apps/web/next.config.ts` rewrites).
//
// For deployments where a service lives on its own dedicated origin (most
// commonly identity-svc behind its own auth-cookie-scoped domain, e.g.
// `https://auth.aivo.example.com`), set the corresponding
// `EXPO_PUBLIC_<SERVICE>_URL` env var. The per-service value wins over
// `EXPO_PUBLIC_API_URL` when present. Examples:
//
//   EXPO_PUBLIC_API_URL=https://api.aivo.example.com
//   EXPO_PUBLIC_IDENTITY_URL=https://auth.aivo.example.com
//   EXPO_PUBLIC_BILLING_URL=https://billing.aivo.example.com
//
// All overrides are read at build time (Expo public env vars), so changing
// them requires a new EAS / `expo export` build.
const PROD_BASE = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");

// Per-service overrides — empty string means "fall back to PROD_BASE".
const PROD_OVERRIDES = {
  IDENTITY: (process.env.EXPO_PUBLIC_IDENTITY_URL || "").replace(/\/+$/, ""),
  BRAIN: (process.env.EXPO_PUBLIC_BRAIN_URL || "").replace(/\/+$/, ""),
  ASSESSMENT: (process.env.EXPO_PUBLIC_ASSESSMENT_URL || "").replace(/\/+$/, ""),
  AI: (process.env.EXPO_PUBLIC_AI_URL || "").replace(/\/+$/, ""),
  LEARNING: (process.env.EXPO_PUBLIC_LEARNING_URL || "").replace(/\/+$/, ""),
  TUTOR: (process.env.EXPO_PUBLIC_TUTOR_URL || "").replace(/\/+$/, ""),
  FAMILY: (process.env.EXPO_PUBLIC_FAMILY_URL || "").replace(/\/+$/, ""),
  ENGAGEMENT: (process.env.EXPO_PUBLIC_ENGAGEMENT_URL || "").replace(/\/+$/, ""),
  BILLING: (process.env.EXPO_PUBLIC_BILLING_URL || "").replace(/\/+$/, ""),
  COMMS: (process.env.EXPO_PUBLIC_COMMS_URL || "").replace(/\/+$/, ""),
  I18N: (process.env.EXPO_PUBLIC_I18N_URL || "").replace(/\/+$/, ""),
  INTEGRATIONS: (process.env.EXPO_PUBLIC_INTEGRATIONS_URL || "").replace(/\/+$/, ""),
  ADMIN: (process.env.EXPO_PUBLIC_ADMIN_URL || "").replace(/\/+$/, ""),
} as const;

type ServiceKey = keyof typeof DEV_PORTS;

// Surface an obvious warning at startup when the production build was
// shipped without the API origin baked in. Without this, every API call
// silently resolves to a relative path against the empty string and the
// failure mode is "the app appears broken" with no signal to the operator.
// We only warn (don't throw) so that web/Metro can still boot for inspection.
if (!__DEV__ && !PROD_BASE && Object.values(PROD_OVERRIDES).every((v) => !v)) {
  console.warn(
    "[aivo] EXPO_PUBLIC_API_URL is not set for this production build — " +
      "all API calls will fail. Set it (or the per-service " +
      "EXPO_PUBLIC_<SERVICE>_URL overrides) via EAS env / app.config and rebuild.",
  );
}

function svc(key: ServiceKey): string {
  if (__DEV__) return `${DEV_HOST}:${DEV_PORTS[key]}`;
  return PROD_OVERRIDES[key] || PROD_BASE;
}

export const API = {
  IDENTITY: svc("IDENTITY"),
  BRAIN: svc("BRAIN"),
  ASSESSMENT: svc("ASSESSMENT"),
  AI: svc("AI"),
  LEARNING: svc("LEARNING"),
  TUTOR: svc("TUTOR"),
  FAMILY: svc("FAMILY"),
  ENGAGEMENT: svc("ENGAGEMENT"),
  BILLING: svc("BILLING"),
  COMMS: svc("COMMS"),
  I18N: svc("I18N"),
  INTEGRATIONS: svc("INTEGRATIONS"),
  ADMIN: svc("ADMIN"),
} as const;
