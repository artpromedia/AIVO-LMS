import { Platform } from 'react-native';

// In development each microservice is reachable on its own port on the host
// machine. iOS simulators see the host as `localhost`; Android emulators see
// it as `10.0.2.2`. On web (Expo web / Metro on web) we hit Next.js's rewrite
// proxy on the same origin, so no host prefix is needed.
const DEV_HOST = Platform.select({
  ios: 'http://localhost',
  android: 'http://10.0.2.2',
  web: '',
  default: '',
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

// In production the mobile app talks to a single ingress (the same gateway
// that fronts the web app). EXPO_PUBLIC_API_URL must be the full origin
// (e.g. `https://api.aivo.example.com`) with NO trailing slash and NO port.
// Routing to individual services is handled server-side by path prefix
// (matching the `apps/web/next.config.ts` rewrites).
const PROD_BASE = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

// Surface an obvious warning at startup when the production build was
// shipped without the API origin baked in. Without this, every API call
// silently resolves to a relative path against the empty string and the
// failure mode is "the app appears broken" with no signal to the operator.
// We only warn (don't throw) so that web/Metro can still boot for inspection.
if (!__DEV__ && !PROD_BASE) {
   
  console.warn(
    '[aivo] EXPO_PUBLIC_API_URL is not set for this production build — ' +
      'all API calls will fail. Set it via EAS env / app.config and rebuild.',
  );
}

function svc(port: number): string {
  if (__DEV__) return `${DEV_HOST}:${port}`;
  return PROD_BASE;
}

export const API = {
  IDENTITY: svc(DEV_PORTS.IDENTITY),
  BRAIN: svc(DEV_PORTS.BRAIN),
  ASSESSMENT: svc(DEV_PORTS.ASSESSMENT),
  AI: svc(DEV_PORTS.AI),
  LEARNING: svc(DEV_PORTS.LEARNING),
  TUTOR: svc(DEV_PORTS.TUTOR),
  FAMILY: svc(DEV_PORTS.FAMILY),
  ENGAGEMENT: svc(DEV_PORTS.ENGAGEMENT),
  BILLING: svc(DEV_PORTS.BILLING),
  COMMS: svc(DEV_PORTS.COMMS),
  I18N: svc(DEV_PORTS.I18N),
  INTEGRATIONS: svc(DEV_PORTS.INTEGRATIONS),
  ADMIN: svc(DEV_PORTS.ADMIN),
} as const;
