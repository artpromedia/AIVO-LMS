/**
 * Shared catch-all proxy for the enterprise service routes that the
 * web client posts to. Centralizing the proxy here keeps each
 * `api/<service>/[[...path]]/route.ts` to a four-line wrapper.
 *
 * The proxy forwards GET / POST / PUT / PATCH / DELETE while preserving
 * the original method, body, query string, and authorization header.
 * Network errors return 503 so the UI can render a recoverable message.
 */
import { NextRequest, NextResponse } from "next/server";

export interface ProxyTarget {
  /** Service name used in the upstream URL prefix `/api/<service>/...`. */
  upstreamPrefix: string;
  /**
   * The upstream base URL (e.g. `http://problem-session-svc:3061`).
   * Resolved lazily at request time so that environment validation does
   * not run during Next.js build-time page-data collection.
   */
  baseUrl: () => string;
  /** Service name used in the proxy's own URL (e.g. `recommendations`). */
  publicName: string;
}

const FORWARDED_REQUEST_HEADERS = [
  "authorization",
  "cookie",
  "content-type",
  "x-request-id",
  "x-correlation-id",
  "x-forwarded-for",
  "x-tenant-id",
] as const;

function copyRequestHeaders(req: NextRequest): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) out[name] = value;
  }
  if (!out["content-type"]) {
    out["content-type"] = "application/json";
  }
  return out;
}

function buildUpstreamUrl(target: ProxyTarget, segments: string[] | undefined, req: NextRequest): URL {
  const path = segments?.join("/") ?? "";
  const url = new URL(`/api/${target.upstreamPrefix}/${path}`, target.baseUrl());
  url.search = req.nextUrl.search;
  return url;
}

async function relay(req: NextRequest, target: ProxyTarget, segments?: string[]): Promise<NextResponse> {
  const url = buildUpstreamUrl(target, segments, req);
  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers: copyRequestHeaders(req),
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }
  try {
    const res = await fetch(url.toString(), init);
    const body = await res.text();
    const response = new NextResponse(body, { status: res.status });
    res.headers.forEach((value, name) => {
      // Drop transfer encoding / content length headers — Node fetch
      // sets them based on the new body and they would conflict.
      if (name === "transfer-encoding" || name === "content-length") return;
      response.headers.set(name, value);
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: `Failed to reach ${target.publicName}` },
      { status: 503 },
    );
  }
}

export function buildEnterpriseProxyHandlers(target: ProxyTarget) {
  return {
    GET: (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) =>
      ctx.params.then((p) => relay(req, target, p.path)),
    POST: (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) =>
      ctx.params.then((p) => relay(req, target, p.path)),
    PUT: (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) =>
      ctx.params.then((p) => relay(req, target, p.path)),
    PATCH: (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) =>
      ctx.params.then((p) => relay(req, target, p.path)),
    DELETE: (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) =>
      ctx.params.then((p) => relay(req, target, p.path)),
  };
}

function requireServiceUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`web: ${name} must be set in production`);
  }
  return devDefault;
}

export const ENTERPRISE_SERVICE_URLS = {
  problemSession: () => requireServiceUrl("PROBLEM_SESSION_SVC_URL", "http://localhost:3061"),
  recommendation: () => requireServiceUrl("RECOMMENDATION_SVC_URL", "http://localhost:3066"),
  homework: () => requireServiceUrl("HOMEWORK_SVC_URL", "http://localhost:3065"),
  tenant: () => requireServiceUrl("TENANT_SVC_URL", "http://localhost:3067"),
  integration: () => requireServiceUrl("INTEGRATION_SVC_URL", "http://localhost:3068"),
  audit: () => requireServiceUrl("AUDIT_SVC_URL", "http://localhost:3069"),
  dataGovernance: () => requireServiceUrl("DATA_GOVERNANCE_SVC_URL", "http://localhost:3070"),
  responsibleAi: () => requireServiceUrl("RESPONSIBLE_AI_SVC_URL", "http://localhost:3071"),
  subjectBrain: () => requireServiceUrl("SUBJECT_BRAIN_SVC_URL", "http://localhost:3064"),
  mathRecognizer: () => requireServiceUrl("MATH_RECOGNIZER_SVC_URL", "http://localhost:3062"),
  scienceSolver: () => requireServiceUrl("SCIENCE_SOLVER_SVC_URL", "http://localhost:3063"),
};
