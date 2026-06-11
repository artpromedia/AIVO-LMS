"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { AuthInput } from "@aivo/ui/auth";

/**
 * Client fields for /signup. The submit button lives in the server
 * page so the form can drive the `signUpAction` server action via the
 * `form="signup-form"` attribute (mirrors /login).
 */
export function SignupForm({
  id,
  action,
}: {
  readonly id: string;
  readonly action: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("auth");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);

  return (
    <form id={id} action={action} className="flex flex-col gap-4" noValidate>
      <AuthInput
        id="name"
        name="name"
        label={t("signup.name_label")}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("signup.name_placeholder")}
        autoComplete="name"
        required
      />
      <AuthInput
        id="email"
        name="email"
        label={t("signup.email_label")}
        type="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        required
      />
      <AuthInput
        id="password"
        name="password"
        label={t("signup.password_label")}
        type={showPw ? "text" : "password"}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        helper={t("signup.password_helper")}
        autoComplete="new-password"
        required
        trailing={
          <button
            type="button"
            onClick={() => setShowPw((value) => !value)}
            aria-label={showPw ? t("common.hide_password") : t("common.show_password")}
            aria-pressed={showPw}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-iw-ink-muted hover:bg-iw-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg"
          >
            {showPw ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        }
      />
    </form>
  );
}
