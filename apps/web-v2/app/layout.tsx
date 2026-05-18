import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { MockAuthBanner } from "@/components/system/mock-auth-banner";
import { PlayfulCalmProvider } from "@/components/system/playful-calm-provider";
import { SensoryModeProvider } from "@/components/system/sensory-mode-provider";
import { readSensoryModeFromCookies } from "@/lib/sensory-mode/server";

// Inclusive-Warm display + body faces. Loaded at the root so every dashboard
// inherits Fredoka (display) and Nunito (body) on first paint — these are
// what the new brand calls for and are the only fonts the `--font-display`
// / `--font-sans` CSS vars resolve to in the new preset.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-aivo-display",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-aivo-body",
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
      <body
        data-theme="light"
        data-age-mode="spark"
        className={`${fredoka.variable} ${nunito.variable} font-iw-body bg-iw-bg text-iw-ink antialiased`}
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
