"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ScimTokenPreview } from "@/lib/db/idp-store";

export function ScimTokenCard({ idpId, tokens }: { idpId: string; tokens: ScimTokenPreview[] }) {
  const router = useRouter();
  const t = useTranslations("admin.identity");
  const [label, setLabel] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function issue() {
    setError(null);
    setIssued(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/admin/identity/scim-token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idpId, label: label.trim() || undefined }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error?.userMessage ?? t("save_error"));
          return;
        }
        setIssued(json.data.token);
        setLabel("");
        router.refresh();
      } catch {
        setError(t("network_error"));
      }
    });
  }

  function revoke(tokenId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/admin/identity/scim-token", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idpId, tokenId }),
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.error?.userMessage ?? t("save_error"));
          return;
        }
        router.refresh();
      } catch {
        setError(t("network_error"));
      }
    });
  }

  const active = tokens.filter((tk) => !tk.revokedAt);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-lg font-semibold">{t("scim_tokens")}</p>
        <p className="mt-1 text-xs text-aivo-ink-soft">{t("scim_tokens_help")}</p>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="scim-label">{t("token_label")}</Label>
          <Input
            id="scim-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("token_label_placeholder")}
            maxLength={120}
            className="mt-1"
          />
        </div>
        <Button type="button" onClick={issue} disabled={pending}>
          {pending ? t("saving") : t("issue_token")}
        </Button>
      </div>

      {issued ? (
        <div
          className="rounded-md border border-aivo-success bg-aivo-success-soft p-3"
          role="status"
        >
          <p className="text-sm font-semibold">{t("token_issued_once")}</p>
          <code className="mt-2 block break-all rounded bg-aivo-surface px-2 py-1 text-xs">
            {issued}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigator.clipboard?.writeText(issued)}
          >
            {t("copy")}
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-aivo-danger">{error}</p> : null}

      <div className="space-y-2">
        {active.length === 0 ? (
          <p className="text-xs text-aivo-ink-soft">{t("no_active_tokens")}</p>
        ) : (
          active.map((tk) => (
            <div
              key={tk.id}
              className="flex items-center justify-between rounded-md border border-aivo-border p-2 text-sm"
            >
              <div>
                <span className="font-medium">{tk.label}</span>{" "}
                <code className="text-xs text-aivo-ink-soft">····{tk.last4}</code>
                <span className="ml-2 text-xs text-aivo-ink-soft">
                  {new Date(tk.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="success">{t("active")}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => revoke(tk.id)}
                  disabled={pending}
                >
                  {t("revoke")}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
