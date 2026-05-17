import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Blog – AIVO Learning Insights & Education Technology Updates",
  description:
    "Read the latest from AIVO Learning: product updates, adaptive learning research, special education best practices, AI in education insights, and community stories.",
  openGraph: {
    title: "AIVO Learning Blog – EdTech Insights & Updates",
    description:
      "Product updates, adaptive learning research, and special education best practices from the AIVO team.",
    url: `${BASE_URL}/blog`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning Blog",
    description: "Insights on AI-powered adaptive learning, special education, and edtech.",
  },
  alternates: { canonical: `${BASE_URL}/blog` },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
