import { getRequestId, ok } from "@/lib/bff/response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  return ok({ status: "healthy", time: new Date().toISOString() }, requestId);
}
