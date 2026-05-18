import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Create Account | AIVO Learning",
  description:
    "Create a free AIVO Learning account. AI-powered adaptive tutoring personalized for every learner, including neurodiverse children.",
  robots: { index: false, follow: false },
  alternates: { canonical: `${SITE_URL}/signup` },
  openGraph: {
    title: "Create Account | AIVO Learning",
    description:
      "Create a free AIVO Learning account. AI-powered adaptive tutoring personalized for every learner.",
    url: `${SITE_URL}/signup`,
    siteName: "AIVO Learning",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Create Account | AIVO Learning",
    description: "Create a free AIVO Learning account with personalized AI tutoring.",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
