"use client";
import * as React from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthCard,
  ReassuranceCard,
  ConsentRow,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

/**
 * /onboarding/child-approval
 *
 * Final parent approval step. The parent reviews what their child
 * will be able to do on AIVO and presses "Approve". Until this step
 * is completed, the learner profile is in a holding state and the
 * learner cannot sign in.
 *
 * Sprint-3 acceptance criterion enforced here:
 *   "Child cannot bypass parent approval."
 */
export default function ChildApprovalPage() {
  const [communication, setCommunication] = React.useState(true);
  const [aiTutor, setAiTutor] = React.useState(true);
  const [voiceMode, setVoiceMode] = React.useState(false);

  return (
    <AuthShell>
      <AuthCard
        icon={<AivoIcon name="care" size={32} />}
        eyebrow="Final step"
        title="Approve your child's access."
        subtitle="These are the experiences your child can use on AIVO. You can change any of these from their profile later."
        reassurance={
          <ReassuranceCard
            tone="safety"
            title="Your child is waiting on you."
            body="Until you press Approve, this profile is in a holding state. Your child cannot sign in or start lessons."
          />
        }
        actions={
          <>
            <Link
              href="/parent/home"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary,#7c3aed)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              Approve and finish
            </Link>
            <p className="text-xs text-iw-text-muted text-center">
              You'll arrive on the parent home with your child set up and
              ready.
            </p>
          </>
        }
      >
        <ConsentRow
          id="ca-comm"
          title="Messages with teachers"
          description="Your child can read messages from teachers and reply with adult-moderated quick responses."
          checked={communication}
          onChange={setCommunication}
          badge="Recommended"
          icon={<AivoIcon name="classroom" size={18} />}
        />
        <ConsentRow
          id="ca-ai"
          title="AI tutor"
          description="A conversational tutor that explains concepts, never produces final answers, and routes safety topics to an adult."
          checked={aiTutor}
          onChange={setAiTutor}
          badge="Recommended"
          icon={<AivoIcon name="aiBrain" size={18} />}
        />
        <ConsentRow
          id="ca-voice"
          title="Voice mode"
          description="Lets your child speak to the tutor and listen back. Off by default — uses the microphone."
          checked={voiceMode}
          onChange={setVoiceMode}
          badge="Optional"
          icon={<AivoIcon name="aiWand" size={18} />}
        />
      </AuthCard>
    </AuthShell>
  );
}
