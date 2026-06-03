import { NextResponse } from "next/server";
import { getPublicSummary } from "@/lib/services/status-page-svc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const summary = await getPublicSummary(tenantId);
  return NextResponse.json(summary, {
    headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
