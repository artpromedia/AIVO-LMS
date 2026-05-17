import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Reset Password | AIVO Learning",
  description: "Choose a new password for your AIVO Learning account.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/reset-password` },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
