import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Contact Us – Get in Touch with AIVO Learning",
  description:
    "Contact AIVO Learning for general inquiries, school and district partnerships, demo requests, customer support, or privacy questions. Our team responds within 1-2 business days.",
  openGraph: {
    title: "Contact AIVO Learning – Inquiries, Demos & Support",
    description:
      "Reach out to AIVO Learning for demos, partnerships, support, or general questions about our AI-powered adaptive learning platform.",
    url: `${BASE_URL}/contact`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Contact AIVO Learning",
    description:
      "Reach out for demos, partnerships, support, or questions about AI-powered adaptive learning.",
  },
  alternates: { canonical: `${BASE_URL}/contact` },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
