# @aivo/marketing

The AIVO Learning marketing site (Next.js App Router). Statically rendered
audience, level, subject, comparison, feature, blog, and guide pages plus the
compliance surface.

## Develop

```bash
pnpm --filter @aivo/marketing dev    # http://localhost:4000
pnpm --filter @aivo/marketing build
pnpm --filter @aivo/marketing test   # unit tests (vitest)
```

## GEO (answer-engine optimization)

This site is tuned to be read, attributed, and quoted by AI answer engines
(ChatGPT, Perplexity, Claude, Google AI Overviews). See the
[GEO playbook](../../docs/marketing/geo-playbook.md) for the rules: the
`/llms.txt` and `/llms-full.txt` manifests, the AI-crawler allow-list in
`robots.ts`, the structured data each page type must emit (via
`components/seo/JsonLd.tsx`), and the "Key takeaways" authoring rule. The
`Marketing GEO` CI workflow enforces them on every PR.
