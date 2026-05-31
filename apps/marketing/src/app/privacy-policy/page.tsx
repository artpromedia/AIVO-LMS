import { MARKETING_ACCENTS } from "@aivo/brand";
import { getTranslations } from "next-intl/server";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";

export default async function PrivacyPolicyPage() {
  const t = await getTranslations("marketing.page_privacy_policy");
  return (
    <LegalPageLayout
      badge="Legal"
      title={t("title")}
      subtitle={
        "AIVO's mission is to provide a free, world-class adaptive education for every neurodivergent learner, anywhere. We take privacy seriously, and we're committed to giving learners, parents, teachers, and schools the information and controls they need to feel confident about how we collect, use, and share information. This Privacy Policy describes the information we collect through the AIVO website, mobile applications, and other services we provide (collectively, the \"Services\"), how we use it, and the choices you have."
      }
      icon="🔒"
      accentColor={MARKETING_ACCENTS.purple}
      lastUpdated="December 15, 2026"
      contactEmail="privacy@aivolearning.com"
      sections={[
        {
          title: "AIVO Privacy Principles",
          content:
            "Our handling of personal information is guided by the following principles, which apply to all of our products and services:",
          list: [
            "We will be transparent about what data we collect and why.",
            "We will not sell or rent personal information about our learners or their families to anyone, and we will not show third-party advertisements on pages directed to learners.",
            "We will not use any personally identifiable information about learners — including chat transcripts, Brain-Clone interactions, or assessment results — to train any third-party AI foundation model.",
            "We will provide reasonable security to protect the information we collect and store.",
            "We will give learners, parents, and schools meaningful choices and clear ways to access, correct, export, or delete the information we hold.",
          ],
        },
        {
          title: "Overview",
          content: [
            "This Privacy Policy applies to information collected through the Services. By using the Services, you acknowledge that you have read this Privacy Policy and that you understand the practices described.",
            'Use by Children and Students. AIVO is designed to be safe for learners of all ages, including children under 13. If you are a child under the age of 13 in the United States (or under the age of digital consent in your country), you may not create an AIVO account by yourself. A parent, legal guardian, or, in the school context, an authorized teacher or school administrator ("School Personnel") must create the account and provide verifiable consent on your behalf, in accordance with the Children\'s Online Privacy Protection Act ("COPPA") and our Children\'s Privacy Notice (set out below) and FERPA Compliance Notice.',
          ],
        },
        {
          title: "Contact AIVO",
          content:
            "If you have any questions about this Privacy Policy or our handling of your information, please contact us at privacy@aivolearning.com. For questions specifically about COPPA, FERPA, or other student-data matters, you can also reach our compliance team at compliance@aivolearning.com. For security reports, please write to security@aivolearning.com.",
        },
        {
          title: "Collection of Information",
          content: [
            "We collect information from you directly, automatically when you use the Services, and (where applicable) from your school or another third party that you have authorized to share information with us.",
            "Information you give us. When you register for an account or use our Services, you may provide us with information such as your name, email address, date of birth (or, for Child Users, an age band), grade level, password, parent contact email, and language preference. If you subscribe to a paid plan, our payment processor collects payment-card and billing information; we do not store full card numbers on our servers. If you communicate with us by email, complete a survey, or submit a support request, we will receive the contents of those communications.",
            "Information we collect automatically. When you use the Services, we automatically collect information about your device and your interactions with the Services, including IP address, device identifiers, browser type, operating system, referring and exit pages, time stamps, content viewed, exercises and lessons attempted, answers submitted, hints requested, and Brain-Clone session metadata. This information helps us deliver the adaptive learning experience, secure the Services, and improve features.",
            'Information from your school. If you access AIVO through a school account or under a District Agreement, your school may provide us with roster information (name, grade level, class assignment, teacher of record, school identifier) and, where applicable, individualized education program ("IEP") indicators selected by School Personnel for the purpose of personalizing the learner\'s experience. The school remains the data controller for education records under FERPA.',
            'Information from third-party sign-in. If you sign in to AIVO using Google, Clever, ClassLink, or another "Integrated Service," we will receive certain account information from that service consistent with the permissions you (or your school) granted. You can review the data shared in your Integrated Service\'s settings.',
          ],
        },
        {
          title: "Use of Information",
          content: "We use the information we collect to:",
          list: [
            "operate, maintain, and provide the features and functionality of the Services, including delivering personalized learning paths through Brain-Clone and our AI tutors;",
            "create and manage your account, authenticate you, and communicate with you about your account, security, and changes to the Services;",
            "personalize your learning experience and progressively tune the difficulty, pacing, and modality of content to your needs;",
            "process payments, manage subscriptions, and send transactional notices for paid plans;",
            'comply with our legal and regulatory obligations, including COPPA, FERPA, GDPR, the UK GDPR, the California Consumer Privacy Act/California Privacy Rights Act ("CCPA/CPRA"), and other Applicable Privacy Law;',
            "detect, investigate, and prevent fraud, abuse, security incidents, and conduct that violates our Terms of Service or Community Guidelines;",
            "evaluate, debug, and improve the Services, including by conducting privacy-preserving research and analytics on aggregated, de-identified data;",
            "with your (or your school's) consent, send communications about new features, learning resources, or program opportunities you may be interested in.",
          ],
        },
        {
          title: "Disclosure of Information",
          content:
            "AIVO does not sell or rent personal information about our learners or their families. We do, however, share information in limited circumstances:",
          list: [
            "Service providers. We share information with vendors who help us operate the Services — for example, cloud hosting, error monitoring, analytics, transactional email delivery, customer-support tooling, and payment processing — under contracts that limit their use of the data to providing services to us.",
            "AI model providers. Our AI-Enabled Features (including Brain-Clone) may rely on large-language-model APIs operated by third-party model providers. These providers are contractually prohibited from using our learners' inputs or outputs to train, fine-tune, or otherwise improve their public foundation models. We do not include unnecessary personally identifiable information in prompts.",
            "Schools and parents. If you are a learner with a School Account, AIVO will make your learning activity, assessment results, and Brain-Clone progress available to your authorized teacher, school administrators, and (for Child Users) the parent associated with your account.",
            "Legal and safety. We may disclose information if we believe in good faith that disclosure is necessary to comply with a law, regulation, legal process, or governmental request; to enforce our Terms; to protect the rights, property, or safety of AIVO, our users, or the public; or to detect, prevent, or address fraud, security, or technical issues.",
            "Corporate transactions. If AIVO is involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or a portion of its assets, your information may be transferred as part of that transaction, subject to the commitments made in this Privacy Policy.",
            "With your consent. We may share information for other purposes with your (or your parent's or school's) consent.",
          ],
        },
        {
          title: "Retention of Personal Information",
          content:
            "We retain personal information for as long as your account is active, as needed to provide you with the Services, and as necessary to comply with our legal obligations, resolve disputes, and enforce our agreements. When personal information is no longer needed, we will delete or de-identify it. Schools and parents can request deletion of a learner's personal information at any time by contacting compliance@aivolearning.com; we honor verified requests in accordance with COPPA, FERPA, and other Applicable Privacy Law.",
        },
        {
          title: "Sponsorship and Advertising",
          content:
            "AIVO does not show third-party advertisements on pages or features directed to learners, and we do not allow third-party ad-tracking technologies on Child-directed pages. On pages directed to general adult audiences (for example, our marketing site), we may show limited promotional content for AIVO's own programs and partnerships, and we may use privacy-respecting analytics to measure the effectiveness of those efforts. We do not build advertising profiles of learners.",
        },
        {
          title: "Transparency and Your Choice",
          content:
            "We believe you should be able to make informed choices about the information you share with us. You can choose not to provide certain information, although doing so may limit your ability to use particular features. You can review and edit much of the information in your account at any time, and you can ask us to access, correct, export, or delete your information by writing to privacy@aivolearning.com. If you are a parent of a Child User, you may exercise these rights on behalf of your child by contacting compliance@aivolearning.com.",
        },
        {
          title: "Your Account Settings",
          content:
            "Within your account, you can update your contact information, change your password, manage notification preferences, view and download your learning records, and (subject to applicable retention requirements) delete your account. Parent Users can manage these settings on behalf of linked Child Users. School Personnel can manage classroom rosters and student-level settings within their teacher dashboard, subject to district policies.",
        },
        {
          title: "Security of Your Personal Information",
          content:
            "We use commercially reasonable administrative, technical, and physical safeguards to protect personal information against unauthorized access, use, alteration, or disclosure. These safeguards include encryption in transit, encryption at rest for sensitive data stores, role-based access controls for AIVO personnel, regular security testing, and incident-response procedures. No method of transmission over the internet or electronic storage is fully secure, however, and we cannot guarantee absolute security. If you believe your account has been compromised, please contact us at security@aivolearning.com.",
        },
        {
          title: "Links to Third Parties",
          content:
            "The Services may contain links to third-party websites, services, or tools that are not operated by AIVO. We are not responsible for the privacy practices of those third parties. We encourage you to read the privacy policies of any third-party site or service you visit.",
        },
        {
          title: "Changes to this Privacy Policy",
          content:
            'We may update this Privacy Policy from time to time. If we make material changes, we will notify you by posting a notice on the Services or by sending an email to the address associated with your account. The "Last updated" date at the top of this policy indicates when it was last revised. Your continued use of the Services after changes take effect constitutes your acceptance of the revised Privacy Policy.',
        },
        {
          title: "Schools and Student Use",
          content: [
            "When AIVO is used in a school setting in the United States, the school is the controller of student education records under FERPA, and AIVO acts as a school official with a legitimate educational interest under 34 CFR § 99.31(a)(1) of the FERPA regulations. Schools that use the Services are responsible for providing appropriate notices to parents and, where required, for obtaining parental consent.",
            "AI-Enabled Features in schools. School Personnel control whether AIVO's AI-Enabled Features (including Brain-Clone Teacher Tools) are turned on for their classrooms. We design AI-Enabled Features so that learner inputs are not used to train third-party foundation models, and we apply additional safeguards (including content filtering, prompt scoping, and abuse detection) on Child-directed surfaces.",
            "Research and analytics. AIVO may conduct research to evaluate the educational impact of the Services. Wherever feasible, this research is conducted on aggregated, de-identified data. AIVO will not publish identifying information about any individual learner without express written consent of the learner's parent or, where applicable, the learner.",
          ],
        },
        {
          title: "Children's Privacy Notice",
          content: [
            "AIVO complies with the Children's Online Privacy Protection Act of 1998, as amended (\"COPPA\"). This Children's Privacy Notice supplements the rest of our Privacy Policy with respect to learners under 13 in the United States.",
            "Information we collect from children. We collect from Child Users only the information reasonably necessary to operate the Services: a username or first name, an age band, a parent contact email (or, in the school context, a school identifier), authentication credentials, learning activity, exercise responses, and Brain-Clone session data. We do not require Child Users to disclose more information than is reasonably necessary to participate in the Services.",
            "Parental consent. Before we collect personal information from a child under 13, we obtain verifiable parental consent — either directly from the parent (for personal accounts) or through the child's school as permitted by COPPA's school-authorization exception (for School Accounts). Parents can review their child's information, ask us to correct or delete it, refuse further collection, or revoke consent at any time by writing to compliance@aivolearning.com.",
            "Disclosure restrictions. We never sell or rent information about Child Users, we never show third-party advertisements to Child Users, and we never use Child User information to train third-party AI foundation models. We share Child User information only with service providers acting on our behalf under contractual restrictions, with the parent or school that authorized the account, and as required by law.",
          ],
        },
        {
          title: "Paid Products",
          content:
            "If you purchase a Single Learner Plan ($24.99 per month per learner), a Family Plan ($19.99 per month per learner), or another paid offering, our payment processor (Stripe) collects payment-card and billing information directly from you, subject to its own privacy policy. AIVO receives only a tokenized reference, the last four digits of the card, the card brand, and the billing ZIP code, which we use to manage your subscription, send receipts, prevent fraud, and comply with tax and accounting obligations.",
        },
        {
          title: "Applicant Information",
          content: [
            "This Applicant Information notice supplements our Privacy Policy in connection with people who apply for jobs at AIVO. If you apply for a position with Aivo AI Learning Technologies Inc. via our online application portal, an external recruiting site (such as Greenhouse, Lever, or LinkedIn), an in-person event, or a referral, we will collect the information you choose to provide for the purpose of evaluating your application and considering you for current and future opportunities.",
            "We typically collect: your full name and contact details (email, phone, mailing address); professional and employment history (resumes, CVs, cover letters, work samples, portfolio links); education information (degrees, institutions, transcripts, certifications); references and the contact information you provide for them; demographic information that you voluntarily disclose for our equal-employment-opportunity reporting (only where collection is permitted by law and never used in hiring decisions); and, where required for the role and permitted by law, background-check information collected by a vetted third-party screening provider after you have provided written authorization.",
            "We use applicant information to assess your qualifications, conduct interviews, communicate with you about the role, perform background checks (where applicable and authorized), comply with employment, immigration, and equal-opportunity laws, and — if you join AIVO — onboard you as an employee or contractor. With your separate consent, we may also keep your application on file for a defined period to consider you for future openings. You may withdraw your application or ask us to delete your applicant record at any time by writing to careers@aivolearning.com.",
            "We share applicant information only with: AIVO personnel involved in the hiring process; service providers that operate our applicant-tracking system, video-interview platform, and (where applicable) background-check vendor under written contracts that limit use of the data to providing the service; and as required by law or to defend our legal rights. We do not sell applicant information.",
          ],
        },
        {
          title: "Use of Cookies",
          content: [
            "AIVO uses cookies and similar technologies (such as local storage, pixels, and SDKs) on our adult-facing surfaces. We classify these technologies into four categories — Strictly Necessary, Functional, Performance, and limited Targeting (adult-only pages such as the marketing site, donor pages, and recruiter pages). On Child-directed surfaces, we use only Strictly Necessary cookies needed for the internal operations exception under COPPA.",
            "Strictly Necessary cookies keep you signed in, remember accessibility preferences, and protect against cross-site request forgery; they cannot be disabled. Functional cookies remember language, theme, and other personalization choices. Performance cookies (such as our first-party analytics) help us understand which pages and features are working. Targeting cookies, where used, help us measure the effectiveness of our outreach to teachers and donors and are never combined with learner data.",
            "You can manage your preferences through the cookie banner shown on first visit, through your browser controls, or through the privacy preference link in the footer of our marketing site. For a complete list of the cookies we set, the third parties involved, the purpose of each cookie, and the retention period, please read our Cookie Policy.",
          ],
        },
        {
          title: "Regional Information",
          content: [
            "Users outside the United States. AIVO operates the Services in the United States. If you access the Services from outside the United States, your information will be transferred to and processed in the United States, where data-protection laws may differ from those in your jurisdiction.",
            "EEA, UK, and Switzerland. If you are located in the European Economic Area, the United Kingdom, or Switzerland, you have the right under the EU GDPR or the UK GDPR (as applicable) to access, correct, or delete your personal data; to restrict or object to certain processing; to data portability; and to withdraw consent at any time without affecting the lawfulness of prior processing. AIVO relies on Standard Contractual Clauses (and, where applicable, the UK International Data Transfer Addendum) for international transfers, supplemented by appropriate technical and organizational safeguards. You may lodge a complaint with your supervisory authority.",
            'California. If you are a California resident, the California Consumer Privacy Act, as amended by the California Privacy Rights Act ("CCPA/CPRA"), gives you rights to know what personal information we collect, to access and delete that information, to correct inaccuracies, and to limit certain uses of sensitive personal information. AIVO does not "sell" or "share" personal information for cross-context behavioral advertising as those terms are defined under the CCPA/CPRA. You may exercise these rights at privacy@aivolearning.com; we will not discriminate against you for doing so.',
            "Other jurisdictions. Residents of other jurisdictions (including, for example, Australia, Brazil, Canada, and various U.S. states with comprehensive privacy laws) may have additional rights under local law. Please contact privacy@aivolearning.com to exercise any such rights.",
          ],
        },
      ]}
    />
  );
}
