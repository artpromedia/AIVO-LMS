export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "web-admin",
    timestamp: new Date().toISOString(),
  });
}
