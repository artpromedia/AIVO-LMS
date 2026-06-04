"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/** AIVO roles an IdP is permitted to provision via JIT (mirrors identity-svc). */
export const PROVISIONABLE_ROLES = ["DISTRICT_ADMIN", "TEACHER", "CAREGIVER", "THERAPIST"] as const;

export type AttributeMappingValue = {
  email: string;
  name: string;
  role: string;
  roleMap: Record<string, string>;
  defaultRole: string;
};

export function AttributeMappingEditor({
  value,
  onChange,
}: {
  value: AttributeMappingValue;
  onChange: (next: AttributeMappingValue) => void;
}) {
  const t = useTranslations("admin.identity");
  const entries = Object.entries(value.roleMap);

  function setField<K extends keyof AttributeMappingValue>(key: K, v: AttributeMappingValue[K]) {
    onChange({ ...value, [key]: v });
  }

  function updateMapKey(oldKey: string, newKey: string) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(value.roleMap)) {
      next[k === oldKey ? newKey : k] = v;
    }
    setField("roleMap", next);
  }

  function updateMapValue(key: string, role: string) {
    setField("roleMap", { ...value.roleMap, [key]: role });
  }

  function removeMapEntry(key: string) {
    const next = { ...value.roleMap };
    delete next[key];
    setField("roleMap", next);
  }

  function addMapEntry() {
    if (value.roleMap[""] !== undefined) return;
    setField("roleMap", { ...value.roleMap, "": "TEACHER" });
  }

  return (
    <fieldset className="space-y-4 rounded-md border border-aivo-border p-4">
      <legend className="px-1 text-sm font-semibold">{t("attribute_mapping")}</legend>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="attr-email">{t("attr_email")}</Label>
          <Input
            id="attr-email"
            value={value.email}
            onChange={(e) => setField("email", e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="attr-name">{t("attr_name")}</Label>
          <Input
            id="attr-name"
            value={value.name}
            onChange={(e) => setField("name", e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="attr-role">{t("attr_role")}</Label>
          <Input
            id="attr-role"
            value={value.role}
            onChange={(e) => setField("role", e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">{t("role_map")}</p>
        <p className="text-xs text-aivo-ink-soft">{t("role_map_help")}</p>
        <div className="mt-2 space-y-2">
          {entries.length === 0 ? (
            <p className="text-xs text-aivo-ink-soft">{t("role_map_empty")}</p>
          ) : null}
          {entries.map(([idpValue, aivoRole], i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={t("idp_value")}
                placeholder={t("idp_value")}
                value={idpValue}
                onChange={(e) => updateMapKey(idpValue, e.target.value)}
                className="flex-1"
              />
              <span aria-hidden className="text-aivo-ink-soft">
                →
              </span>
              <select
                aria-label={t("aivo_role")}
                value={aivoRole}
                onChange={(e) => updateMapValue(idpValue, e.target.value)}
                className="h-9 flex-1 rounded-md border border-aivo-border bg-aivo-surface px-2 text-sm"
              >
                {PROVISIONABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeMapEntry(idpValue)}
                aria-label={t("remove_mapping")}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addMapEntry}>
          {t("add_mapping")}
        </Button>
      </div>

      <div className="sm:w-1/2">
        <Label htmlFor="attr-default-role">{t("default_role")}</Label>
        <select
          id="attr-default-role"
          value={value.defaultRole}
          onChange={(e) => setField("defaultRole", e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-aivo-border bg-aivo-surface px-2 text-sm"
        >
          {PROVISIONABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
