"use client";

export interface ClassLearnerRow {
  learnerId: string;
  displayName: string;
  gradeBand?: string;
  functioningLevel?: string;
  lastActiveAt?: string;
}

export interface ClassLearnerTableProps {
  classId: string;
  className: string;
  learners: ClassLearnerRow[];
}

/**
 * Teacher-facing class roster. Shows the instructional profile fields a
 * teacher is allowed to see (grade band, functioning level, last active).
 * Parent private notes are NOT shown — the role policy blocks them and
 * this view does not request them from the API.
 */
export function ClassLearnerTable({ classId, className, learners }: ClassLearnerTableProps) {
  return (
    <section className="class-learner-table">
      <header className="mb-2">
        <h3 className="text-lg font-semibold">{className}</h3>
        <p className="text-xs text-gray-600">{classId}</p>
      </header>
      {learners.length === 0 ? (
        <p className="text-sm text-gray-600">No learners enrolled yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Learner</th>
              <th>Grade</th>
              <th>Functioning level</th>
              <th>Last active</th>
            </tr>
          </thead>
          <tbody>
            {learners.map((l) => (
              <tr key={l.learnerId} className="border-b last:border-0">
                <td className="py-1">{l.displayName}</td>
                <td>{l.gradeBand ?? "—"}</td>
                <td className="text-xs">{l.functioningLevel ?? "—"}</td>
                <td className="text-xs text-gray-600">
                  {l.lastActiveAt ? new Date(l.lastActiveAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default ClassLearnerTable;
