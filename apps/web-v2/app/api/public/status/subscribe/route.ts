import { NextResponse } from "next/server";
import { callService } from "@/lib/services/client";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const target = typeof body.target === "string" ? body.target.trim() : "";
    if (!target) {
      return NextResponse.json(
        { ok: false, message: "An email address is required." },
        { status: 400 },
      );
    }

    const res = await callService<unknown>({
      service: "status-page-svc",
      baseUrl: serverEnv.STATUS_PAGE_SVC_URL,
      url: "/api/statuspage/subscribers",
      method: "POST",
      body: { channel: "email", target },
      requestId: req.headers.get("x-request-id") ?? undefined,
    });

    if (res.ok) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, message: "We couldn't complete your subscription right now." },
      { status: 502 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, message: "We couldn't complete your subscription right now." },
      { status: 500 },
    );
  }
}
