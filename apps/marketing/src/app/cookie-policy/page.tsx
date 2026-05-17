"use client";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout
      badge="Legal"
      title="Cookie Policy"
      subtitle={`This Cookie Policy explains how Aivo AI Learning Technologies Inc. ("AIVO", "we", "us") uses cookies and similar technologies on aivolearning.com, app.aivolearning.com, and our mobile and tablet applications (together, the "Services"). It tells you what cookies we use, why we use them, how long they last, and the choices you have.`}
      icon="🍪"
      accentColor="#ea580c"
      lastUpdated="April 1, 2026"
      contactEmail="privacy@aivolearning.com"
      sections={[
        {
          title: "1. About This Policy",
          content: [
            "This Cookie Policy is a supplement to our Privacy Policy and applies to all visitors and users of the Services. It is intended to be read together with the Privacy Policy and our COPPA Compliance Statement, which describes how we treat children's information differently from adult users.",
            "Where this policy uses the word \"cookie\", we mean any technology that stores or reads information on your device for the purposes described below — including HTTP cookies, HTML5 local and session storage, IndexedDB, web beacons, tracking pixels, software development kits in our mobile apps, and similar identifiers. We use the single word \"cookie\" throughout for readability.",
            "If anything in this Cookie Policy is unclear, or if you would like a copy in an alternative format (large print, plain language, or translated), please email privacy@aivolearning.com and we will help.",
          ],
        },
        {
          title: "2. What Are Cookies and Similar Technologies?",
          content: [
            "A cookie is a small text file that a website saves on your device. The next time you visit, your browser sends the cookie back to the site, which lets the site remember things between visits — for example, that you are signed in, that you prefer dark mode, or that you already accepted the cookie banner.",
            "Cookies cannot run programs, install software, or read files outside their own scope. They simply hold short pieces of information. Similar technologies — local storage, session storage, IndexedDB, software development kits embedded in our mobile apps, and tracking pixels in transactional emails — work in the same general way and are covered by this policy.",
            "Cookies set by AIVO directly are called \"first-party\" cookies. Cookies set by another company that helps us run a service (for example, our payment processor) are called \"third-party\" cookies. The categories below explain what each type does on AIVO.",
          ],
        },
        {
          title: "3. Categories of Cookies We Use",
          content: "We group every cookie on AIVO into one of four categories. The first category is required for the Services to work; the others are optional and you can turn them off without losing access to your account.",
          list: [
            "Strictly necessary — required for core functionality such as authentication, session security, fraud prevention, load balancing, accessibility settings, language selection, and saving your cookie-preference choices. These cannot be turned off.",
            "Functional — remember your preferences (theme, language, last-viewed dashboard, learner profile selection) so you don't have to re-enter them every visit. Turning these off will not block features but may make the experience less convenient.",
            "Performance and analytics — help us understand, in aggregate, which pages and lessons are working, where errors occur, and how to improve the Services. On learner-facing pages we use a privacy-preserving analytics tool that does not assign cross-site identifiers and that is configured to collect only non-personal usage events.",
            "Marketing and advertising — used only on adult-facing marketing pages of aivolearning.com (such as the home page, pricing page, blog, and lead-capture forms) to measure the effectiveness of our outreach to parents, schools, and districts. We do not place advertising or behavioral tracking cookies on learner pages or on pages directed to children.",
          ],
        },
        {
          title: "4. Specific Cookies We Set",
          content: "The following are representative examples of the cookies and similar technologies we currently use. The list is reviewed and updated regularly; you can request the current full list at any time from privacy@aivolearning.com.",
          list: [
            "aivo_session — Strictly necessary, first-party. Authenticates your session and protects your account from cross-site request forgery. Expires when you sign out or after 24 hours of inactivity.",
            "aivo_csrf — Strictly necessary, first-party. Cross-site request forgery token used on form submissions. Session cookie; deleted when the browser tab closes.",
            "aivo_consent — Strictly necessary, first-party. Stores your cookie-banner choices so we don't keep asking. Persistent cookie; expires after 12 months.",
            "aivo_lang — Functional, first-party. Stores your selected language (one of 10 supported locales). Persistent cookie; expires after 12 months.",
            "aivo_theme — Functional, first-party. Stores your light/dark mode and accessibility preferences. Persistent cookie; expires after 12 months.",
            "aivo_learner — Functional, first-party. Stores which child profile is currently selected on a parent dashboard. Persistent cookie; expires after 30 days.",
            "_ga, _ga_* (when enabled) — Performance, third-party (Google Analytics 4). Used only on adult marketing pages, with IP-anonymization on, ad-personalization off, and Google Signals off. Persistent cookie; expires after 13 months.",
            "ph_* (when enabled) — Performance, third-party (PostHog product analytics, EU region). Tracks aggregated feature usage on the parent dashboard. Persistent cookie; expires after 12 months. Disabled entirely on learner pages.",
            "sentry-trace, sentry-replay-* — Performance, third-party (Sentry error monitoring). Captures anonymized stack traces and session metadata when an error occurs. Session cookie; deleted when the browser tab closes.",
            "__stripe_mid, __stripe_sid — Strictly necessary on checkout pages, third-party (Stripe payment processor). Used by Stripe to detect fraud during a purchase. __stripe_mid is persistent (12 months); __stripe_sid is a session cookie.",
            "intercom-id-*, intercom-session-* — Functional on adult support pages, third-party (Intercom). Lets parents and administrators continue a support conversation across visits. Persistent cookie; expires after 9 months. Not loaded on learner pages.",
          ],
        },
        {
          title: "5. Third-Party Services That May Set Cookies",
          content: "We work with a small number of trusted third parties that may set cookies on the Services to perform a specific job for us. Each is bound by a data-processing agreement that prohibits them from using cookie data for their own marketing or for cross-site behavioral advertising.",
          list: [
            "Stripe (payment processing) — sets fraud-prevention cookies on checkout and billing pages only.",
            "Google Analytics 4 (analytics) — runs only on adult marketing pages, with IP-anonymization on, advertising features off, and data-retention shortened to 14 months.",
            "PostHog EU (product analytics) — runs only on parent and educator dashboards, never on learner pages, and is disabled when consent is withdrawn.",
            "Sentry (error monitoring) — captures anonymized error context to help us fix bugs faster.",
            "Cloudflare (security and load balancing) — sets a strictly-necessary cookie (__cf_bm) to distinguish humans from bots and to protect against attacks.",
            "Intercom (customer support) — loaded only on adult support pages so parents and administrators can keep their support conversations.",
            "YouTube and Vimeo (educational video) — when an educational video is embedded on an adult-facing page, the video provider may set cookies. Embedded videos on learner pages are loaded in privacy-enhanced mode where available, with no advertising cookies.",
          ],
        },
        {
          title: "6. Cookies on Learner Pages and Children's Experiences",
          content: [
            "Pages directed to learners — including any page that is accessed under a child profile, the in-app learning environment, and our mobile apps for ages 5–17 — only load cookies in the strictly-necessary and functional categories.",
            "On these pages we do not load Google Analytics, Google Tag Manager, Meta Pixel, TikTok Pixel, LinkedIn Insight Tag, or any third-party advertising or behavioral tracking cookie. We do not place persistent identifiers for the purpose of behavioral advertising. We do not allow our service providers to use cookies set on learner pages for any purpose other than supporting the educational service.",
            "This is consistent with our commitments under the Children's Online Privacy Protection Act (COPPA), the Family Educational Rights and Privacy Act (FERPA), the Student Online Personal Information Protection Act (SOPIPA, California), and similar state and international student-privacy laws. See our COPPA Compliance Statement for more detail.",
          ],
        },
        {
          title: "7. Your Choices and How to Manage Cookies",
          content: "You are in control of optional cookies. You can change your mind at any time without losing access to your account.",
          list: [
            "Cookie banner — when you first visit AIVO from a new device, you will see a banner that lets you Accept All, Reject All non-essential, or open Cookie Settings to choose by category.",
            "Cookie settings — at any time you can open Cookie Preferences from the link in the footer of every page and change your category-by-category choices.",
            "Account-level controls — signed-in parents and administrators can also disable optional analytics from Account Settings → Privacy.",
            "Browser controls — most browsers let you block or delete cookies entirely from a single site or from the whole web. Doing so may break strictly-necessary cookies (for example, you may not be able to stay signed in).",
            "Mobile-app controls — our iOS and Android apps respect your operating-system-level Limit Ad Tracking and App Tracking Transparency settings. You can also reset the advertising identifier from your device settings, although AIVO does not use that identifier on learner profiles.",
            "Email pixels — transactional emails (receipts, password resets, weekly progress reports) may include a small tracking pixel that tells us the email was opened. You can disable image loading in your email client to block this, or unsubscribe from non-essential emails through the link at the bottom of any AIVO email.",
          ],
        },
        {
          title: "8. Browser-Specific Instructions",
          content: "If you want to manage cookies directly in your browser, the following instructions are a good starting point. Browser publishers update these features regularly; please refer to the help pages of your browser for the latest steps.",
          list: [
            "Google Chrome — Settings → Privacy and security → Third-party cookies, or Settings → Privacy and security → Site settings → Cookies and site data.",
            "Apple Safari (macOS) — Safari menu → Settings → Privacy → Manage Website Data.",
            "Apple Safari (iOS/iPadOS) — Settings app → Apps → Safari → Advanced → Website Data.",
            "Mozilla Firefox — Settings → Privacy & Security → Cookies and Site Data.",
            "Microsoft Edge — Settings → Cookies and site permissions → Manage and delete cookies and site data.",
            "Brave — Settings → Shields → Cookies, plus the per-site Shields panel in the address bar.",
            "Samsung Internet — Settings → Sites and downloads → Cookies and Manage stored data.",
          ],
        },
        {
          title: "9. Do Not Track and Global Privacy Control",
          content: [
            "There is no single industry standard for how websites should respond to a browser-level Do Not Track (DNT) signal, so most websites — including AIVO — do not change behavior based on DNT alone.",
            "We do recognize and honor the Global Privacy Control (GPC) browser signal on adult marketing pages where applicable law (such as the California Consumer Privacy Act and the Colorado Privacy Act) treats GPC as a valid opt-out of sale and sharing. When GPC is detected we will not load optional advertising or marketing cookies on those pages, and we will record the signal as an opt-out for the relevant first-party identifier.",
            "Because learner pages do not use advertising or behavioral tracking cookies in the first place, GPC has no effect on the learning environment.",
          ],
        },
        {
          title: "10. Region-Specific Information: European Economic Area, United Kingdom, and Switzerland",
          content: [
            "If you are visiting AIVO from the European Economic Area, the United Kingdom, or Switzerland, we rely on your consent to set non-essential cookies, in line with the ePrivacy Directive and the General Data Protection Regulation (GDPR). Strictly necessary cookies are set under the legitimate-interest legal basis and do not require consent.",
            "Our cookie banner gives you a granular, opt-in choice and remembers it for 12 months. You can withdraw consent at any time from the Cookie Preferences link in the footer; withdrawal is as easy as giving consent, and does not affect the lawfulness of processing carried out before withdrawal.",
            "You also have the right to file a complaint with your national data protection authority — for example, the Information Commissioner's Office in the United Kingdom (ico.org.uk), the CNIL in France (cnil.fr), or the Datenschutzkonferenz in Germany.",
          ],
        },
        {
          title: "11. Region-Specific Information: California, Colorado, Connecticut, Virginia, and Other U.S. State Privacy Laws",
          content: [
            "If you are a resident of California, you have specific rights under the California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA). AIVO does not sell personal information for monetary value. We do not share personal information for cross-context behavioral advertising on learner pages or on pages directed to anyone under 16. On adult marketing pages we honor the Global Privacy Control browser signal as a valid opt-out of sharing.",
            "California residents can also use the \"Do Not Sell or Share My Personal Information\" link in the footer or email privacy@aivolearning.com to submit a request. We will respond within 45 days.",
            "Residents of Colorado, Connecticut, Delaware, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, and Virginia have similar opt-out rights under their respective state privacy laws. The same Cookie Preferences and email channels can be used to exercise those rights.",
          ],
        },
        {
          title: "12. Region-Specific Information: Canada, Brazil, Australia, and Other Jurisdictions",
          content: [
            "Canada — under the Personal Information Protection and Electronic Documents Act (PIPEDA) and provincial laws such as Quebec's Law 25, AIVO seeks meaningful consent for non-essential cookies and offers a clear, accessible way to withdraw it.",
            "Brazil — under the Lei Geral de Proteção de Dados (LGPD), the legal bases used for cookies are consent (for non-essential cookies) and legitimate interest or legal obligation (for strictly necessary cookies). Brazilian users can contact our Data Protection Officer at dpo@aivolearning.com.",
            "Australia — AIVO follows the Australian Privacy Principles under the Privacy Act 1988. Cookies that involve personal information are described in our Privacy Policy.",
            "Other jurisdictions — if you are using AIVO from a country we have not listed, the same Cookie Preferences and contact channels are available to you, and we will respond to verifiable requests under applicable local law.",
          ],
        },
        {
          title: "13. How Long Cookies Last",
          content: [
            "Cookies are either \"session\" cookies, which are deleted when you close your browser tab, or \"persistent\" cookies, which last for a defined period (commonly between 30 days and 13 months) or until you delete them.",
            "Strictly-necessary security cookies are short-lived (24 hours or session) to protect your account. Preference cookies are kept for up to 12 months so your settings stay put. Analytics cookies are kept for the minimum period necessary to spot trends and to fix issues — typically no longer than 13 months. Marketing cookies on adult pages are kept for up to 13 months and are reset whenever you change your consent.",
            "When you withdraw consent, the corresponding optional cookies are deleted from your device on the next page load and any associated server-side records are scheduled for deletion within 30 days.",
          ],
        },
        {
          title: "14. Changes to This Cookie Policy",
          content: "We may update this Cookie Policy from time to time to reflect changes in our use of cookies, in third-party services, or in applicable law. When we make material changes — for example, adding a new category of cookie, adding a new advertising provider, or expanding into a new region — we will update this page, change the \"Last updated\" date at the top, and, where appropriate, ask for your choices again through the cookie banner. Non-material clarifications and editorial fixes will be made without re-prompting.",
        },
        {
          title: "15. Contact Us",
          content: [
            "If you have questions about how AIVO uses cookies, or if you would like to exercise any of the rights described above, please email privacy@aivolearning.com.",
            "For questions about cookies in a school or district deployment of AIVO, please write to compliance@aivolearning.com and copy your district's privacy officer.",
            "Postal mail can be sent to: Aivo AI Learning Technologies Inc., Attention: Privacy Office, 1400 Van Buren Street S, Suite 200, Minneapolis, MN, United States.",
          ],
        },
      ]}
    />
  );
}
