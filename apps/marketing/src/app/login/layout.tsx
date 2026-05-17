import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Sign In | AIVO Learning",
  description: "Sign in to your AIVO Learning account to access personalized AI tutoring for your child.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/login` },
  openGraph: {
    title: "Sign In | AIVO Learning",
    description: "Sign in to your AIVO Learning account to access personalized AI tutoring for your child.",
    url: `${SITE_URL}/login`,
    siteName: "AIVO Learning",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sign In | AIVO Learning",
    description: "Sign in to your AIVO Learning account.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
