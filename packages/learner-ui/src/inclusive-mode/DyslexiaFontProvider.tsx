/**
 * DyslexiaFontProvider — swaps the body font to OpenDyslexic (SIL OFL 1.1)
 * when active. The font is loaded via `<link rel="preload">` + `@font-face`
 * pointing at a CDN URL (see CDN_URL below). If the consuming app self-hosts
 * the font under `/fonts/OpenDyslexic-Regular.woff2` we'll prefer that path.
 *
 * Licensing: OpenDyslexic is released under the SIL Open Font License 1.1
 * which permits redistribution. We ship the @font-face declaration here; the
 * binary font file is fetched from the CDN at runtime unless overridden via
 * the `fontUrl` prop. See packages/learner-ui/assets/fonts/README.md for the
 * full license note + self-hosting instructions.
 */
import { useEffect, type ReactNode } from "react";

const CDN_URL = "https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff";

const STYLE_ELEMENT_ID = "aivo-opendyslexic-fontface";

function buildFontFace(fontUrl: string): string {
  return `@font-face {
  font-family: "OpenDyslexic";
  src: url("${fontUrl}") format("woff");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
:root[data-dyslexia-font="true"] {
  --lc-font-family: "OpenDyslexic", system-ui, -apple-system, sans-serif;
}
:root[data-dyslexia-font="true"] body,
:root[data-dyslexia-font="true"] button,
:root[data-dyslexia-font="true"] input,
:root[data-dyslexia-font="true"] textarea,
:root[data-dyslexia-font="true"] select {
  font-family: "OpenDyslexic", system-ui, -apple-system, sans-serif !important;
}`;
}

export interface DyslexiaFontProviderProps {
  active: boolean;
  /** Override the font URL (e.g. when self-hosting under /fonts/...). */
  fontUrl?: string;
  children: ReactNode;
}

export function DyslexiaFontProvider({
  active,
  fontUrl,
  children,
}: DyslexiaFontProviderProps): JSX.Element {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (!active) {
      root.removeAttribute("data-dyslexia-font");
      return;
    }
    let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ELEMENT_ID;
      styleEl.textContent = buildFontFace(fontUrl ?? CDN_URL);
      document.head.appendChild(styleEl);
    }
    root.setAttribute("data-dyslexia-font", "true");
    return () => {
      root.removeAttribute("data-dyslexia-font");
    };
  }, [active, fontUrl]);

  return <>{children}</>;
}

export default DyslexiaFontProvider;
