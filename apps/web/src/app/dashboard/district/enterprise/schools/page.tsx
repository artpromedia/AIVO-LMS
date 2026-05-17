"use client";

import { useEffect, useState } from "react";

interface SchoolRow {
  id: string;
  districtId: string;
  name: string;
  externalId?: string;
  classCount?: number;
  teacherCount?: number;
  learnerCount?: number;
}

export default function DistrictSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/districts/current/schools");
        if (!res.ok) {
          setError(`Failed to load schools (${res.status}).`);
          return;
        }
        const data = (await res.json()) as { schools?: SchoolRow[] };
        setSchools(data.schools ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load schools.");
      }
    })();
  }, []);

  return (
    <main className="district-schools-page mx-auto max-w-4xl space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-bold">Schools</h1>
      </header>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">School</th>
            <th>External ID</th>
            <th>Classes</th>
            <th>Teachers</th>
            <th>Learners</th>
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              <td className="py-1">{s.name}</td>
              <td className="text-xs text-gray-600">{s.externalId ?? "—"}</td>
              <td>{s.classCount ?? 0}</td>
              <td>{s.teacherCount ?? 0}</td>
              <td>{s.learnerCount ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
