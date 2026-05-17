"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/UserAvatar";

interface AvatarUploaderProps {
  currentAvatarUrl?: string | null;
  userName?: string | null;
  accessToken: string | null;
  onChange: (newUrl: string | null) => void;
  /** Visual diameter for the preview (px). Defaults to 96. */
  size?: number;
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function AvatarUploader({
  currentAvatarUrl,
  userName,
  accessToken,
  onChange,
  size = 96,
}: AvatarUploaderProps) {
  const t = useTranslations("common");
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bust, setBust] = useState<number>(0);

  const reset = () => {
    setPending(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setErr("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    if (!ALLOWED_MIME.includes(file.type)) {
      setErr(t("avatar_invalid_type"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setErr(t("avatar_too_large"));
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPending(file);
  };

  const handleSave = async () => {
    if (!pending || !accessToken) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", pending);
      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || t("avatar_upload_failed"));
        return;
      }
      onChange(data.avatarUrl ?? null);
      setBust(Date.now());
      reset();
    } catch {
      setErr(t("avatar_upload_failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!accessToken) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 204) {
        setErr(t("avatar_remove_failed"));
        return;
      }
      onChange(null);
      setBust(Date.now());
      reset();
    } catch {
      setErr(t("avatar_remove_failed"));
    } finally {
      setBusy(false);
    }
  };

  const showingPreview = !!previewUrl;
  const displayUrl = showingPreview ? previewUrl : currentAvatarUrl ?? null;

  return (
    <div className="flex items-start gap-5">
      <div className="flex-shrink-0">
        {showingPreview ? (
          <span
            className="relative inline-flex items-center justify-center rounded-full overflow-hidden bg-slate-100"
            style={{ width: size, height: size }}
          >
            { }
            <img
              src={displayUrl as string}
              alt={t("avatar_preview_alt")}
              style={{ width: size, height: size, objectFit: "cover" }}
            />
          </span>
        ) : (
          <UserAvatar
            avatarUrl={currentAvatarUrl}
            name={userName}
            size={size}
            bust={bust || undefined}
          />
        )}
      </div>

      <div className="flex-1 space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          onChange={onPick}
          className="hidden"
          aria-label={t("avatar_change")}
        />
        <div className="flex flex-wrap gap-2">
          {!pending && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[hsl(var(--visual-primary))] text-white hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50"
                style={{ minHeight: 44 }}
              >
                {t("avatar_change")}
              </button>
              {currentAvatarUrl && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border vi-border vi-text-muted hover:vi-text transition disabled:opacity-50"
                  style={{ minHeight: 44 }}
                >
                  {busy ? t("avatar_uploading") : t("avatar_remove")}
                </button>
              )}
            </>
          )}
          {pending && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[hsl(var(--visual-primary))] text-white hover:bg-[hsl(var(--visual-primary)/0.9)] transition disabled:opacity-50"
                style={{ minHeight: 44 }}
              >
                {busy ? t("avatar_uploading") : t("avatar_save")}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold rounded-lg border vi-border vi-text-muted hover:vi-text transition disabled:opacity-50"
                style={{ minHeight: 44 }}
              >
                {t("avatar_cancel")}
              </button>
            </>
          )}
        </div>
        <p className="text-xs vi-text-muted">{t("avatar_hint")}</p>
        {err && (
          <p className="text-sm text-[hsl(var(--visual-math))] bg-[hsl(var(--visual-math)/0.12)] p-2 rounded">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}

export default AvatarUploader;
