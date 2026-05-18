import { cookies } from "next/headers";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { MOCK_COOKIE_NAME, MOCK_USERS, isMockAuthAllowed } from "@/lib/auth/mock-session";
import { ROLE_HOME, type Role } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  role: z.enum([
    "parent",
    "learner",
    "teacher",
    "school_admin",
    "district_admin",
    "platform_admin",
  ]),
});

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    // Sprint 03 production guard. AUTH_MODE != "mock" means a real
    // identity provider is configured; refuse to set a mock session
    // cookie under any circumstances.
    if (!isMockAuthAllowed()) {
      return fail(
        {
          code: "MOCK_AUTH_DISABLED",
          status: 404,
          message: "Mock auth is disabled when AUTH_MODE is not 'mock'.",
          userMessage: "This endpoint is not available.",
          retryable: false,
        },
        requestId,
      );
    }
    const json = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: parsed.error.message }, requestId);
    }
    const role = parsed.data.role as Role;
    const jar = await cookies();
    jar.set(MOCK_COOKIE_NAME, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return ok(
      {
        session: MOCK_USERS[role],
        redirectTo: ROLE_HOME[role],
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
