import { renderLlmsFullTxt } from "@/lib/llms-content";

// Extended agent manifest with inlined, quotable value-prop copy — static,
// served as text/plain. Not added to sitemap.ts (agent manifest, not a page).
export const dynamic = "force-static";

export function GET() {
  return new Response(renderLlmsFullTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  });
}
