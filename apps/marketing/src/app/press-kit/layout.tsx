import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Press Kit – AIVO Learning Media Resources & Brand Assets",
  description:
    "Download AIVO Learning logos, brand assets, and company fact sheets. Founded in 2024 in Washington DC, AIVO serves learners ages 5-17 with 14 AI tutors across 5 functioning levels.",
  openGraph: {
    title: "AIVO Learning Press Kit & Media Resources",
    description:
      "Logos, brand colors, company overview, and quick facts for media coverage of AIVO Learning.",
    url: `${BASE_URL}/press-kit`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning Press Kit",
    description: "Media resources, logos, and company facts for AIVO Learning.",
  },
  alternates: { canonical: `${BASE_URL}/press-kit` },
};

export default function PressKitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
