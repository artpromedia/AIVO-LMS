import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// next.config is loaded with `phase` in the function form. We use that to
// distinguish a production *build* (where service URLs are baked in via Helm
// at runtime, not at build time) from a production *server start* (where the
// URLs MUST be present or rewrites will silently target localhost).
const buildConfig = (phase: string): NextConfig => {
  const IS_PROD = process.env.NODE_ENV === "production";
  const IS_BUILD_PHASE = phase === PHASE_PRODUCTION_BUILD;
  function requireUrl(name: string, devDefault: string): string {
    const v = process.env[name];
    if (v) return v;
    if (IS_PROD && !IS_BUILD_PHASE) throw new Error(`apps/web: ${name} must be set in production`);
    return devDefault;
  }

  const IDENTITY_SVC_URL    = requireUrl("IDENTITY_SVC_URL",    "http://localhost:3001");
  const BRAIN_SVC_URL       = requireUrl("BRAIN_SVC_URL",       "http://localhost:3002");
  const ASSESSMENT_SVC_URL  = requireUrl("ASSESSMENT_SVC_URL",  "http://localhost:3003");
  const AI_SVC_URL          = requireUrl("AI_SVC_URL",          "http://localhost:3004");
  const LEARNING_SVC_URL    = requireUrl("LEARNING_SVC_URL",    "http://localhost:3005");
  const TUTOR_SVC_URL       = requireUrl("TUTOR_SVC_URL",       "http://localhost:3006");
  const FAMILY_SVC_URL      = requireUrl("FAMILY_SVC_URL",      "http://localhost:3007");
  const ENGAGEMENT_SVC_URL  = requireUrl("ENGAGEMENT_SVC_URL",  "http://localhost:3008");
  const BILLING_SVC_URL     = requireUrl("BILLING_SVC_URL",     "http://localhost:3009");
  const COMMS_SVC_URL       = requireUrl("COMMS_SVC_URL",       "http://localhost:3010");
  const I18N_SVC_URL        = requireUrl("I18N_SVC_URL",        "http://localhost:3011");
  const INTEGRATIONS_SVC_URL = requireUrl("INTEGRATIONS_SVC_URL", "http://localhost:3012");
  const ADMIN_SVC_URL       = requireUrl("ADMIN_SVC_URL",       "http://localhost:3013");
  const STATUS_PAGE_SVC_URL = requireUrl("STATUS_PAGE_SVC_URL", "http://localhost:3014");
  const RESEARCH_SVC_URL    = requireUrl("RESEARCH_SVC_URL",    "http://localhost:3015");

  const nextConfig: NextConfig = {
    output: "standalone",
    reactStrictMode: true,
    allowedDevOrigins: [
      "*.replit.dev",
      "*.replit.app",
      "*.janeway.replit.dev",
      "*.riker.replit.dev",
    ],
    async rewrites() {
      return [
        { source: "/api/admin/:path*",        destination: `${IDENTITY_SVC_URL}/api/admin/:path*` },
        { source: "/api/auth/:path*",         destination: `${IDENTITY_SVC_URL}/api/auth/:path*` },
        { source: "/api/users/:path*",        destination: `${IDENTITY_SVC_URL}/api/users/:path*` },
        { source: "/api/avatars/:path*",      destination: `${IDENTITY_SVC_URL}/api/avatars/:path*` },
        { source: "/api/consent/:path*",      destination: `${IDENTITY_SVC_URL}/api/consent/:path*` },
        { source: "/api/curriculum/:path*",   destination: `${IDENTITY_SVC_URL}/api/curriculum/:path*` },
        { source: "/api/assessments/:path*",  destination: `${ASSESSMENT_SVC_URL}/api/assessments/:path*` },
        { source: "/api/iep/:path*",          destination: `${ASSESSMENT_SVC_URL}/api/iep/:path*` },
        { source: "/api/brain/:path*",        destination: `${BRAIN_SVC_URL}/api/brain/:path*` },
        { source: "/api/ai/:path*",           destination: `${AI_SVC_URL}/api/ai/:path*` },
        { source: "/api/learning/:path*",     destination: `${LEARNING_SVC_URL}/api/learning/:path*` },
        { source: "/api/tutors/:path*",       destination: `${TUTOR_SVC_URL}/api/tutors/:path*` },
        { source: "/api/tutor/:path*",        destination: `${TUTOR_SVC_URL}/api/tutor/:path*` },
        { source: "/api/family/:path*",       destination: `${FAMILY_SVC_URL}/api/family/:path*` },
        { source: "/api/engagement/:path*",   destination: `${ENGAGEMENT_SVC_URL}/api/engagement/:path*` },
        { source: "/api/billing/:path*",      destination: `${BILLING_SVC_URL}/api/billing/:path*` },
        { source: "/api/comms/:path*",        destination: `${COMMS_SVC_URL}/api/comms/:path*` },
        { source: "/api/i18n/:path*",         destination: `${I18N_SVC_URL}/api/i18n/:path*` },
        { source: "/api/integrations/:path*", destination: `${INTEGRATIONS_SVC_URL}/api/integrations/:path*` },
        { source: "/api/status/:path*",       destination: `${STATUS_PAGE_SVC_URL}/api/status/:path*` },
        { source: "/api/research/:path*",     destination: `${RESEARCH_SVC_URL}/api/research/:path*` },
        { source: "/mockup-canvas/:path*",    destination: "http://localhost:8000/mockup-canvas/:path*" },
        { source: "/mockup-canvas",           destination: "http://localhost:8000/mockup-canvas/" },
      ];
    },
  };

  return nextConfig;
};

export default buildConfig;
