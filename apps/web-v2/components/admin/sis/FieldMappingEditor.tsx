"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type FieldMappingValue = {
  emailDomain: string;
  studentRole: string;
  teacherRole: string;
  gradeMap: Record<string, string>;
};

/** Editor for SIS → AIVO field mapping (email domain, roles, grade bands). */
export function FieldMappingEditor({
  value,
  onChange,
}: {
  value: FieldMappingValue;
  onChange: (next: FieldMappingValue) => void;
}) {
  const t = useTranslations("admin.sis");
  const gradeEntries = Object.entries(value.gradeMap);

  function set<K extends keyof FieldMappingValue>(k: K, v: FieldMappingValue[K]) {
    onChange({ ...value, [k]: v });
  }
  function setGradeKey(oldKey: string, newKey: string) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(value.gradeMap)) next[k === oldKey ? newKey : k] = v;
    set("gradeMap", next);
  }
  function setGradeVal(k: string, v: string) {
    set("gradeMap", { ...value.gradeMap, [k]: v });
  }
  function removeGrade(k: string) {
    const next = { ...value.gradeMap };
    delete next[k];
    set("gradeMap", next);
  }

  return (
    <fieldset className="space-y-4 rounded-md border border-aivo-border p-4">
      <legend className="px-1 text-sm font-semibold">{t("field_mapping")}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="map-email">{t("email_domain")}</Label>
          <Input
            id="map-email"
            value={value.emailDomain}
            onChange={(e) => set("emailDomain", e.target.value)}
            placeholder="district.k12.us"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="map-student">{t("student_role")}</Label>
          <Input
            id="map-student"
            value={value.studentRole}
            onChange={(e) => set("studentRole", e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="map-teacher">{t("teacher_role")}</Label>
          <Input
            id="map-teacher"
            value={value.teacherRole}
            onChange={(e) => set("teacherRole", e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">{t("grade_map")}</p>
        <p className="text-xs text-aivo-ink-soft">{t("grade_map_help")}</p>
        <div className="mt-2 space-y-2">
          {gradeEntries.length === 0 ? (
            <p className="text-xs text-aivo-ink-soft">{t("grade_map_empty")}</p>
          ) : null}
          {gradeEntries.map(([sis, aivo], i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={t("sis_grade")}
                value={sis}
                onChange={(e) => setGradeKey(sis, e.target.value)}
                className="flex-1"
                placeholder="06"
              />
              <span aria-hidden className="text-aivo-ink-soft">
                →
              </span>
              <Input
                aria-label={t("aivo_grade")}
                value={aivo}
                onChange={(e) => setGradeVal(sis, e.target.value)}
                className="flex-1"
                placeholder="Grade 6"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeGrade(sis)}
                aria-label={t("remove")}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            if (value.gradeMap[""] === undefined) set("gradeMap", { ...value.gradeMap, "": "" });
          }}
        >
          {t("add_grade")}
        </Button>
      </div>
    </fieldset>
  );
}
