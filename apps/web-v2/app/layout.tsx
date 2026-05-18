import type { Metadata } from "next";
import "./globals.css";
import { MockAuthBanner } from "@/components/system/mock-auth-banner";
import { PlayfulCalmProvider } from "@/components/system/playful-calm-provider";

export const metadata: Metadata = {
  title: "AIVO Learning",
  description: "Personalized learning adventures for every child.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-theme="light" data-age-mode="spark">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <MockAuthBanner />
        <PlayfulCalmProvider>{children}</PlayfulCalmProvider>
      </body>
    </html>
  );
}
