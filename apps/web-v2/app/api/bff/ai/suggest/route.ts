import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import {
  generateSuggestions,
  isFieldType,
  type SuggestionContext,
} from "@/lib/ai/suggestions";

export const dynamic = "force-dynamic";

type Body = {
  fieldType?: unknown;
  currentText?: unknown;
  context?: {
    ageRange?: unknown;
    gradeBand?: unknown;
    existingItems?: unknown;
  };
  limit?: unknown;
};

function asString(v: unknown, max = 4000): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function asStringArray(v: unknown, max = 40): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.slice(0, 200))
    .slice(0, max);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    if (!isFieldType(body.fieldType)) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Unknown fieldType" },
        requestId,
      );
    }

    const context: SuggestionContext = {
      ageRange: asString(body.context?.ageRange) || null,
      gradeBand: asString(body.context?.gradeBand) || null,
      existingItems: asStringArray(body.context?.existingItems),
    };
    const currentText = asString(body.currentText);
    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(12, Math.floor(body.limit)) : 6;

    const result = generateSuggestions(body.fieldType, currentText, context, limit);
    return ok(result, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
