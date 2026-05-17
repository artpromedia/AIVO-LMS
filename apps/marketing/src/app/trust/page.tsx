import type { Metadata } from "next";
import { LegalPageLayout } from "@/components/marketing/legal/LegalPageLayout";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Trust Center — AIVO Learning",
  description:
    "AIVO's product safety principles, learner data boundaries, parent controls, teacher access boundaries, AI safety posture, and how to reach a real person.",
  alternates: { canonical: `${SITE_URL}/trust` },
};

export default function TrustPage() {
  return (
    <LegalPageLayout
      badge="Trust"
      title="What we promise — and how to check."
      subtitle="A short, honest summary of how AIVO behaves around learners, families, and teachers. Every claim here is something we can show evidence for if you ask."
      icon="🤝"
      accentColor="#7c3aed"
      lastUpdated="May 17, 2026"
      contactEmail="trust@aivolearning.com"
      sections={[
        {
          title: "Product safety principles",
          content: "AIVO is built for children, including learners under 13. Safety is not a feature — it is the operating constraint.",
          list: [
            "We never show third-party advertisements on learner surfaces.",
            "We do not sell or rent learner or family data to anyone.",
            "We do not use learner content to train any third-party AI foundation model.",
            "Tutors decline to engage with sensitive personal content and route to a human path where appropriate.",
            "Homework Helper will not dump answers — it guides the learner to their own answer.",
          ],
        },
        {
          title: "Learner data boundaries",
          content:
            "Learner data is treated as the most sensitive category in our system. It is encrypted, access-controlled, and segregated from operational telemetry. Chat transcripts and Brain-Clone state are not sent to foundation models with learner identifiers attached. Aggregate research data is opt-in at the school level and never includes direct identifiers.",
        },
        {
          title: "Parent controls",
          content:
            "Parents are the default authority on every learner account under 13. Schools that use AIVO under FERPA may act as the responsible party for school-issued accounts; in that case, parents retain inspection rights through their school.",
          list: [
            "Parents can review weekly learning summaries from their dashboard.",
            "Parents can pause tutoring, restrict subjects, or adjust functioning level.",
            "Parents can request a full data export at privacy@aivolearning.com.",
            "Parents can delete the learner's account at any time; deletion is permanent within 30 days.",
          ],
        },
        {
          title: "Teacher access boundaries",
          content:
            "Teachers see classroom-level data for learners enrolled in their classes. Teachers do not have access to other learners in the district or to learner records outside their assigned roster. Special education staff may have a wider scope where required by an IEP — that scope is controlled by the district admin and logged.",
        },
        {
          title: "AI safety posture",
          content:
            "AIVO uses a fallback chain of foundation models (Claude, Gemini, GPT) through a structured gateway. Every learner-facing prompt is scoped to the active subject, functioning level, and safety rails. Outputs are filtered for unsafe content before reaching the learner.",
          list: [
            "Tutors operate under per-subject system prompts that are version-controlled and reviewed.",
            "Learner prompts are scrubbed of direct identifiers before reaching foundation models.",
            "If the model returns content outside the safety envelope, AIVO returns a soft refusal rather than the model output.",
            "Homework Helper enforces an anti-answer-dump rule — graded tests, IEP assessments, and direct-answer requests are declined.",
          ],
        },
        {
          title: "Talk to a real person",
          content:
            "Trust is built on responsive humans, not chatbots. For trust, privacy, security, or compliance questions, write to trust@aivolearning.com, privacy@aivolearning.com, security@aivolearning.com, or compliance@aivolearning.com. We typically reply within one business day.",
        },
      ]}
    />
  );
}
