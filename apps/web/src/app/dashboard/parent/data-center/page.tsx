"use client";

import { useState } from "react";
import { ParentDataExportPanel } from "../../../../components/data-governance/ParentDataExportPanel";
import { DeletionRequestPanel } from "../../../../components/data-governance/DeletionRequestPanel";

/**
 * Sprint 09 parent data center. Lets a parent export or delete their
 * learner's data through the data-governance-svc. Both actions emit
 * audit events server-side.
 */
export default function ParentDataCenterPage() {
  const [learnerId, setLearnerId] = useState("");
  return (
    <main className="parent-data-center mx-auto max-w-2xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">Your data</h1>
        <p className="text-sm text-gray-600">
          Export or delete your learner's data. Every action is recorded in the
          audit log.
        </p>
      </header>
      <section className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="learner-id">
          Learner ID
        </label>
        <input
          id="learner-id"
          type="text"
          value={learnerId}
          onChange={(e) => setLearnerId(e.target.value)}
          placeholder="Paste your learner's id"
          className="w-full rounded border p-2 text-sm"
        />
      </section>
      {learnerId ? (
        <>
          <ParentDataExportPanel learnerId={learnerId} />
          <DeletionRequestPanel learnerId={learnerId} requesterId="current" />
        </>
      ) : null}
    </main>
  );
}
