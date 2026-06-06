import { renderLlmsTxt } from "@/lib/llms-content";

// Agent manifest — static, served as text/plain. Not added to sitemap.ts
// (this is an agent manifest, not an indexable page).
export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
