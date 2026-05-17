import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

export const metadata: Metadata = {
  title: "FERPA Compliance – Student Education Record Protection at AIVO",
  description:
    "AIVO Learning protects student education records under FERPA. Strict access controls, data encryption, SOC 2-aligned infrastructure controls, and compliance with state privacy laws.",
  openGraph: {
    title: "AIVO Learning FERPA Compliance",
    description:
      "How AIVO Learning handles student education records in compliance with FERPA for schools and districts.",
    url: `${BASE_URL}/ferpa-compliance`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIVO Learning FERPA Compliance",
    description: "Student education record protection and FERPA compliance at AIVO Learning.",
  },
  alternates: { canonical: `${BASE_URL}/ferpa-compliance` },
};

export default function FerpaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
