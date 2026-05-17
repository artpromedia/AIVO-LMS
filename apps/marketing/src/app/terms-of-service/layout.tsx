import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Terms of Service – AIVO Learning Platform Agreement",
  description:
    "Terms and conditions governing your use of the AIVO Learning Platform, including subscription plans, billing, acceptable use, and intellectual property.",
  openGraph: {
    title: "AIVO Learning Terms of Service",
    description:
      "Terms and conditions for using the AIVO Learning AI-powered adaptive learning platform.",
    url: `${BASE_URL}/terms-of-service`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning Terms of Service",
    description: "Terms and conditions for the AIVO Learning platform.",
  },
  alternates: { canonical: `${BASE_URL}/terms-of-service` },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
