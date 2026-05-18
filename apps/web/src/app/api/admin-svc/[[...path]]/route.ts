import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getAdminSvcUrl(): string {
  const v = process.env.ADMIN_SVC_URL;
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error("web/api/admin-svc: ADMIN_SVC_URL must be set in production");
  }
  return "http://localhost:3013";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = path?.join("/") || "";
  const fullPath = `/api/admin-svc/${pathStr}`;
  const url = new URL(fullPath, getAdminSvcUrl());

  // Preserve query string
  url.search = req.nextUrl.search;

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        ...(req.headers.get("authorization") && {
          authorization: req.headers.get("authorization")!,
        }),
        "content-type": req.headers.get("content-type") || "application/json",
      },
    });

    const body = await res.text();
    const response = new NextResponse(body, { status: res.status });
    res.headers.forEach((value, name) => {
      response.headers.set(name, value);
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Failed to reach admin service" }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const pathStr = path?.join("/") || "";
  const fullPath = `/api/admin-svc/${pathStr}`;
  const url = new URL(fullPath, getAdminSvcUrl());

  try {
    const body = await req.text();
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        ...(req.headers.get("authorization") && {
          authorization: req.headers.get("authorization")!,
        }),
        "content-type": req.headers.get("content-type") || "application/json",
      },
      body,
    });

    const resBody = await res.text();
    const response = new NextResponse(resBody, { status: res.status });
    res.headers.forEach((value, name) => {
      response.headers.set(name, value);
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Failed to reach admin service" }, { status: 503 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  const pathStr = path?.join("/") || "";
  const fullPath = `/api/admin-svc/${pathStr}`;
  const url = new URL(fullPath, getAdminSvcUrl());

  try {
    const res = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        ...(req.headers.get("authorization") && {
          authorization: req.headers.get("authorization")!,
        }),
        "content-type": req.headers.get("content-type") || "application/json",
      },
    });

    const body = await res.text();
    const response = new NextResponse(body, { status: res.status });
    res.headers.forEach((value, name) => {
      response.headers.set(name, value);
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Failed to reach admin service" }, { status: 503 });
  }
}
