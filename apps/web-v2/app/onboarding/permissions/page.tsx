"use client";
import * as React from "react";
import Link from "next/link";
import {
  AuthShell,
  AuthCard,
  ReassuranceCard,
  ConsentRow,
  StepperHeader,
} from "@aivo/ui/auth";
import { AivoIcon } from "@aivo/ui/icon";

const STEPS = [
  { label: "About you" },
  { label: "Role" },
  { label: "Family" },
  { label: "Consent" },
] as const;

export default function DevicePermissionsPage() {
  const [mic, setMic] = React.useState(false);
  const [cam, setCam] = React.useState(false);
  const [notifs, setNotifs] = React.useState(true);

  return (
    <AuthShell>
      <div className="flex flex-col gap-5">
        <StepperHeader steps={STEPS} current={3} />
        <AuthCard
          icon={<AivoIcon name="safetyOk" size={32} />}
          eyebrow="Device permissions"
          title="What may AIVO use on this device?"
          subtitle="These are the only device features AIVO ever asks for. We never request location, contacts, or photo library access."
          reassurance={
            <ReassuranceCard
              tone="safety"
              title="Your browser asks for these too."
              body="When AIVO actually needs the microphone or camera, your browser will pop its own permission prompt — you can deny it even if you said yes here."
            />
          }
          actions={
            <Link
              href="/onboarding/pin"
              className="w-full h-12 rounded-iw-control bg-[var(--aivo-sensory-primary)] text-white font-semibold flex items-center justify-center hover:opacity-95"
            >
              Continue — set up a PIN
            </Link>
          }
        >
          <ConsentRow
            id="p-mic"
            title="Microphone"
            description="Used only for speak-to-read lessons and AI tutor voice mode. Off by default — turn on if your child wants to read aloud."
            checked={mic}
            onChange={setMic}
            badge="Optional"
            icon={<AivoIcon name="aiWand" size={18} />}
          />
          <ConsentRow
            id="p-cam"
            title="Camera"
            description="Used only when scanning a homework page or document. AIVO never records video."
            checked={cam}
            onChange={setCam}
            badge="Optional"
            icon={<AivoIcon name="curriculum" size={18} />}
          />
          <ConsentRow
            id="p-notifs"
            title="Notifications"
            description="Approval requests, weekly progress digests, and safety messages. Lesson reminders are off by default — you can enable them later."
            checked={notifs}
            onChange={setNotifs}
            badge="Recommended"
            icon={<AivoIcon name="safetyOk" size={18} />}
          />
        </AuthCard>
      </div>
    </AuthShell>
  );
}
