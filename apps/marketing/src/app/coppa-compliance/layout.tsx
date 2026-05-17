import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "COPPA Compliance – Children's Privacy Protection at AIVO Learning",
  description:
    "AIVO Learning fully complies with COPPA. Learn how we protect children's online privacy with verifiable parental consent, minimal data collection, and no advertising to children.",
  openGraph: {
    title: "AIVO Learning COPPA Compliance",
    description:
      "How AIVO Learning protects children's online privacy under COPPA with parental consent and strict data handling.",
    url: `${BASE_URL}/coppa-compliance`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning COPPA Compliance",
    description: "Children's online privacy protection at AIVO Learning.",
  },
  alternates: { canonical: `${BASE_URL}/coppa-compliance` },
};

export default function CoppaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
