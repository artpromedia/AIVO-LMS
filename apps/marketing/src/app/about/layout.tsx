import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "About AIVO Learning – Our Mission, Values & Leadership Team",
  description:
    "AIVO Learning was founded to ensure no learner is left behind. Meet our leadership team of healthcare executives, education experts, and technology leaders building AI-powered adaptive learning for all abilities.",
  openGraph: {
    title: "About AIVO Learning – Our Mission, Values & Leadership Team",
    description:
      "Meet the team behind AIVO's mission to bring personalized AI-powered education to every child, regardless of learning differences or abilities.",
    url: `${BASE_URL}/about`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About AIVO Learning – Our Mission & Team",
    description:
      "Meet the team behind AIVO's mission to bring personalized AI-powered education to every child.",
  },
  alternates: { canonical: `${BASE_URL}/about` },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
