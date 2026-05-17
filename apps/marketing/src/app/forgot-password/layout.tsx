import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Forgot Password | AIVO Learning",
  description: "Request a password reset link for your AIVO Learning account.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/forgot-password` },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
