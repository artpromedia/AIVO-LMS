import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Cookie Policy – How AIVO Learning Uses Cookies",
  description:
    "AIVO Learning's Cookie Policy. Plain-language explanation of the cookies and similar technologies we use, the choices you have, and how we protect learners.",
  openGraph: {
    title: "AIVO Learning Cookie Policy",
    description:
      "Plain-language explanation of how AIVO Learning uses cookies and similar technologies.",
    url: `${BASE_URL}/cookie-policy`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning Cookie Policy",
    description: "How AIVO Learning uses cookies and the choices you have.",
  },
  alternates: { canonical: `${BASE_URL}/cookie-policy` },
};

export default function CookiePolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
