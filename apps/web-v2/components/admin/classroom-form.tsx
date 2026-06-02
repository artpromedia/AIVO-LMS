"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { GradeBand } from "@/lib/admin/school-ops";

export interface ClassroomFormValues {
  name: string;
  grade: GradeBand;
  teacherId: string;
}

interface ClassroomFormProps {
  schoolId: string;
  /** If provided, we're editing an existing classroom */
  classroomId?: string;
  defaultValues?: Partial<ClassroomFormValues>;
  teachers?: Array<{ id: string; name: string }>;
}

const GRADE_OPTIONS: Array<{ value: GradeBand; label: string }> = [
  { value: "K", label: "Kindergarten (K)" },
  { value: "1", label: "Grade 1" },
  { value: "2", label: "Grade 2" },
  { value: "3", label: "Grade 3" },
  { value: "4", label: "Grade 4" },
  { value: "5", label: "Grade 5" },
  { value: "6", label: "Grade 6" },
  { value: "7", label: "Grade 7" },
  { value: "8", label: "Grade 8" },
  { value: "9", label: "Grade 9" },
  { value: "10", label: "Grade 10" },
  { value: "11", label: "Grade 11" },
  { value: "12", label: "Grade 12" },
];

const DEFAULT_TEACHERS = [
  { id: "u_teacher_1", name: "Ms. Rivera" },
  { id: "u_teacher_2", name: "Mr. Patel" },
  { id: "u_teacher_3", name: "Ms. Chen" },
  { id: "u_teacher_4", name: "Mr. Johnson" },
];

export function ClassroomForm({
  schoolId,
  classroomId,
  defaultValues,
  teachers = DEFAULT_TEACHERS,
}: ClassroomFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(defaultValues?.name ?? "");
  const [grade, setGrade] = React.useState<GradeBand>(defaultValues?.grade ?? "K");
  const [teacherId, setTeacherId] = React.useState(
    defaultValues?.teacherId ?? teachers[0]?.id ?? "",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEditing = !!classroomId;
  const endpoint = isEditing
    ? `/api/bff/admin/school/classrooms/${classroomId}`
    : "/api/bff/admin/school/classrooms";
  const method = isEditing ? "PATCH" : "POST";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Classroom name is required.");
      return;
    }
    if (!teacherId) {
      setError("Please select a teacher.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schoolId, name, grade, teacherId }),
      });
      const body = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Failed to save classroom.");
        return;
      }
      router.push("/admin/school/classrooms");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="cls-name">Classroom name</Label>
        <Input
          id="cls-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ms. Rivera — Grade 4A"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cls-grade">Grade</Label>
        <Select value={grade} onValueChange={(v) => setGrade(v as GradeBand)}>
          <SelectTrigger id="cls-grade">
            <SelectValue placeholder="Select grade" />
          </SelectTrigger>
          <SelectContent>
            {GRADE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cls-teacher">Primary teacher</Label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger id="cls-teacher">
            <SelectValue placeholder="Select teacher" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-aivo-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : isEditing ? "Save changes" : "Create classroom"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
