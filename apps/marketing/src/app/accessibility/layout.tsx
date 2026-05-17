import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "Accessibility Statement – AIVO Learning's Commitment to All Users",
  description:
    "AIVO Learning is built for accessibility. WCAG 2.1 AA conformance, keyboard navigation, screen reader support, sensory accommodations, and 5 functioning levels for diverse learners.",
  openGraph: {
    title: "AIVO Learning Accessibility Statement",
    description:
      "Our commitment to accessibility: WCAG 2.1 AA, assistive technology support, and sensory accommodations for all learners.",
    url: `${BASE_URL}/accessibility`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning Accessibility",
    description: "Accessibility features and commitment at AIVO Learning.",
  },
  alternates: { canonical: `${BASE_URL}/accessibility` },
};

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
