import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { I18nProvider } from "@/providers/i18n-provider";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { StepUpModal } from "@/components/admin/StepUpModal";
import { IdleWarningModal } from "@/components/IdleWarningModal";
import enMessages from "@/i18n/messages/en.json";

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AIVO - AI-Powered Adaptive Learning",
  description: "AI-Powered Adaptive Learning for Every Child",
  icons: { icon: "/images/favicon-192.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`} suppressHydrationWarning>
      <body className="font-body antialiased bg-white text-slate-800">
        <I18nProvider initialMessages={enMessages}>
          <AuthProvider>
            <ImpersonationBanner />
            <StepUpModal />
            <IdleWarningModal />
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
