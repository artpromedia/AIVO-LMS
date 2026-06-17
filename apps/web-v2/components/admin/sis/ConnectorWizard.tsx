"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMappingEditor, type FieldMappingValue } from "./FieldMappingEditor";
import type { SisProvider } from "@/lib/db/sis-store";

const PROVIDERS: Array<{ value: SisProvider; label: string; desc: string }> = [
  {
    value: "oneroster_rest",
    label: "OneRoster REST",
    desc: "PowerSchool, Infinite Campus, Skyward (OAuth2).",
  },
  { value: "oneroster_csv", label: "OneRoster CSV", desc: "Bulk CSV upload (1.1 / 1.2)." },
  { value: "clever", label: "Clever", desc: "Clever Secure Sync." },
  { value: "classlink", label: "ClassLink", desc: "ClassLink Roster Server." },
];

type Step = "provider" | "credentials" | "mapping" | "dryrun" | "done";

export function ConnectorWizard({ tenantId }: { tenantId: string }) {
  const t = useTranslations("admin.sis");
  const router = useRouter();
  const [step, setStep] = useState<Step>("provider");
  const [provider, setProvider] = useState<SisProvider>("oneroster_rest");
  const [displayName, setDisplayName] = useState("");
  const [credentialHint, setCredentialHint] = useState("");
  const [mapping, setMapping] = useState<FieldMappingValue>({
    emailDomain: "",
    studentRole: "learner",
    teacherRole: "teacher",
    gradeMap: {},
  });
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [dryRunCounts, setDryRunCounts] = useState<{
    added: number;
    updated: number;
    removed: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function createAndDryRun() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/admin/sis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tenantId,
            provider,
            displayName: displayName.trim() || `${provider} connector`,
            credentialHint: credentialHint.trim() || null,
            mapping,
          }),
        });
        const json = await res.json();
        if (!json.ok) return setError(json.error?.userMessage ?? t("error_generic"));
        const id = json.data.connector.id as string;
        setConnectorId(id);
        const dr = await fetch(`/api/bff/admin/sis/${id}/runs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "full", dryRun: true }),
        });
        const drJson = await dr.json();
        if (drJson.ok) setDryRunCounts(drJson.data.run.counts);
        setStep("dryrun");
      } catch {
        setError(t("error_network"));
      }
    });
  }

  return (
    <div className="space-y-5">
      <ol
        className="flex flex-wrap gap-2 text-xs text-aivo-ink-soft"
        aria-label={t("wizard_steps")}
      >
        {(["provider", "credentials", "mapping", "dryrun"] as Step[]).map((s, i) => (
          <li key={s} className={step === s ? "font-semibold text-aivo-primary" : ""}>
            {i + 1}. {t(`step_${s}`)}
          </li>
        ))}
      </ol>

      {step === "provider" ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {PROVIDERS.map((p) => (
              <label
                key={p.value}
                className={`cursor-pointer rounded-md border p-3 text-sm ${provider === p.value ? "border-iw-primary bg-iw-purple-100" : "border-iw-border hover:bg-iw-raised"}`}
              >
                <input
                  type="radio"
                  name="provider"
                  className="sr-only"
                  checked={provider === p.value}
                  onChange={() => setProvider(p.value)}
                />
                <span className="block font-semibold">{p.label}</span>
                <span className="mt-1 block text-xs text-aivo-ink-soft">{p.desc}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setStep("credentials")}>
              {t("next")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "credentials" ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor="cw-name">{t("connector_name")}</Label>
            <Input
              id="cw-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="PowerSchool (OneRoster)"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="cw-cred">{t("credential_hint")}</Label>
            <Input
              id="cw-cred"
              value={credentialHint}
              onChange={(e) => setCredentialHint(e.target.value)}
              placeholder="client_id ····a1b2"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-aivo-ink-soft">{t("credential_note")}</p>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("provider")}>
              {t("back")}
            </Button>
            <Button type="button" onClick={() => setStep("mapping")}>
              {t("next")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "mapping" ? (
        <div className="space-y-3">
          <FieldMappingEditor value={mapping} onChange={setMapping} />
          {error ? <p className="text-sm text-aivo-danger">{error}</p> : null}
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("credentials")}>
              {t("back")}
            </Button>
            <Button type="button" onClick={createAndDryRun} disabled={pending}>
              {pending ? t("running_dry_run") : t("run_dry_run")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "dryrun" ? (
        <div className="space-y-3">
          <div className="rounded-md border border-iw-border bg-iw-raised p-4 text-sm">
            <p className="font-semibold">{t("dry_run_result")}</p>
            <p className="mt-1 text-aivo-ink-soft">
              {dryRunCounts
                ? t("dry_run_counts", {
                    added: dryRunCounts.added,
                    updated: dryRunCounts.updated,
                    removed: dryRunCounts.removed,
                  })
                : t("dry_run_no_writes")}
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => connectorId && router.push(`/admin/district/sis/${connectorId}`)}
            >
              {t("finish")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
