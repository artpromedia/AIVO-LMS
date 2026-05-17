import { NextRequest, NextResponse } from "next/server";

// Resolved at request time (not module-load time) so `next build` can
// collect page data without service URLs being injected.
function resolveAdminSvcUrl(): string {
  const v = process.env.ADMIN_SVC_URL;
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`marketing: ADMIN_SVC_URL must be set in production`);
  }
  return "http://localhost:3013";
}

export async function POST(req: NextRequest) {
  try {
    const ADMIN_SVC_URL = resolveAdminSvcUrl();
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const res = await fetch(`${ADMIN_SVC_URL}/api/admin-svc/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to process subscription" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to process subscription" },
      { status: 500 }
    );
  }
}
