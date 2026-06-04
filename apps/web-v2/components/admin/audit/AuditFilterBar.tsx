"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export type AuditFilterValue = {
  from: string;
  to: string;
  actorId: string;
  actorRole: string;
  actions: string[];
  q: string;
};

export function emptyFilter(): AuditFilterValue {
  return { from: "", to: "", actorId: "", actorRole: "", actions: [], q: "" };
}

export function AuditFilterBar({
  value,
  actions,
  onChange,
  onApply,
  onReset,
}: {
  value: AuditFilterValue;
  actions: string[];
  onChange: (v: AuditFilterValue) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("admin.audit");
  function set<K extends keyof AuditFilterValue>(k: K, v: AuditFilterValue[K]) {
    onChange({ ...value, [k]: v });
  }
  function toggleAction(a: string) {
    set(
      "actions",
      value.actions.includes(a) ? value.actions.filter((x) => x !== a) : [...value.actions, a],
    );
  }

  return (
    <form
      className="space-y-3 rounded-md border border-aivo-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
      aria-label={t("filters")}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="f-from">{t("from")}</Label>
          <Input
            id="f-from"
            type="date"
            value={value.from}
            onChange={(e) => set("from", e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="f-to">{t("to")}</Label>
          <Input
            id="f-to"
            type="date"
            value={value.to}
            onChange={(e) => set("to", e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="f-actor">{t("actor")}</Label>
          <Input
            id="f-actor"
            value={value.actorId}
            onChange={(e) => set("actorId", e.target.value)}
            placeholder={t("actor_placeholder")}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="f-q">{t("free_text")}</Label>
          <Input
            id="f-q"
            value={value.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder={t("free_text_placeholder")}
            className="mt-1"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">{t("actions_label")}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {actions.length === 0 ? (
            <span className="text-xs text-aivo-ink-soft">{t("no_actions")}</span>
          ) : null}
          {actions.map((a) => (
            <label
              key={a}
              className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                value.actions.includes(a)
                  ? "border-aivo-primary bg-aivo-primary-soft"
                  : "border-aivo-border"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={value.actions.includes(a)}
                onChange={() => toggleAction(a)}
              />
              {a}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          {t("reset")}
        </Button>
        <Button type="submit" size="sm">
          {t("apply")}
        </Button>
      </div>
    </form>
  );
}
