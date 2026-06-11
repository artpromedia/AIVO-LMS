import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const IDENTITY_URL = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

/**
 * Sprint B1 — SSO discovery proxy for the admin login page. Staff typing a
 * district email get the "Continue with <IdP>" path (identity-svc decides
 * OIDC vs SAML). Unauthenticated; reveals domain-level SSO state only.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    /* fall through to validation */
  }
  if (!email || !email.includes("@") || email.length > 255) {
    return NextResponse.json({ mode: "password" }, { status: 200 });
  }
  try {
    const res = await fetch(`${IDENTITY_URL}/api/auth/discover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ mode: "password" });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({
      mode: json.mode === "sso" ? "sso" : "password",
      ssoLoginUrl: typeof json.ssoLoginUrl === "string" ? json.ssoLoginUrl : undefined,
      idpLabel: typeof json.idpLabel === "string" ? json.idpLabel : undefined,
    });
  } catch {
    return NextResponse.json({ mode: "password" });
  }
}
