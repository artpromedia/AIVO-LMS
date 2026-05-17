import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Security at AIVO Learning",
  description:
    "How AIVO protects learner, family, and school data: encryption, access controls, audit logging, vendor transparency, and how to report a vulnerability.",
  alternates: { canonical: `${SITE_URL}/security` },
};

export default function SecurityPage() {
  return (
    <LegalPageLayout
      badge="Security"
      title="How we protect your data."
      subtitle="AIVO is designed to support the security expectations of families and schools. This page is procurement-friendly: it describes what we actually do today, what we're building toward, and how to reach our security team."
      icon="🛡️"
      accentColor="#0d9488"
      lastUpdated="May 17, 2026"
      contactEmail="security@aivolearning.com"
      sections={[
        {
          title: "Security overview",
          content: [
            "AIVO's security program is designed around three goals: protect learner data, give schools auditable controls, and limit the blast radius of any single failure. We do not claim certifications we have not achieved — we describe the practices in place today and the work in flight.",
            "AIVO is designed to support SOC 2 Type II controls. We have not yet completed a SOC 2 Type II audit; once we do, we will publish the report under NDA on this page. We will not use the SOC 2 logo or claim certification until the audit is complete.",
          ],
        },
        {
          title: "Data protection approach",
          content:
            "Learner data is the most sensitive data AIVO handles. We treat it differently from operational data, and we do not use it to train third-party AI foundation models.",
          list: [
            "Personally identifiable information about learners (including chat transcripts, Brain-Clone interactions, and assessment results) is never used to train any third-party AI foundation model.",
            "Tutor prompts sent to foundation models are scrubbed of learner identifiers before they leave AIVO infrastructure.",
            "Backups are encrypted, region-scoped, and access-restricted.",
            "Production data is segregated from development and staging.",
          ],
        },
        {
          title: "Encryption posture",
          content:
            "All data in transit is encrypted with TLS 1.2 or higher. Data at rest in our primary PostgreSQL store and object storage is encrypted using provider-managed keys. Service-to-service traffic inside the cluster is authenticated and, where appropriate, additionally encrypted via mTLS.",
        },
        {
          title: "Access controls",
          content:
            "AIVO production access is restricted to a small number of engineers on a least-privilege basis. All employee access requires multi-factor authentication. Access is reviewed quarterly. Customer support staff do not have direct production database access; structured tools mediate any view of learner data.",
          list: [
            "Multi-factor authentication is required for all employee accounts.",
            "Production console access is scoped per engineer and audit-logged.",
            "Customer support uses purpose-built tools rather than raw database access.",
            "Access is reviewed on a regular cadence and revoked on role change or offboarding.",
          ],
        },
        {
          title: "Audit logging",
          content:
            "Privileged operations on the AIVO platform — admin actions, exports, deletions, role changes — are written to an append-only audit log. School and district administrators can review audit events for their own tenant from their admin console.",
        },
        {
          title: "Vendor and subprocessor transparency",
          content:
            "AIVO uses a small number of carefully chosen subprocessors. The full list — what each one does, what category of data they may handle, and where they operate — is published at /subprocessors. We update that page when subprocessors change.",
        },
        {
          title: "Vulnerability reporting",
          content:
            "If you believe you have found a security vulnerability in AIVO, please email security@aivolearning.com. We will acknowledge your report within two business days. We do not currently run a paid bug bounty, but we do appreciate coordinated disclosure and will credit researchers who help us, with permission.",
          list: [
            "Please do not test against accounts you do not own.",
            "Please do not exfiltrate learner data.",
            "Give us reasonable time to fix and verify before public disclosure.",
          ],
        },
        {
          title: "For school and district procurement",
          content:
            "If you need our security packet for a district procurement review — including DPA template, subprocessor list, encryption posture summary, and incident response overview — request it from security@aivolearning.com or compliance@aivolearning.com. We typically respond within two business days.",
        },
      ]}
    />
  );
}
