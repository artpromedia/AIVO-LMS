import type { Metadata } from "next";
import localFont from "next/font/local";
import "@aivo/brand/tokens.css";
import "./globals.css";
import { I18nProvider } from "@/providers/i18n-provider";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { getSensoryModeFromCookies } from "@/lib/sensory-mode.server";
import { locales, defaultLocale, dirForLocale } from "@/i18n/config";
import { resolveServerLocale, loadServerMessages } from "@/i18n/locale.server";

// Self-hosted via next/font/local so the build never touches the network.
// Files live under src/fonts and are vendored in-repo (see scripts/refresh-fonts.md).
const inter = localFont({
  src: [
    {
      path: "../fonts/InterVariable.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

const atkinson = localFont({
  src: [
    {
      path: "../fonts/AtkinsonHyperlegible-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/AtkinsonHyperlegible-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-atkinson",
  display: "swap",
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://aivolearning.com";

// hreflang alternates for every supported locale. Each non-default locale
// points at its crawlable `?lang=` URL, which middleware resolves server-side
// so crawlers receive fully translated content (not the English shell). The
// default locale and x-default both map to the canonical root.
const languageAlternates: Record<string, string> = {
  "x-default": BASE_URL,
  ...Object.fromEntries(
    locales.map((l) => [l, l === defaultLocale ? BASE_URL : `${BASE_URL}/?lang=${l}`]),
  ),
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "AIVO Learning – AI-Powered Adaptive Learning for Every Child",
    template: "%s | AIVO Learning",
  },
  description:
    "AIVO Learning uses AI-powered Brain Clone technology to create personalized learning experiences for children of all abilities, including those with autism and special needs. 14 AI tutors, 5 functioning levels, designed to support COPPA and FERPA.",
  keywords: [
    "AI learning",
    "adaptive learning",
    "special education",
    "autism education",
    "personalized learning",
    "AI tutors",
    "Brain Clone",
    "IEP tracking",
    "COPPA",
    "FERPA",
    "edtech",
    "K-12 education",
  ],
  icons: { icon: "/images/favicon-192.png" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "AIVO Learning",
    title: "AIVO Learning – AI-Powered Adaptive Learning for Every Child",
    description:
      "Personalized AI tutors that adapt to every child's unique learning style. 14 specialized tutors, 5 functioning levels, built for all abilities.",
    images: [
      {
        url: `${BASE_URL}/images/aivo-logo-purple.png`,
        width: 1200,
        height: 630,
        alt: "AIVO Learning Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AIVO Learning – AI-Powered Adaptive Learning for Every Child",
    description:
      "Personalized AI tutors that adapt to every child's unique learning style. Built for all abilities, designed to support COPPA and FERPA.",
    images: [`${BASE_URL}/images/aivo-logo-purple.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
    languages: languageAlternates,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-read the visitor's persisted sensory-mode choice so the very
  // first paint applies the right CSS variables (no flash of unstyled
  // content on hard navigation). The cookie is written by the
  // SensoryModeToggle client component via /api/sensory-mode.
  const sensoryMode = await getSensoryModeFromCookies();

  // Server-resolve the locale (?lang= header → cookie → default) and load its
  // message bundle so the first paint renders fully translated content with
  // the correct language + writing direction. RTL locales (e.g. Arabic) paint
  // correctly on first load instead of flashing LTR/English until the client
  // provider hydrates. The provider still refines client-side (hence
  // suppressHydrationWarning).
  const locale = await resolveServerLocale();
  const messages = await loadServerMessages(locale);

  return (
    <html
      lang={locale}
      dir={dirForLocale(locale)}
      data-brand="inclusive-warm"
      data-sensory-mode={sensoryMode}
      className={`${inter.variable} ${atkinson.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Satoshi Variable from Fontshare — used as the display face
            across the marketing site. Falls through to Inter while loading. */}
        <link rel="stylesheet" href="/fonts/satoshi.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "AIVO Learning",
              url: BASE_URL,
              logo: `${BASE_URL}/images/aivo-logo-purple.png`,
              description:
                "AI-powered adaptive learning platform for children of all abilities, featuring Brain Clone technology, 14 AI tutors, and 5 functioning levels.",
              foundingDate: "2024",
              founders: [
                { "@type": "Person", name: "Dr. Ikechukwu Osuji" },
                { "@type": "Person", name: "Ofem Ekapong Ofem" },
                { "@type": "Person", name: "Nnamdi Uzokwe" },
              ],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Washington",
                addressRegion: "DC",
                addressCountry: "US",
              },
              contactPoint: {
                "@type": "ContactPoint",
                email: "hello@aivolearning.com",
                contactType: "customer service",
              },
              sameAs: [],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "AIVO Learning",
              url: BASE_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: `${BASE_URL}/blog?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "AIVO Learning",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web, iOS, Android",
              description:
                "AI-powered adaptive learning platform with Brain Clone technology, 14 specialized AI tutors, and 5 functioning levels — designed to support COPPA and FERPA workflows for families and schools.",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              audience: { "@type": "EducationalAudience", educationalRole: "student" },
              url: BASE_URL,
            }),
          }}
        />
      </head>
      <body className="font-body antialiased bg-[var(--aivo-sensory-bgPage)] text-[var(--aivo-sensory-ink)]">
        <GoogleAnalytics />
        <I18nProvider initialLocale={locale} initialMessages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
