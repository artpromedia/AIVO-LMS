import { fail, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const session = await readMockSessionFromCookies();
  if (!session) {
    return fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId);
  }
  return ok(session, requestId);
}
