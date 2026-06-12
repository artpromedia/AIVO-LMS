import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import "./globals.css";
import { PlayfulCalmProvider } from "@/components/system/playful-calm-provider";
import { QueryProvider } from "@/components/system/query-provider";
import { Toaster } from "@/components/ui/toaster";
import { SensoryModeProvider } from "@/components/system/sensory-mode-provider";
import { PwaRegister } from "@/components/system/pwa-register";
import { WebVitalsReporter } from "@/components/observability/web-vitals-reporter";
import { TzSync } from "@/components/observability/tz-sync";
import { getSession } from "@/lib/auth/session";
import { resolveTimeZone } from "@/lib/i18n/timezone";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { readSensoryModeFromCookies } from "@/lib/sensory-mode/server";
import {
  readTypefaceFromCookies,
  readReducedMotionFromCookies,
  readSpacingFromCookies,
  readSoundFromCookies,
  readWorkspaceThemeFromCookies,
} from "@/lib/a11y/server";
import { dirForLocale } from "@/lib/i18n/config";

// AIVO design language typography.
//   - Body: Inter (next/font/local, vendored in public/fonts).
//   - Display: Satoshi Variable (loaded via Fontshare in <head> below).
//     Satoshi is NOT on Google Fonts, so it must come from Fontshare;
//     without it, every headline silently falls back to Inter and the
//     bold geometric display weight defined in @aivo/brand tokens is
//     lost. Inter is kept as the swap fallback while Satoshi streams.
//   - Atkinson Hyperlegible: dyslexia-font mode, toggled by
//     `[data-dyslexia-font="on"]` on <html>.
// All faces resolve through Tailwind's `font-iw-display` / `font-iw-body`
// / `font-iw-dyslexia` utilities (see @aivo/brand preset).
// Fonts are SELF-HOSTED (public/fonts, OFL-licensed) via next/font/local.
// next/font/google downloads from fonts.googleapis.com at build/dev time,
// which made every build network-dependent and visual baselines
// font-nondeterministic whenever that fetch flaked. The Inter variable
// file covers the full 100–900 weight range in one 48KB woff2.
const inter = localFont({
  src: "../public/fonts/Inter-Variable-latin.woff2",
  weight: "100 900",
  variable: "--font-aivo-body",
  display: "swap",
});

// Display fallback. The CSS stack lists "Satoshi Variable" first, so this
// Inter instance only renders if Satoshi fails to load.
const interDisplay = localFont({
  src: "../public/fonts/Inter-Variable-latin.woff2",
  weight: "100 900",
  variable: "--font-aivo-display",
  display: "swap",
});

const atkinson = localFont({
  src: [
    { path: "../public/fonts/AtkinsonHyperlegible-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/AtkinsonHyperlegible-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-aivo-dyslexia",
  display: "swap",
});

// Next 15 moved theme-color out of `metadata` into the dedicated `viewport`
// export; keeping it here removes the per-page build warning.
export const viewport: Viewport = {
  themeColor: INCLUSIVE_WARM_PALETTE.primary,
};

export const metadata: Metadata = {
  title: "AIVO Learning",
  description: "Personalized learning adventures for every child.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/images/favicon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/images/favicon-192.png", sizes: "192x192" }],
    shortcut: ["/images/favicon-192.png"],
  },
  appleWebApp: {
    capable: true,
    title: "AIVO",
    statusBarStyle: "default",
  },
};

// AIVO is a logged-in SaaS — every surface reads cookies for auth,
// locale, sensory mode, typeface, and reduced-motion in the root layout.
// Trying to statically prerender these pages fails with misleading
// "<Html> outside pages/_document" / "Cannot read properties of undefined"
// errors because the cookie-bound calls return null during SSG. Pin the
// whole app to dynamic rendering so `next build` only compiles routes
// and defers all rendering to request time.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const viewerTimeZone = resolveTimeZone(session?.timezone);
  // SSR the user's sensory mode onto <html> so the very first paint already
  // shows the right palette (no FOUC when calm / high-contrast users load
  // any signed-in page). The client provider keeps this in sync going
  // forward and mirrors changes back to the cookie.
  const sensoryMode = await readSensoryModeFromCookies();
  const typeface = await readTypefaceFromCookies();
  const reducedMotion = await readReducedMotionFromCookies();
  const spacing = await readSpacingFromCookies();
  const sound = await readSoundFromCookies();
  const workspaceTheme = await readWorkspaceThemeFromCookies();
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations("root.layout");

  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      data-sensory-mode={sensoryMode}
      data-typeface={typeface}
      data-reduced-motion={reducedMotion}
      data-spacing={spacing}
      data-sound={sound}
      data-workspace-theme={workspaceTheme}
      data-brand="inclusive-warm"
    >
      <head>
        {/* Satoshi — the AIVO display face, self-hosted (Sprint A3) so the
            app serves no third-party style/font origin and CSP stays
            'self'-only. Weights 300–900 live in public/fonts (ITF license,
            see SATOSHI-LICENSE.txt). Falls through to Inter (next/font)
            while Satoshi streams. */}
        <link
          rel="preload"
          href="/fonts/satoshi-700.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link rel="stylesheet" href="/fonts/satoshi.css" />
      </head>
      <body
        data-age-mode="spark"
        className={`${inter.variable} ${interDisplay.variable} ${atkinson.variable} font-iw-body bg-iw-bg text-iw-ink antialiased`}
      >
        <a href="#main" className="skip-link">
          {t("skip_to_main")}
        </a>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={viewerTimeZone}>
          <SensoryModeProvider initialMode={sensoryMode}>
            <PlayfulCalmProvider>
              <QueryProvider>
                {children}
                <Toaster />
              </QueryProvider>
            </PlayfulCalmProvider>
          </SensoryModeProvider>
          <PwaRegister />
          <WebVitalsReporter />
          <TzSync sessionTimeZone={session?.timezone ?? null} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
