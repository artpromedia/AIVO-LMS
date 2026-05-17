import { NextResponse } from "next/server";
import { logger, newRequestId } from "@/lib/observability/logger";
import { ERRORS } from "@/lib/bff/errors";

export type BffSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type BffFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    userMessage: string;
    retryable: boolean;
  };
  requestId: string;
};

export type BffResponse<T> = BffSuccess<T> | BffFailure;

export function getRequestId(req: Request): string {
  return req.headers.get("x-request-id") || newRequestId();
}

export function ok<T>(data: T, requestId: string, init?: ResponseInit): NextResponse<BffSuccess<T>> {
  return NextResponse.json<BffSuccess<T>>(
    { ok: true, data, requestId },
    {
      ...init,
      headers: { ...(init?.headers ?? {}), "x-request-id": requestId },
    },
  );
}

export function fail(
  args: {
    code: string;
    message: string;
    userMessage: string;
    retryable?: boolean;
    status?: number;
  },
  requestId: string,
): NextResponse<BffFailure> {
  const status = args.status ?? 500;
  logger.warn(
    { requestId, code: args.code, status, message: args.message },
    "[bff] error response",
  );
  return NextResponse.json<BffFailure>(
    {
      ok: false,
      error: {
        code: args.code,
        message: args.message,
        userMessage: args.userMessage,
        retryable: args.retryable ?? false,
      },
      requestId,
    },
    {
      status,
      headers: { "x-request-id": requestId },
    },
  );
}

/**
 * Normalize an unknown thrown value into a BffFailure response.
 * Use this in every BFF route's catch block.
 */
export function failFromUnknown(e: unknown, requestId: string): NextResponse<BffFailure> {
  logger.error({ requestId, err: e }, "[bff] unhandled error");
  const message = e instanceof Error ? e.message : "Unknown error";
  return fail({ ...ERRORS.INTERNAL_ERROR, message }, requestId);
}
