import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Privacy Policy – How AIVO Learning Protects Your Data",
  description:
    "Learn how AIVO Learning collects, uses, and protects personal information and children's data. Designed to support COPPA, no advertising to children, full parental controls.",
  openGraph: {
    title: "AIVO Learning Privacy Policy",
    description:
      "How AIVO Learning protects your data and your child's privacy. Designed to support COPPA with full parental controls.",
    url: `${BASE_URL}/privacy-policy`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning Privacy Policy",
    description: "Data protection, children's privacy, and your rights at AIVO Learning.",
  },
  alternates: { canonical: `${BASE_URL}/privacy-policy` },
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
