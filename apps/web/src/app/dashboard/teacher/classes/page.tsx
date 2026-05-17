"use client";

import { useEffect, useState } from "react";
import {
  ClassLearnerTable,
  type ClassLearnerRow,
} from "../../../../components/enterprise/ClassLearnerTable";

interface TeacherClass {
  classId: string;
  className: string;
  schoolName?: string;
  learners: ClassLearnerRow[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/teacher/classes");
        if (!res.ok) {
          setError(`Failed to load classes (${res.status}).`);
          return;
        }
        const data = (await res.json()) as { classes?: TeacherClass[] };
        setClasses(data.classes ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load classes.");
      }
    })();
  }, []);

  return (
    <main className="teacher-classes-page mx-auto max-w-4xl space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold">My classes</h1>
        <p className="text-sm text-gray-600">
          Assigned classes and learners. Parent-private notes are not visible.
        </p>
      </header>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {classes.length === 0 && !error ? (
        <p className="rounded border border-dashed p-3 text-sm text-gray-600">
          You have no class assignments yet.
        </p>
      ) : null}
      {classes.map((klass) => (
        <ClassLearnerTable
          key={klass.classId}
          classId={klass.classId}
          className={klass.className}
          learners={klass.learners}
        />
      ))}
    </main>
  );
}
