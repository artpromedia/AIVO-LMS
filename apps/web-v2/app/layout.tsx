import type { Metadata } from "next";
import { Inter, Atkinson_Hyperlegible } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { PlayfulCalmProvider } from "@/components/system/playful-calm-provider";
import { SensoryModeProvider } from "@/components/system/sensory-mode-provider";
import { PwaRegister } from "@/components/system/pwa-register";
import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";
import { readSensoryModeFromCookies } from "@/lib/sensory-mode/server";
import { readTypefaceFromCookies, readReducedMotionFromCookies } from "@/lib/a11y/server";
import { dirForLocale } from "@/lib/i18n/config";

// AIVO design language typography.
//   - Body: Inter (via next/font/google, self-hosted).
//   - Display: Satoshi Variable (loaded via Fontshare in <head> below).
//     Satoshi is NOT on Google Fonts, so it must come from Fontshare;
//     without it, every headline silently falls back to Inter and the
//     bold geometric display weight defined in @aivo/brand tokens is
//     lost. Inter is kept as the swap fallback while Satoshi streams.
//   - Atkinson Hyperlegible: dyslexia-font mode, toggled by
//     `[data-dyslexia-font="on"]` on <html>.
// All faces resolve through Tailwind's `font-iw-display` / `font-iw-body`
// / `font-iw-dyslexia` utilities (see @aivo/brand preset).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-aivo-body",
  display: "swap",
});

// Display fallback. The CSS stack lists "Satoshi Variable" first, so this
// Inter instance only renders if Satoshi fails to load.
const interDisplay = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-aivo-display",
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-aivo-dyslexia",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AIVO Learning",
  description: "Personalized learning adventures for every child.",
  manifest: "/manifest.webmanifest",
  themeColor: INCLUSIVE_WARM_PALETTE.primary,
  icons: {
    icon: [
      { url: "/images/favicon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/images/favicon-192.png", sizes: "192x192" }],
    shortcut: ["/images/favicon-192.png"],
  },
  appleWebApp: {
    capable: true,
    title: "AIVO",
    statusBarStyle: "default",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // SSR the user's sensory mode onto <html> so the very first paint already
  // shows the right palette (no FOUC when calm / high-contrast users load
  // any signed-in page). The client provider keeps this in sync going
  // forward and mirrors changes back to the cookie.
  const sensoryMode = await readSensoryModeFromCookies();
  const typeface = await readTypefaceFromCookies();
  const reducedMotion = await readReducedMotionFromCookies();
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      data-sensory-mode={sensoryMode}
      data-typeface={typeface}
      data-reduced-motion={reducedMotion}
      data-brand="inclusive-warm"
    >
      <head>
        {/* Satoshi Variable from Fontshare — the AIVO display face.
            Defined as the first family in `--aivo-typography-fontFamily-display`
            and in the `[data-role-theme="learner"]` font stack. Falls through to
            Inter (loaded above via next/font) while Satoshi streams. Mirrors
            the marketing app's setup so both surfaces render the same
            headline aesthetic. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700,800,900&display=swap"
        />
      </head>
      <body
        data-age-mode="spark"
        className={`${inter.variable} ${interDisplay.variable} ${atkinson.variable} font-iw-body bg-iw-bg text-iw-ink antialiased`}
      >
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/New_York">
          <SensoryModeProvider initialMode={sensoryMode}>
            <PlayfulCalmProvider>{children}</PlayfulCalmProvider>
          </SensoryModeProvider>
          <PwaRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
