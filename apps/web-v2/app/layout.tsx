import type { Metadata } from "next";
import "./globals.css";
import { MockAuthBanner } from "@/components/system/mock-auth-banner";

export const metadata: Metadata = {
  title: "AIVO Learning",
  description: "Personalized learning adventures for every child.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <MockAuthBanner />
        {children}
      </body>
    </html>
  );
}
