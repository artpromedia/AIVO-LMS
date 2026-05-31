import { MARKETING_ACCENTS } from "@aivo/brand";
import { getTranslations } from "next-intl/server";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";

export default async function FerpaCompliancePage() {
  const t = await getTranslations("marketing.page_ferpa_compliance");
  return (
    <LegalPageLayout
      badge="Education Privacy"
      title={t("title")}
      subtitle={`This statement describes how Aivo AI Learning Technologies Inc. complies with the Family Educational Rights and Privacy Act of 1974, as amended (20 U.S.C. § 1232g), and the U.S. Department of Education's implementing regulations at 34 C.F.R. Part 99 (collectively, "FERPA"). It is intended to be read together with our Privacy Policy, COPPA Compliance Statement, and our standard Data Privacy Agreement for schools and districts.`}
      icon="🎓"
      accentColor={MARKETING_ACCENTS.blue}
      lastUpdated="April 1, 2026"
      contactEmail="compliance@aivolearning.com"
      sections={[
        {
          title: "1. Operator Information",
          content: [
            "The operator of the Services for purposes of this FERPA Compliance Statement is Aivo AI Learning Technologies Inc., a Delaware corporation with its principal place of business at 1400 Van Buren Street S, Suite 200, Minneapolis, MN, United States.",
            'Our Compliance Office handles all FERPA matters, including school authorizations, parent and eligible-student requests, and inquiries from the U.S. Department of Education\'s Student Privacy Policy Office (SPPO). You can reach us at compliance@aivolearning.com, by phone at +1 (612) 555-0102 between 9:00 a.m. and 6:00 p.m. Eastern Time on business days, or by postal mail at the address above marked "Attention: Compliance Office".',
          ],
        },
        {
          title: "2. Scope of This Statement",
          content: [
            'This statement applies whenever AIVO is used in connection with a school, school district, college, university, or other "educational agency or institution" subject to FERPA — whether the institution is using AIVO under a written District Agreement, a school-administered free deployment, or a teacher-initiated classroom integration.',
            "It also applies to information AIVO receives directly from a parent of a student attending a FERPA-covered institution, when that information is then incorporated into the student's educational record at AIVO.",
            "This statement does not apply to consumer (non-school) accounts created directly by a parent for a learner who is not enrolled in a FERPA-covered institution. Those accounts are governed by our Privacy Policy and, where applicable, our COPPA Compliance Statement.",
          ],
        },
        {
          title: '3. AIVO\'s Role: "School Official" Designation',
          content: [
            'When an educational agency or institution permits AIVO to receive personally identifiable information from education records, AIVO acts as a "school official" with a "legitimate educational interest" under 34 C.F.R. § 99.31(a)(1)(i)(B). In that role we (a) perform an institutional service or function for which the school would otherwise use its own employees; (b) are under the direct control of the school with respect to the use and maintenance of education records; and (c) are subject to the requirements in 34 C.F.R. § 99.33(a) governing the use and re-disclosure of personally identifiable information from education records.',
            "Each school or district authorizing AIVO is responsible for designating AIVO as a school official in its Annual FERPA Notification (the notice required by 34 C.F.R. § 99.7) or in another disclosure that meets FERPA's notice requirements. We supply schools with model language they can include in their annual notification.",
            "AIVO does not sell personally identifiable information from education records, does not use education records for targeted advertising, and does not use education records to train any third-party AI foundation model.",
          ],
        },
        {
          title: '4. What Constitutes an "Education Record" at AIVO',
          content:
            'Under FERPA, an "education record" is any record (in any medium) that is directly related to a student and maintained by an educational agency or institution or by a party acting for the agency or institution. The following categories of information that AIVO maintains on behalf of a school constitute education records:',
          list: [
            "Student rostering data provided by the school (name, grade level, class enrollment, school identifier, teacher of record).",
            "Brain-Clone learner profiles, mastery models, and the underlying signals (item-level responses, time-on-task, hint usage, error patterns) generated through school-authorized use.",
            "Assignment, assessment, and progress data, including formative and summative results.",
            "Individualized accommodations, sensory and accessibility preferences, and any IEP-related indicators that the school's authorized personnel choose to enter or upload.",
            "Communications between teachers, students, and parents that take place inside the AIVO platform.",
            "Audit logs that link a specific student's activity to the student's account.",
          ],
        },
        {
          title: "5. Directory Information",
          content: [
            'FERPA permits a school to designate certain categories of personally identifiable information as "directory information" that may be disclosed without parental consent unless the parent (or eligible student) has opted out. Directory information typically includes a student\'s name, grade level, photograph, dates of attendance, and similar items.',
            "AIVO does not designate or publish directory information on behalf of a school. We will only treat data as directory information if the school has classified it as such in its own annual FERPA notification and has explicitly authorized AIVO to disclose it (for example, in connection with a class roster shared with another classroom tool). In all other cases AIVO treats every field associated with a student as a non-directory education record.",
          ],
        },
        {
          title: "6. Information We Collect From Students Through School Accounts",
          content:
            "We follow a strict data-minimization principle: we collect only what is necessary to provide the educational service that the school has authorized. Through a School Account we may collect:",
          list: [
            "Roster information from the school's Student Information System (SIS) or rostering provider (Clever, ClassLink, Google Classroom, OneRoster), including the student's name or username, grade, class assignment, teacher of record, and a school-issued identifier.",
            "Authentication tokens issued by the school's identity provider (SSO), used only to sign the student in.",
            "Learning activity data — answers, attempts, time-on-task, hint usage, mastery scores, Brain-Clone state — generated as the student works through lessons.",
            "Sensory, accessibility, and IEP-related accommodations entered by authorized teachers, therapists, or paraprofessionals.",
            "Voice samples and short audio clips, only when an authorized teacher enables speech-to-text within a tutor and only when the school's policies permit such collection; audio is processed in real time and is not retained beyond 24 hours unless the teacher saves it as a milestone.",
            "Persistent identifiers (such as a session token and a device cookie) used solely for the operation, security, and accessibility of the Services.",
          ],
        },
        {
          title: "7. How We Use Education Records",
          content:
            "AIVO uses education records only for the educational purposes the school has authorized — that is, to provide and improve the Services for the benefit of the school and its students. Specifically, we use education records to:",
          list: [
            "Personalize each student's learning experience through the Brain-Clone adaptive engine.",
            "Generate progress, mastery, and engagement reports for the student's authorized teachers, paraprofessionals, school administrators, and (where authorized by the school) the student's parents.",
            "Align lessons with the school's curriculum, state standards, and any IEP goals the school has elected to share with AIVO.",
            "Maintain the security, integrity, and operational health of the Services (for example, account authentication, fraud and abuse prevention, debugging, and incident response).",
            "Conduct internal research and analytics that improve the Services. Wherever feasible, this work is performed on aggregated, de-identified data that has been processed in accordance with the standard for de-identification described in 34 C.F.R. § 99.31(b)(1).",
          ],
        },
        {
          title: "8. Disclosure and Re-disclosure Limitations",
          content: [
            "AIVO will not disclose personally identifiable information from education records to a third party except (a) to authorized representatives of the school or district that provided the information, (b) to service providers acting on AIVO's behalf under written contracts that limit their use of the information to the service performed for AIVO, (c) as directed in writing by the school or by a parent or eligible student, or (d) as required by law.",
            "Service providers that may receive education records include cloud-hosting infrastructure (Amazon Web Services, US regions only for school accounts), error monitoring with PII scrubbing (Sentry), security and content delivery (Cloudflare), and our internal AI inference infrastructure (US-based, single-tenant for student profiles). Stripe and SendGrid are used only for adult contacts and do not receive student records.",
            "Where AIVO discloses personally identifiable information from education records under one of FERPA's exceptions, AIVO will, in accordance with 34 C.F.R. § 99.33(b), inform the recipient of the re-disclosure restrictions and require the recipient to comply with them.",
            "AIVO does not sell, rent, or trade education records and does not use education records for advertising, marketing, or any non-educational purpose.",
          ],
        },
        {
          title: "9. Parent and Eligible-Student Rights",
          content: [
            'FERPA grants parents — and "eligible students," defined as students who have reached 18 years of age or are attending a postsecondary institution — the following rights with respect to education records held by the school. AIVO supports the school in honoring each of these rights.',
            "Right to inspect and review. Parents and eligible students may inspect and review the student's education records within 45 days of the day the school receives a request. AIVO will provide the school with a complete export of the student's records (in a portable JSON or CSV format, plus a human-readable PDF summary) within 10 business days of the school's request, so the school can satisfy the 45-day requirement.",
            "Right to request amendment. Parents and eligible students may ask the school to amend a record they believe is inaccurate, misleading, or in violation of the student's privacy rights. AIVO will implement an amendment within 10 business days of the school's instruction.",
            "Right to consent to disclosure. Except for FERPA's enumerated exceptions, the school must obtain written consent from the parent or eligible student before disclosing personally identifiable information from the student's education records. AIVO will not disclose information outside the scope of the school's authorization unless we receive a copy of that consent or a court order or subpoena.",
            "Right to file a complaint. Parents and eligible students may file a complaint with the U.S. Department of Education concerning alleged failures by the school to comply with FERPA. The contact information for the U.S. Department of Education's Student Privacy Policy Office is provided in Section 16 below.",
          ],
        },
        {
          title: "10. How to Exercise Rights at AIVO",
          content: [
            "Because AIVO acts on behalf of the school, parents and eligible students should ordinarily direct FERPA requests to the school in the first instance. The school will then forward the request to AIVO using the channels established in the District Agreement or by emailing compliance@aivolearning.com.",
            "Parents who use AIVO through a personal account that is also linked to a School Account may also use the in-product Privacy Center to download a copy of their child's records and to request deletion of personal-account data. School-account data will be released to the parent only with the school's authorization.",
            "AIVO will verify the identity of the requestor before releasing any records. For school requests, verification is performed against the contact list on file in the District Agreement. For direct parent requests, verification will use the same method that was used to establish the parent's account (for example, the email associated with the account or the payment method on file).",
          ],
        },
        {
          title: "11. Data Access Controls",
          content:
            "AIVO enforces least-privilege access to education records through technical and administrative controls. These include:",
          list: [
            "Role-based access control with thirteen distinct roles and granular permissions; teachers see only the records of students assigned to them; school administrators see only the records of their school; district administrators see only the records of their district.",
            "Single sign-on and multi-factor authentication for all internal access by AIVO personnel.",
            "Mandatory background checks and annual privacy and security training for all AIVO personnel with access to education records.",
            "Detailed audit logs of every read, write, export, and deletion of an education record, retained for a minimum of 13 months in a separate, restricted-access log store.",
            "Automated alerts for unusual access patterns, mass exports, and access from unrecognized locations.",
          ],
        },
        {
          title: "12. Data Security Measures",
          content: [
            "We protect education records with administrative, technical, and physical safeguards that meet or exceed industry norms for student information. These include encryption in transit using TLS 1.3, encryption at rest using AES-256, single-tenant database isolation for student profiles, hardware-backed key management, role-based access control, multi-factor authentication for internal access, mandatory background checks for staff with access to education records, controls aligned with the SOC 2 Trust Services Criteria for security and availability, regular third-party penetration testing, and a documented incident-response plan.",
            "AIVO maintains an information-security program that aligns with the NIST Cybersecurity Framework and the controls in NIST SP 800-171. Our most recent security questionnaire (CAIQ-Lite and HECVAT-Lite), and any SOC 2 attestation when available, are made available to current and prospective school customers under NDA.",
          ],
        },
        {
          title: "13. Data Retention and Deletion",
          content: [
            "Education records are retained only for as long as the school continues to authorize AIVO to maintain them, plus any period the school directs us to retain the records under the District Agreement.",
            "When a District Agreement ends or the school instructs us to do so, AIVO will, at the school's election, either (a) return the school's education records to the school in a portable format and then delete its copies, or (b) securely delete the school's education records. Deletion will be completed within 60 days of the request unless a longer period is necessary to satisfy a litigation hold or applicable law, and we will provide written confirmation of completion. Backups containing the school's education records are overwritten on a rolling 35-day cycle and are not used to restore deleted records.",
            "When a teacher removes a student from a class, the student's records are detached from that class but remain available to other authorized teachers and to the school's administrators until the school otherwise instructs.",
            "Aggregated, de-identified analytics that cannot reasonably be linked to any individual student may be retained for educational research, model improvement, and statistical reporting consistent with 34 C.F.R. § 99.31(b)(1).",
          ],
        },
        {
          title: "14. Breach Notification",
          content: [
            "If AIVO experiences a security incident that involves unauthorized access to or acquisition of personally identifiable information from education records, AIVO will notify the affected school or district without unreasonable delay and in no event later than 72 hours after confirmation of the incident, in accordance with applicable state student-privacy and data-breach notification laws (including New York Education Law § 2-d, Connecticut General Statutes § 10-234dd, Texas Education Code § 32.151 et seq., and the California Student Online Personal Information Protection Act).",
            "Our notification will include the nature of the incident, the categories of records affected, the steps AIVO has taken to contain and remediate the incident, the steps the school may consider taking, and a point of contact at AIVO for further information. AIVO will cooperate with the school's notifications to parents, eligible students, and regulators.",
          ],
        },
        {
          title: "15. State Student-Privacy Laws",
          content: [
            "AIVO complies with the student-privacy laws of every U.S. state in which our school customers operate. Where required, the District Agreement is supplemented with state-specific exhibits.",
            'California — the Student Online Personal Information Protection Act (SOPIPA, Cal. Bus. & Prof. Code § 22584) and the California "Eraser Law" (§ 22581).',
            "New York — Education Law § 2-d, including the Parents' Bill of Rights, Data Security and Privacy Plan, and Supplemental Information for Contracts.",
            "Connecticut — Connecticut General Statutes § 10-234aa through § 10-234ff.",
            "Illinois — the Student Online Personal Protection Act (SOPPA, 105 ILCS 85/).",
            "Texas — Texas Education Code Chapter 32, Subchapter D.",
            "Other states — including Colorado (HB 16-1423), Georgia (Student Data Privacy Act), Maine (Student Information Privacy Act), Maryland (Education Article §§ 4-131 and 4-132), Tennessee (T.C.A. § 49-1-704), Utah (UCA § 53E-9-301 et seq.), Virginia (Code of Virginia § 22.1-289.01), and Washington (RCW 28A.604.020).",
            "AIVO has signed the Future of Privacy Forum's Student Privacy Pledge 2020 and is a participating member of the Student Data Privacy Consortium (SDPC). We accept and sign the SDPC's National Data Privacy Agreement (NDPA) and applicable state-specific exhibits.",
          ],
        },
        {
          title: "16. Filing a Complaint With the U.S. Department of Education",
          content: [
            "Parents, eligible students, and schools may file a written complaint with the U.S. Department of Education's Student Privacy Policy Office (SPPO) concerning alleged violations of FERPA. The Office's contact information is:",
            "Student Privacy Policy Office, U.S. Department of Education, 400 Maryland Avenue, SW, Washington, DC 20202-8520.",
            "Phone: 1-800-USA-LEARN (1-800-872-5327). Web: studentprivacy.ed.gov (the Office's current contact email is published on its website).",
            "Before filing a complaint, please consider contacting AIVO at compliance@aivolearning.com so we can investigate and respond.",
          ],
        },
        {
          title: "17. Self-Regulatory Programs and Certifications",
          content:
            "AIVO participates in industry programs that strengthen our FERPA compliance, including the iKeepSafe FERPA certification, the Future of Privacy Forum's Student Privacy Pledge 2020, the Student Data Privacy Consortium, and the 1EdTech (formerly IMS Global) TrustEd Apps program. Our compliance is independently audited annually, and audit summaries are available on request to current and prospective school customers under NDA.",
        },
        {
          title: "18. Changes to This Statement",
          content:
            "We may update this FERPA Compliance Statement from time to time to reflect changes in the law, in our practices, or in the categories of education records we maintain. When we make a material change that may affect a school's or district's rights, we will provide written notice through the email address on file in the District Agreement at least thirty days before the change takes effect. The \"Last updated\" date at the top of this page reflects the most recent material revision.",
        },
        {
          title: "19. Contact the Compliance Office",
          content: [
            "Email: compliance@aivolearning.com (school and district FERPA inquiries, parent and eligible-student requests routed through a school).",
            "Email: privacy@aivolearning.com (general privacy inquiries and direct-to-consumer requests).",
            "Email: dpo@aivolearning.com (international privacy inquiries, including UK GDPR and EU GDPR).",
            "Phone: +1 (612) 555-0102, Monday through Friday, 9:00 a.m. – 6:00 p.m. Eastern Time.",
            "Postal mail: Aivo AI Learning Technologies Inc., Attention: Compliance Office, 1400 Van Buren Street S, Suite 200, Minneapolis, MN, United States.",
          ],
        },
      ]}
    />
  );
}
