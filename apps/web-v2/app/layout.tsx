import type { Metadata } from "next";
import { Inter, Atkinson_Hyperlegible } from "next/font/google";
import "./globals.css";
import { MockAuthBanner } from "@/components/system/mock-auth-banner";
import { PlayfulCalmProvider } from "@/components/system/playful-calm-provider";
import { SensoryModeProvider } from "@/components/system/sensory-mode-provider";
import { readSensoryModeFromCookies } from "@/lib/sensory-mode/server";

// AIVO calm design language typography. Three loaded faces:
//   • Satoshi Variable — display (loaded via Fontshare CDN <link> in <head>;
//     used for headlines, large numerals, marketing hero copy).
//   • Inter            — body + display fallback (next/font/google).
//   • Atkinson Hyperlegible — accessible reading mode, applied when
//     `[data-dyslexia-font="on"]` is set on <html>.
// All three resolve through Tailwind's `font-iw-display` / `font-iw-body`
// / `font-iw-dyslexia` utilities (see @aivo/brand preset).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-aivo-body",
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
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // SSR the user's sensory mode onto <html> so the very first paint already
  // shows the right palette (no FOUC when calm / high-contrast users load
  // any signed-in page). The client provider keeps this in sync going
  // forward and mirrors changes back to the cookie.
  const sensoryMode = await readSensoryModeFromCookies();

  return (
    <html lang="en" data-sensory-mode={sensoryMode} data-brand="inclusive-warm">
      <head>
        {/* Satoshi Variable from Fontshare. Preconnect first for early TCP
            warmup; the stylesheet itself is non-blocking thanks to
            `display=swap` and falls through to Inter while loading. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700,800,900&display=swap"
        />
      </head>
      <body
        data-age-mode="spark"
        className={`${inter.variable} ${atkinson.variable} font-iw-body bg-iw-bg text-iw-ink antialiased`}
      >
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <MockAuthBanner />
        <SensoryModeProvider initialMode={sensoryMode}>
          <PlayfulCalmProvider>{children}</PlayfulCalmProvider>
        </SensoryModeProvider>
      </body>
    </html>
  );
}
