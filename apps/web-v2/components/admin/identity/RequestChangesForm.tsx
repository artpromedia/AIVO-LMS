"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function RequestChangesForm() {
  const t = useTranslations("admin.identity");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!message.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/bff/admin/identity/request-change", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: message.trim() }),
        });
        const json = await res.json();
        if (!json.ok) {
          setStatus({ kind: "err", msg: json.error?.userMessage ?? t("save_error") });
          return;
        }
        setStatus({ kind: "ok", msg: t("request_submitted") });
        setMessage("");
      } catch {
        setStatus({ kind: "err", msg: t("network_error") });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label htmlFor="change-request">{t("request_changes")}</Label>
        <Textarea
          id="change-request"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("request_changes_placeholder")}
          rows={4}
          maxLength={2000}
          className="mt-1"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        {status?.kind === "ok" ? <p className="text-sm text-aivo-success">{status.msg}</p> : null}
        {status?.kind === "err" ? <p className="text-sm text-aivo-danger">{status.msg}</p> : null}
        <Button type="submit" disabled={pending || !message.trim()}>
          {pending ? t("saving") : t("submit_request")}
        </Button>
      </div>
    </form>
  );
}
