"use client";
import { useState } from "react";
import { HomeworkChat } from "./chat";
import { HomeworkSidebar, type CaptureDescriptor } from "./sidebar";
import type { HomeworkHelpMessage } from "@/lib/db/types";

/**
 * Client shell that ties the work-through chat to the support sidebar. It owns
 * the shared break state (so the chat's "I need a break" chip and the sidebar
 * timer drive the same panel) and mirrors the learner's progress into the
 * encouragement dots.
 */
export function HomeworkWorkspace({
  learnerId,
  sessionId,
  initialMessages,
  regulationEnabled,
  capture,
}: {
  learnerId: string;
  sessionId: string;
  initialMessages: HomeworkHelpMessage[];
  regulationEnabled: boolean;
  capture: CaptureDescriptor;
}) {
  const [breakOpen, setBreakOpen] = useState(false);
  const [progress, setProgress] = useState(
    initialMessages.filter((m) => m.role === "learner").length,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <HomeworkChat
          learnerId={learnerId}
          sessionId={sessionId}
          initialMessages={initialMessages}
          regulationEnabled={regulationEnabled}
          onRequestBreak={() => setBreakOpen(true)}
          onProgress={setProgress}
        />
      </div>
      <HomeworkSidebar
        breakOpen={breakOpen}
        setBreakOpen={setBreakOpen}
        capture={capture}
        progress={progress}
      />
    </div>
  );
}
