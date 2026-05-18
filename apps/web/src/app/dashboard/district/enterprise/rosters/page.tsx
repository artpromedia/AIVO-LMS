"use client";

import { RosterImportPanel } from "../../../../../components/enterprise/RosterImportPanel";

export default function DistrictRostersPage() {
  return (
    <main className="district-rosters-page mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-bold">Roster import</h1>
        <p className="text-sm text-gray-600">
          Import a normalized Clever or ClassLink JSON export. Existing learners are upserted
          without overwriting parent-owned profile fields.
        </p>
      </header>
      <RosterImportPanel districtId="current" />
    </main>
  );
}
