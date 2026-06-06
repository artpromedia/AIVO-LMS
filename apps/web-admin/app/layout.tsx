import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIVO Admin Console",
  description: "Standalone administration console for AIVO Learning.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-brand="inclusive-warm">
      <body>{children}</body>
    </html>
  );
}
