import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Careers at AIVO Learning – Join Our Mission in EdTech",
  description:
    "Join the AIVO Learning team. We're hiring remote-first engineers, educators, and growth specialists passionate about building AI-powered adaptive learning for children of all abilities.",
  openGraph: {
    title: "Careers at AIVO Learning – Work With Us",
    description:
      "Remote-first roles in engineering, education, and sales. Help build AI-powered learning for every child.",
    url: `${BASE_URL}/careers`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Careers at AIVO Learning",
    description: "Join our remote-first team building AI-powered adaptive learning.",
  },
  alternates: { canonical: `${BASE_URL}/careers` },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
