import { NextResponse } from "next/server";
import { clearLearnerSessionCookie } from "@/lib/auth/learner-session";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null): string {
  if (!value) return "/parent/home";
  if (!value.startsWith("/parent/")) return "/parent/home";
  return value;
}

export async function POST(req: Request): Promise<Response> {
  const formData = await req.formData().catch(() => null);
  const returnTo = safeReturnTo(String(formData?.get("returnTo") ?? ""));
  const res = NextResponse.redirect(new URL(returnTo, req.url), 303);
  res.headers.append("Set-Cookie", clearLearnerSessionCookie());
  return res;
}
