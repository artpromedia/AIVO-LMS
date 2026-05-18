"use client";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";

export default function AccessibilityPage() {
  return (
    <LegalPageLayout
      badge="Accessibility"
      title="AIVO Accessibility Statement"
      subtitle={`At AIVO, accessibility is a direct extension of our mission to deliver a free, world-class adaptive education to every neurodivergent learner. We design our products to be usable by the widest possible range of people, including learners and adults with cognitive, sensory, motor, or speech disabilities, and we measure our work against established standards for digital accessibility.`}
      icon="♿"
      accentColor="#8b5cf6"
      lastUpdated="April 1, 2026"
      contactEmail="accessibility@aivolearning.com"
      sections={[
        {
          title: "1. Our Commitment",
          content: [
            "Aivo AI Learning Technologies Inc. is committed to making the AIVO website, mobile applications, parent and teacher dashboards, Brain-Clone tutors, and educational content accessible to people with disabilities. We treat accessibility as a continuous responsibility — not a one-time project — and we hold ourselves to the same access standards on every release.",
            "Our commitment is grounded in three principles. First, accessibility is a civil right and a precondition for the inclusive education we exist to provide. Second, accessibility is a design discipline, not a remediation step; we plan for it from the earliest sketches of every feature. Third, accessibility is a shared responsibility across product, engineering, design, content, and quality engineering, and every AIVO team member is accountable for the accessibility of the work they ship.",
          ],
        },
        {
          title: "2. Conformance Status — WCAG 2.1 Level AA",
          content: [
            "AIVO has adopted the W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA as the baseline conformance target for all of our digital products and content, and we test against the WCAG 2.2 Level AA success criteria as those become finalized in our jurisdiction. We aim for substantial conformance with WCAG 2.1 Level AA across the website, the web application, the iOS and Android applications, and the educational content we author.",
            "Substantial conformance means that the great majority of our content meets the standard, but some areas remain in active remediation. Where we know that a specific page, component, or piece of content does not yet meet the standard, we list it in our public Accessibility Roadmap (Section 13) and we provide an accessible alternative on request.",
            "AIVO publishes an Accessibility Conformance Report (ACR) using the Voluntary Product Accessibility Template (VPAT 2.5 — Revised Section 508, WCAG 2.1, EN 301 549) for the AIVO web and mobile applications. The current ACR/VPAT is available on request to schools, districts, and government purchasers at accessibility@aivolearning.com.",
          ],
        },
        {
          title: "3. Standards and Laws We Align With",
          content:
            "AIVO designs and tests its Services against the following laws and standards, which we treat as a single, layered baseline:",
          list: [
            "W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA, with progressive adoption of WCAG 2.2 Level AA criteria.",
            "Section 508 of the U.S. Rehabilitation Act of 1973, as amended (29 U.S.C. § 794d) — Revised 508 standards (36 C.F.R. Part 1194).",
            "Title II and Title III of the Americans with Disabilities Act of 1990 (ADA), as amended.",
            "Section 504 of the Rehabilitation Act of 1973, with respect to AIVO's deployment in programs receiving federal financial assistance.",
            "EN 301 549 V3.2.1, the European harmonised standard for ICT accessibility under the EU Web Accessibility Directive (Directive (EU) 2016/2102).",
            "The Accessibility for Ontarians with Disabilities Act (AODA) integrated standard, for our Canadian users.",
            "The Children's Online Privacy Protection Act (COPPA) and the Family Educational Rights and Privacy Act (FERPA), where they affect the assistive-technology features we offer in school settings.",
          ],
        },
        {
          title: "4. Built-in Accessibility Features",
          content:
            "Every AIVO surface ships with the following built-in accessibility features. Each can be enabled either by the learner or by an authorized caregiver or teacher in the learner's profile, and the choices persist across devices.",
          list: [
            "Full keyboard operability — every interactive element is reachable and operable from a keyboard, with a visible focus indicator that meets WCAG 2.4.7 and 2.4.11 contrast requirements.",
            "Screen-reader compatibility — semantic HTML, ARIA landmarks and live regions, descriptive labels for form fields and controls, programmatic associations between visible text and assistive announcements, and tested support for JAWS, NVDA, VoiceOver (macOS and iOS), TalkBack (Android), and Narrator (Windows).",
            "High-contrast and dark themes — with separate themes optimized for low-vision and dyslexia, plus user-controlled color customization.",
            "Adjustable text — text size, line height, letter spacing, and font family (including OpenDyslexic and Atkinson Hyperlegible) without breaking layouts or causing content loss; supports browser zoom up to 400% per WCAG 1.4.10 (Reflow).",
            "Reduced motion — a single toggle that disables non-essential animation and parallax across the entire product, honoring the operating-system prefers-reduced-motion media query when no explicit choice has been set.",
            "Captions and transcripts — every pre-recorded video lesson ships with synchronized closed captions in the lesson's language, a downloadable transcript, and (for hub videos) audio description.",
            "Alternative text — meaningful alt text for every informative image; decorative images are marked accordingly so they are skipped by screen readers.",
            "Time and timing controls — sessions can be extended or paused, and timed activities can be disabled or replaced with untimed versions for learners who need additional time.",
            "Error identification and recovery — clear, programmatic error messages that name the field at fault and describe the correction needed, and confirmation steps for irreversible actions.",
          ],
        },
        {
          title: "5. Sensory Accommodations Specific to AIVO",
          content:
            "Because AIVO is designed for neurodivergent learners, we go beyond the WCAG baseline with the following sensory accommodations, configurable per learner profile:",
          list: [
            'Visual — adjustable brightness, contrast, color temperature, visual complexity (a single slider that simplifies layouts and reduces decorative elements), pattern density, and "calm" backgrounds.',
            'Auditory — independent volume controls for narration, sound effects, music, and tutor voice; a master "sound off" toggle; and selectable narration voices and speeds.',
            'Interaction — adjustable timing for taps, holds, and swipes; large-target mode (minimum 48×48 CSS px); switch-input support; and an optional "single-tap" mode that converts double-tap and long-press gestures to a single tap.',
            'Cognitive — "one-task-at-a-time" mode that hides non-essential UI; explicit "next step" prompts; visual schedules for multi-step activities; and predictable, low-novelty layouts.',
            "Communication — visual symbol overlays compatible with PCS, SymbolStix, and Widgit symbol sets; AAC pass-through for speech-generating devices; and a tutor mode that accepts symbol or picture input.",
            'Self-regulation — break reminders, configurable session lengths, and a one-touch "calm corner" that pauses the session and offers a sensory break.',
          ],
        },
        {
          title: "6. Functioning-Level Profiles",
          content:
            "AIVO supports five functioning-level profiles. Each profile pre-configures the accessibility, sensory, and pedagogical settings most appropriate for the learner. Profiles can be customized further by parents, teachers, and therapists.",
          list: [
            "Level 1 (Standard) — full curriculum access with the standard accessibility settings turned on by default.",
            "Level 2 (Supported) — simplified navigation, additional scaffolding, visual supports, and on-demand prompts.",
            "Level 3 (Guided) — step-by-step guidance, reduced cognitive load, larger touch targets, and reduced visual complexity.",
            "Level 4 (Intensive) — high-contrast visuals, symbol-based communication, simplified interactions, and slower pacing.",
            "Level 5 (Pre-Symbolic) — cause-and-effect activities, switch-access support, sensory-rich content, and minimal language load.",
          ],
        },
        {
          title: "7. Assistive-Technology Compatibility",
          content:
            "AIVO is designed and tested to work with a wide range of assistive technologies. Where a feature has known limitations on a specific assistive-technology configuration, the limitation is documented in the Accessibility Roadmap (Section 13).",
          list: [
            "Screen readers — JAWS 2024 with Chrome and Edge on Windows; NVDA 2024 with Chrome and Firefox on Windows; VoiceOver with Safari on macOS, iOS, and iPadOS; TalkBack with Chrome on Android; Narrator with Edge on Windows.",
            "Screen magnification — ZoomText, MAGic, and the operating-system magnifiers on Windows, macOS, iOS, and Android.",
            "Switch and alternative input — single- and dual-switch operation, scanning, head-pointer, joystick, and adapted-keyboard input, including iOS Switch Control and Android Switch Access.",
            "Eye tracking — Tobii Dynavox systems and Apple Eye Tracking on iPadOS 17+.",
            "Augmentative and Alternative Communication (AAC) — pass-through for Tobii Dynavox Snap, TouchChat, Proloquo2Go, LAMP Words for Life, CoughDrop, and other speech-generating devices.",
            "Voice control — Dragon NaturallySpeaking, Apple Voice Control on macOS and iOS, and Windows Voice Access.",
            "Refreshable braille displays — supported through screen-reader integration on Windows, macOS, iOS, iPadOS, and Android.",
          ],
        },
        {
          title: "8. Mobile Accessibility (iOS and Android)",
          content:
            "The AIVO iOS and Android applications are built on each platform's native accessibility APIs. They support Dynamic Type and large-text settings, system-level high-contrast and reduce-motion preferences, VoiceOver and TalkBack with custom rotor / local context menus where appropriate, Switch Control and Switch Access, and the platform's standard pinch-to-zoom and zoom-to-cursor gestures. Custom gestures always have a one-tap alternative reachable from the toolbar.",
        },
        {
          title: "9. Content Authoring Standards",
          content:
            "Our content team applies the following standards to every lesson, video, image, and document we author or import.",
          list: [
            "Plain language — content is written at the lowest reading level appropriate to the learning objective; we publish a plain-language summary at the top of every long-form text.",
            "Captions and audio description — every pre-recorded video has synchronized closed captions in the lesson's language; key videos include a separate audio-described track for learners who are blind or have low vision.",
            "Transcripts — every audio asset has a downloadable transcript in HTML and plain-text formats.",
            "Alt text — every informative image has alt text written by a content author who has been trained on alt-text best practices; decorative images are marked aria-hidden.",
            "Math content — mathematics is rendered with MathML where supported and falls back to MathJax with accessible labels; we provide spoken math expressions that match the visible expression.",
            "Color and contrast — text and meaningful UI elements meet at least WCAG 1.4.3 contrast ratios; information is never conveyed by color alone.",
            "Document formats — when we publish PDFs, they are tagged for accessibility and include reading order, alt text, and document language metadata; an accessible HTML alternative is provided where feasible.",
          ],
        },
        {
          title: "10. Continuous Improvement Process",
          content:
            "AIVO maintains a continuous accessibility improvement process. Every change goes through these checks before reaching learners:",
          list: [
            "Design review — new screens are reviewed against an internal accessibility checklist (color, focus order, semantic structure, target size, copy clarity) before engineering begins.",
            "Automated testing — axe-core, Pa11y, and Lighthouse run on every pull request and block merges that introduce regressions.",
            "Manual screen-reader testing — every release candidate is exercised end-to-end with at least one screen reader on each supported platform.",
            "User testing — paid usability sessions are conducted at least quarterly with neurodivergent learners and adults who use assistive technologies; participants are compensated and consent is obtained.",
            "Third-party audits — an independent accessibility consultancy performs a full WCAG 2.1 AA audit of the AIVO product surface annually and re-tests remediated issues; the latest audit summary is available to enterprise customers under NDA.",
            "Bug triage — accessibility defects are triaged within five business days; defects that prevent a person with a disability from completing a critical learning task are treated as Severity 1 and fixed within 30 days where technically feasible.",
          ],
        },
        {
          title: "11. Procurement and Third-Party Components",
          content:
            "When AIVO selects third-party components, libraries, fonts, or hosted services, accessibility is part of the selection criteria. We require vendors to provide a current VPAT or ACR, we test the component against our internal accessibility baseline before adoption, and we maintain a registry of accepted exceptions with the user impact and the planned remediation. Where a third-party component does not meet our standard, we either fork the component, contribute upstream patches, or replace it.",
        },
        {
          title: "12. Training and Internal Practices",
          content:
            "All AIVO designers, engineers, content authors, and customer-support specialists complete an annual accessibility training, with role-specific deep-dives for those building user interfaces, authoring lessons, and supporting customers. Our hiring rubrics include an accessibility competency for product roles. We maintain an internal Accessibility Guild that meets biweekly to share patterns, review external research, and evaluate emerging assistive technology.",
        },
        {
          title: "13. Known Limitations and Roadmap",
          content: [
            "Despite our efforts, some areas of AIVO are not yet at full WCAG 2.1 AA conformance. We list known limitations and target remediation dates in our public Accessibility Roadmap, which is available at aivolearning.com/accessibility/roadmap and is updated quarterly. Current known limitations include a small number of legacy lesson videos that lack full audio description (target: complete by Q4 2026), certain interactive simulations whose drag-and-drop interactions are not yet fully operable by switch users (target: Q3 2026), and a limited set of math expressions that do not yet ship with spoken-math metadata (target: Q2 2026).",
            "If you encounter content that you believe should be on our roadmap but is not, please tell us using the contact methods in Section 15.",
          ],
        },
        {
          title: "14. Requesting an Accommodation or Alternative Format",
          content: [
            "If you need content in an alternative format — for example, a tactile graphic, a Brailled version of a worksheet, a transcript that does not yet exist, or an enlarged-print PDF — please write to accessibility@aivolearning.com with the URL or title of the content and the format you need. We will acknowledge your request within two business days and provide the alternative format within ten business days, or sooner where feasible. There is no charge.",
            "If you are a teacher, parent, or therapist requesting accommodations for a specific learner, you can also configure most accommodations directly in the learner's profile in the AIVO product. The Accessibility Center within the product provides a guided walkthrough.",
          ],
        },
        {
          title: "15. Feedback and Contact",
          content: [
            "We welcome feedback on the accessibility of AIVO. Your reports help us prioritize fixes and improve the experience for everyone.",
            "Email: accessibility@aivolearning.com.",
            "Web form: aivolearning.com/accessibility/feedback (no account required).",
            "Phone: +1 (612) 555-0103, Monday through Friday, 9:00 a.m. – 6:00 p.m. Eastern Time, with TTY/TDD support via 7-1-1 relay.",
            "Postal mail: Aivo AI Learning Technologies Inc., Attention: Accessibility Office, 1400 Van Buren Street S, Suite 200, Minneapolis, MN, United States.",
            "We aim to acknowledge accessibility feedback within two business days and to provide a substantive response within ten business days. If we cannot resolve your concern in that time, we will explain the next steps and the expected timeline.",
          ],
        },
        {
          title: "16. Formal Complaints",
          content: [
            "If you have raised an accessibility concern with us and are not satisfied with our response, you may file a formal complaint. We will not retaliate against any person who files a complaint in good faith.",
            "United States — you may contact the U.S. Department of Justice (Civil Rights Division) under the Americans with Disabilities Act, the U.S. Department of Education's Office for Civil Rights under Section 504 and Title II, or your state's attorney general or human-rights commission.",
            "European Union — you may contact the relevant national enforcement body designated under the Web Accessibility Directive (Directive (EU) 2016/2102) in your Member State.",
            "United Kingdom — you may contact the Equality and Human Rights Commission (EHRC) under the Equality Act 2010.",
            "Canada — you may contact the Canadian Human Rights Commission under the Accessible Canada Act, or the Accessibility Directorate in Ontario under the AODA.",
          ],
        },
        {
          title: "17. Changes to This Statement",
          content:
            'We will update this statement to reflect material changes in our products, our standards, or our processes. The "Last updated" date at the top of this page indicates when this statement was most recently revised. We keep prior versions on file and will share them on request.',
        },
      ]}
    />
  );
}
