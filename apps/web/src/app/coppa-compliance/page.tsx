"use client";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { ShieldCheck } from "lucide-react";

export default function CoppaCompliancePage() {
  return (
    <LegalPageLayout
      badge="Children's Privacy"
      title="COPPA Compliance Statement"
      subtitle={`This statement describes how Aivo AI Learning Technologies Inc. complies with the Children's Online Privacy Protection Act of 1998 ("COPPA") and the Federal Trade Commission's COPPA Rule (16 C.F.R. Part 312). It is the official Direct Notice to Parents required by the Rule and is intended to be read together with our Privacy Policy and Cookie Policy.`}
      icon={<ShieldCheck size={22} strokeWidth={2.5} aria-hidden="true" />}
      accentColor="#059669"
      lastUpdated="April 1, 2026"
      contactEmail="privacy@aivolearning.com"
      sections={[
        {
          title: "1. Operator Information",
          content: [
            "The operator of the Services for purposes of COPPA is Aivo AI Learning Technologies Inc., a Delaware corporation with its principal place of business at 1400 Van Buren Street S, Suite 200, Minneapolis, MN, United States.",
            'Our Privacy Office is responsible for compliance with COPPA. You can reach the Privacy Office by email at privacy@aivolearning.com, by phone at +1 (612) 555-0102 between 9:00 a.m. and 6:00 p.m. Eastern Time on business days, or by postal mail at the address above marked "Attention: Privacy Office".',
            "Our agent for service of process for privacy matters is the Corporation Service Company, 251 Little Falls Drive, Wilmington, DE 19808, United States.",
          ],
        },
        {
          title: "2. Scope of This Statement",
          content: [
            "This statement applies to the use of the AIVO learning platform by children under 13 years of age, whether they reach AIVO directly through a parent-created account or through a school or district that has authorized AIVO under COPPA's school exception (16 C.F.R. § 312.5(c)(6) and the FTC's 2014 guidance).",
            "AIVO is designed for, and primarily directed to, learners between the ages of 5 and 17, with significant use by children under 13. Where a feature is not appropriate for children under 13, we either disable it or require additional parental authorization before it can be enabled for a child profile.",
            "This statement does not apply to information that adult users (parents, teachers, district administrators, billing contacts) provide about themselves. Adult information is governed by our Privacy Policy.",
          ],
        },
        {
          title: "3. Direct Notice to Parents",
          content: [
            "Before we collect, use, or disclose any personal information from a child under 13, we provide a direct notice to the child's parent or legal guardian that explains: (a) what information we collect; (b) how we use that information; (c) whether we disclose it and to whom; (d) how a parent can review the information, ask us to delete it, or refuse further collection; and (e) how the parent can give or withdraw verifiable consent.",
            "This statement, together with the in-product consent screens shown to parents during account creation, is that direct notice. Schools acting under COPPA's school exception receive the equivalent notice through our Data Privacy Agreement and through the school-administrator consent flow.",
          ],
        },
        {
          title: "4. Verifiable Parental Consent — How We Obtain It",
          content:
            "Before any personal information is collected from a child under 13, AIVO obtains verifiable parental consent (VPC) using one or more of the FTC-approved methods listed in 16 C.F.R. § 312.5(b). We choose the appropriate method based on the type of data being collected and the level of risk.",
          list: [
            "Credit-card or other government-issued payment method — when a parent starts a paid plan, the small authorization charge processed through Stripe verifies the parent's identity.",
            "Email-plus — for free accounts, the parent receives a confirmation email and must respond from the same address; we then send a second confirmation message after a delay so the parent can withdraw consent before any child data is collected.",
            "Signed consent form — parents can complete and return a signed consent form by email scan, postal mail, or fax.",
            "Government-issued ID check — for accounts that will use higher-risk features (such as caregiver video uploads), parents are asked to upload a government-issued ID, which is reviewed by a trained operator and then deleted within 30 days.",
            "Knowledge-based authentication — used as a backup verification method, with questions drawn from a third-party identity-verification provider.",
            "School authorization — for B2B deployments, the school or district provides written authorization in a signed Data Privacy Agreement, acting as the parent's agent under COPPA's school exception. Parents are notified of the school's use of AIVO through the school's own privacy disclosures and may withdraw their child at any time.",
          ],
        },
        {
          title: "5. Information We Collect From Children",
          content:
            "We follow a strict data-minimization principle: we collect only what is necessary to provide the educational service that the parent or school has authorized. The following is the complete list of personal information we may collect from a child under 13.",
          list: [
            "First name or nickname chosen by the parent (no last name unless explicitly entered by a parent).",
            "Age, grade level, and (where the parent provides it) functioning level designation, used to calibrate content difficulty.",
            "A randomly generated learner identifier that is unique to AIVO and is not linked to any government identifier.",
            "Learning activity data — answers, attempts, time on task, hint usage, mastery scores, and Brain-Clone state — generated as the child works through lessons.",
            "Sensory and accessibility preferences set by the parent or therapist (for example, reduced motion, larger text, AAC compatibility).",
            "Voice samples and short audio clips, only when the parent explicitly enables speech-to-text within a tutor (for example, the speech-and-language tutor); audio is processed in real time and is not retained beyond 24 hours unless the parent saves it as a milestone.",
            "Persistent identifiers (such as a session token and a device cookie) used solely for the internal operations exception in 16 C.F.R. § 312.5(c)(7) — to keep the child signed in, secure the session, and remember accessibility preferences.",
          ],
        },
        {
          title: "6. Information We Never Collect From Children",
          content:
            "AIVO is intentionally designed to avoid collecting categories of personal information that are not needed for the educational service. We do not collect from children under 13:",
          list: [
            "Full legal name, postal address, telephone number, or email address (these come from the parent, not from the child).",
            "Social Security numbers, government-issued ID numbers, or financial account numbers.",
            "Photographs, videos, or audio recordings, except as described in the speech-to-text bullet above with explicit parental opt-in.",
            "Precise geolocation data (latitude/longitude or radius smaller than a city). We do not access device GPS or Wi-Fi triangulation for child profiles.",
            "Contact lists, address books, social-media identifiers, or contacts of any kind.",
            "Behavioral-advertising identifiers, cross-site tracking identifiers, advertising IDs (IDFA, AAID), or third-party marketing cookies.",
            "Biometric identifiers such as facial recognition templates, fingerprint templates, or iris scans.",
            "Any information beyond what is necessary to support the educational service the parent or school authorized.",
          ],
        },
        {
          title: "7. How We Use Children's Information",
          content:
            "Children's personal information is used only for educational purposes that the parent or school has authorized, and only in the following ways:",
          list: [
            "To power the Brain-Clone AI that personalizes lesson pacing, difficulty, sensory presentation, and tutor selection.",
            "To generate progress reports for the authorized parent and, where applicable, for school-authorized teachers and therapists.",
            "To provide accessibility accommodations (AAC compatibility, switch access, eye-gaze support, sensory adaptations).",
            'To ensure the security and integrity of the child\'s account and to detect and prevent fraud, abuse, or technical errors (the COPPA "internal operations" exception).',
            "To improve AIVO using anonymized, aggregated learning data that cannot be linked back to any individual child.",
            "To respond to a verified parental request to review, modify, or delete the child's information.",
          ],
        },
        {
          title: "8. Disclosure of Children's Information to Third Parties",
          content:
            "We do not sell, rent, or trade children's personal information. We share children's information only with the limited recipients below, each of whom is bound by a written agreement that restricts use of the information to the service they perform for AIVO.",
          list: [
            "The parent or legal guardian of the child, through their secure parent dashboard.",
            "School administrators, teachers, and therapists who have been authorized by the school under a signed Data Privacy Agreement and (where required) by the parent.",
            "Service providers that help us operate the platform, including: Amazon Web Services (US-based hosting), Stripe (payment processing — adult data only), Twilio SendGrid (transactional email — adult data only), Cloudflare (security and content delivery), Sentry (error monitoring with PII scrubbing), and our internal AI inference infrastructure (US-based, single-tenant for child profiles).",
            "Law enforcement, courts, or other government authorities when we are required to do so by a valid legal process or when we believe in good faith that disclosure is necessary to protect the safety of a child.",
            "A successor entity in the event of a merger, acquisition, or sale of assets — provided that the successor agrees in writing to honor the commitments in this statement, and parents are given notice and the chance to delete their child's account before any transfer.",
          ],
        },
        {
          title: "9. No Behavioral Advertising to Children",
          content: [
            "AIVO does not display advertising of any kind to children. We do not use behavioral advertising, retargeting, or third-party advertising networks. We do not allow service providers to use children's information for their own marketing purposes.",
            "Persistent identifiers placed on a child's device are used only for the internal operations of the Services, as permitted by 16 C.F.R. § 312.5(c)(7), and are never combined with personal information for advertising purposes.",
          ],
        },
        {
          title: "10. School Authorization Under COPPA",
          content: [
            "When a school or district authorizes AIVO for classroom use, the school acts as the parent's agent for purposes of COPPA, as described in the FTC's 2014 COPPA FAQs (Section M). In that role the school authorizes the collection of personal information from students for educational purposes only, and AIVO uses the information only for the educational purposes authorized by the school.",
            "Every school authorization is documented in a Data Privacy Agreement that mirrors the requirements of California's Student Online Personal Information Protection Act (SOPIPA), the Student Data Privacy Consortium's National Data Privacy Agreement, and the New York Education Law § 2-d Parents' Bill of Rights.",
            "Parents of students enrolled through a school may, at any time and without affecting the school's authorization for other students, ask the school to remove their child or contact AIVO directly at privacy@aivolearning.com to delete the child's profile. We will honor a verified parent request within 30 days regardless of the school's preference.",
          ],
        },
        {
          title: "11. Data Retention and Deletion",
          content: [
            "Children's personal information is retained only as long as the account is active and the parent or school maintains consent.",
            "When a parent withdraws consent, deletes a child profile, cancels their plan, or 24 months elapse without any account activity, we permanently delete the child's personal information from production systems within 30 days. Backups containing the child's information are overwritten on a rolling 35-day cycle.",
            "Anonymized, aggregated learning analytics that cannot reasonably be linked to any individual child may be retained for educational research, model improvement, and statistical reporting. Anonymization follows a documented procedure that removes direct identifiers, generalizes age and grade, suppresses small cells, and is reviewed annually by an independent expert.",
            "Audit logs that are required to detect security incidents (for example, sign-in records and security events) are retained for 13 months in a separate system with restricted access.",
          ],
        },
        {
          title: "12. Parental Rights — Review, Modify, Delete, Refuse Further Collection",
          content:
            "Parents and legal guardians have the following rights regarding the personal information AIVO has collected from their child. We do not require any reason for the request.",
          list: [
            "Review — receive a copy of all personal information AIVO has collected from the child, in a portable format.",
            "Modify — correct or update any information about the child.",
            "Delete — request deletion of the child's account and all associated personal information.",
            "Refuse further collection — keep the existing data but stop any further collection, which may end the child's ability to continue using the Services.",
            "Revoke consent — withdraw consent at any time, which triggers deletion of the child's personal information within 30 days.",
            "Receive a list of recipients — receive a list of any third parties to which the child's personal information has been disclosed.",
          ],
        },
        {
          title: "13. How to Exercise Parental Rights",
          content: [
            "Parents can exercise any of the rights above directly from their parent dashboard at app.aivolearning.com/parent/privacy, by emailing privacy@aivolearning.com, or by writing to the postal address in Section 1.",
            "To protect children, we will verify the identity of the requesting parent before responding. Verification typically uses the same method we used to obtain the original consent (for example, email-plus, payment-method check, or signed form). For school-authorized accounts we will coordinate verification with the school.",
            "We respond to verified parental requests within 30 days. If we need additional time we will let you know within that period and will not extend the response window beyond 60 days. There is no charge to exercise these rights.",
          ],
        },
        {
          title: "14. Security of Children's Information",
          content: [
            "Children's information is protected with administrative, technical, and physical safeguards designed to be appropriate to its sensitivity. These include encryption in transit (TLS 1.3) and at rest (AES-256), single-tenant isolation for child profiles, multi-factor authentication for all internal access, role-based access control, mandatory background checks for staff with access to child data, annual SOC 2 Type II audits, quarterly third-party penetration testing, and a documented incident-response plan with notification timelines that meet or exceed state law.",
            "We will notify the parent (or, for school-authorized accounts, the school) of any security incident that affects their child's personal information within 72 hours of confirmation, in accordance with applicable state breach-notification laws.",
          ],
        },
        {
          title: "15. International Data Transfers",
          content:
            "Personal information collected from children under 13 is processed and stored in the United States in single-tenant infrastructure. We do not transfer children's personal information outside the United States for processing. Adult support contacts may be processed by support staff in other countries, but child profiles are restricted to U.S. infrastructure.",
        },
        {
          title: "16. Self-Regulatory and Safe-Harbor Programs",
          content:
            "AIVO participates in industry self-regulatory programs that strengthen our COPPA compliance, including the iKeepSafe COPPA and FERPA certifications, the Future of Privacy Forum's Student Privacy Pledge 2020, and a planned application for one of the FTC-approved COPPA Safe Harbor programs. Our compliance is independently audited annually, and audit summaries are available on request to schools and districts.",
        },
        {
          title: "17. State Children's-Privacy Laws",
          content: [
            'California — under the California Consumer Privacy Act and the California "Eraser Law" (Bus. & Prof. Code § 22581), users under 18 may request deletion of content they have posted. AIVO does not allow children to post public content, but a parent may still request deletion of any record under § 22581.',
            "New York — for school-authorized accounts, AIVO complies with Education Law § 2-d, including the Parents' Bill of Rights and the prohibition on using student data for marketing.",
            "Connecticut — for school-authorized accounts, AIVO complies with Connecticut General Statutes § 10-234aa et seq.",
            "Other states — AIVO complies with the student-privacy and child-privacy laws of all U.S. states in which our school customers operate, including but not limited to Colorado, Delaware, Florida, Georgia, Illinois, Maine, Maryland, Massachusetts, Tennessee, Texas, Utah, Virginia, and Washington.",
          ],
        },
        {
          title: "18. FTC Reporting and Complaints",
          content: [
            "If you believe AIVO is not complying with COPPA, please contact us first at privacy@aivolearning.com so we can investigate and respond.",
            "You also have the right to report concerns directly to the Federal Trade Commission at reportfraud.ftc.gov, by phone at 1-877-FTC-HELP, or by mail at: Federal Trade Commission, Consumer Response Center, 600 Pennsylvania Avenue NW, Washington, DC 20580.",
            "School-authorized users may also contact their school district's data privacy officer or their state education agency.",
          ],
        },
        {
          title: "19. Changes to This Statement",
          content:
            'We may update this COPPA Compliance Statement from time to time to reflect changes in the law, in our practices, or in the categories of information we collect. When we make material changes — for example, adding a new category of personal information or a new method of obtaining parental consent — we will give parents direct notice (typically by email and through the parent dashboard) and, where required by COPPA, will obtain new verifiable consent before applying the change to existing child profiles. The "Last updated" date at the top of this page reflects the most recent material revision.',
        },
        {
          title: "20. Contact the Privacy Office",
          content: [
            "Email: privacy@aivolearning.com (children's privacy and parental requests).",
            "Email: compliance@aivolearning.com (school and district inquiries).",
            "Email: dpo@aivolearning.com (international privacy inquiries, including LGPD and GDPR).",
            "Phone: +1 (612) 555-0102, Monday through Friday, 9:00 a.m. – 6:00 p.m. Eastern Time.",
            "Postal mail: Aivo AI Learning Technologies Inc., Attention: Privacy Office, 1400 Van Buren Street S, Suite 200, Minneapolis, MN, United States.",
          ],
        },
      ]}
    />
  );
}
