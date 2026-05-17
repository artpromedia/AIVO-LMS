import {
  ENTERPRISE_SERVICE_URLS,
  buildEnterpriseProxyHandlers,
} from "@/lib/enterprise-proxy";

export const dynamic = "force-dynamic";

const handlers = buildEnterpriseProxyHandlers({
  upstreamPrefix: "subject-brain",
  baseUrl: ENTERPRISE_SERVICE_URLS.subjectBrain,
  publicName: "subject brain service",
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
