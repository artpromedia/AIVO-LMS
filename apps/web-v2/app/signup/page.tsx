"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthInput } from "@aivo/ui/auth";
import { AivoIcon, type AivoIconName } from "@aivo/ui/icon";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { registerAction } from "@/lib/auth/auth-actions";
import {
  AuthSplitLayout,
  AuthSidePanel,
  AuthTrustCard,
  AuthSecureFooter,
} from "@/components/auth/auth-split-layout";
import { AivoBrandMark } from "@/components/auth/auth-brand-mark";

/**
 * Sign-up surface — redesigned onto the shared auth split layout. The form
 * posts to `registerAction` (a real account via identity-svc, AUTH_MODE=mock
 * falls back to the demo login). The "I am a…" block is a real role branch
 * (see SIGNUP_ROLES): the chosen role is created as the account's actual
 * identity-svc role AND sets the post-signup `next` destination so each
 * persona lands in its own experience / sub-app.
 */
const SIGNUP_ERROR_CODES = new Set([
  "invalid_input",
  "email_taken",
  "weak_password",
  "service_unavailable",
  "unsupported_role",
  "signup_failed",
]);

/**
 * Role branch. The chosen `role` is the account's actual identity-svc role
 * (wire format, uppercase) — self-serve registration now provisions PARENT,
 * TEACHER, SCHOOL_ADMIN, or DISTRICT_ADMIN accounts, each in an appropriate
 * tenant. The `next` destination routes each persona into its own experience
 * — mirroring the platform's per-role sub-apps (mobile `(parent)` /
 * `(teacher)` / … route groups and the web role homes). Parents self-onboard;
 * staff land on their invite flow. This is the same mapping as
 * `/onboarding/role`, surfaced earlier so the user picks their world up front.
 * Both `role` and `next` are validated server-side (`registerAction` allowlist
 * + `safePath`), so a tampered value can't escalate privileges or become an
 * open redirect.
 */
interface SignupRole {
  readonly id: "parent" | "teacher" | "schoolAdmin" | "districtAdmin";
  /** identity-svc wire role (uppercase) created for this persona. */
  readonly role: "PARENT" | "TEACHER" | "SCHOOL_ADMIN" | "DISTRICT_ADMIN";
  readonly labelKey: string;
  readonly descKey: string;
  readonly icon: AivoIconName;
  readonly next: string;
}

const SIGNUP_ROLES: ReadonlyArray<SignupRole> = [
  { id: "parent", role: "PARENT", labelKey: "parent_label", descKey: "parent_desc", icon: "care", next: "/onboarding/parent-setup" },
  { id: "teacher", role: "TEACHER", labelKey: "teacher_label", descKey: "teacher_desc", icon: "classroom", next: "/onboarding/invite/school" },
  { id: "schoolAdmin", role: "SCHOOL_ADMIN", labelKey: "school_admin_label", descKey: "school_admin_desc", icon: "rosterSchool", next: "/onboarding/invite/school" },
  { id: "districtAdmin", role: "DISTRICT_ADMIN", labelKey: "district_admin_label", descKey: "district_admin_desc", icon: "rosterDistrict", next: "/onboarding/invite/district" },
];

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const ts = useTranslations("auth.shell");
  const search = useSearchParams();
  const errorCode = search?.get("error");
  const errorMessage = errorCode
    ? t(`errors.${SIGNUP_ERROR_CODES.has(errorCode) ? errorCode : "signup_failed"}`)
    : null;

  const tr = useTranslations("onboarding.role");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [roleId, setRoleId] = React.useState<SignupRole["id"]>("parent");
  const activeRole = SIGNUP_ROLES.find((r) => r.id === roleId) ?? SIGNUP_ROLES[0];
  const [fieldErrors, setFieldErrors] = React.useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const validators = React.useMemo(
    () => ({
      name: (v: string) => (v.trim().length >= 2 ? undefined : t("errors_inline.name")),
      email: (v: string) => (/.+@.+\..+/.test(v) ? undefined : t("errors_inline.email")),
      password: (v: string) => (v.length >= 8 ? undefined : t("errors_inline.password")),
    }),
    [t],
  );

  const validateField = (field: "name" | "email" | "password", value: string) => {
    setFieldErrors((prev) => ({ ...prev, [field]: validators[field](value) }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const next = {
      name: validators.name(name),
      email: validators.email(email),
      password: validators.password(password),
    };
    setFieldErrors(next);
    const firstInvalid = (["name", "email", "password"] as const).find((f) => next[f]);
    if (firstInvalid) {
      e.preventDefault();
      document.getElementById(firstInvalid)?.focus();
    }
  };

  return (
    <AuthSplitLayout
      panel={
        <AuthSidePanel
          variant="wave"
          title={t("panel_title")}
          accent={t("panel_accent")}
          body={t("panel_body")}
        >
          <AuthTrustCard>{ts("trust_districts")}</AuthTrustCard>
        </AuthSidePanel>
      }
    >
      <div className="flex flex-col gap-6">
        <AivoBrandMark sublabel={ts("wordmark_family")} />

        <div className="text-center">
          <h1 className="font-iw-display text-2xl font-bold text-iw-ink">{t("card_title")}</h1>
          <p className="mt-1.5 text-sm text-iw-ink-muted">{t("promo_subtitle")}</p>
        </div>

        {errorMessage ? <Banner tone="danger" description={errorMessage} /> : null}

        <form
          id="signup-form"
          action={registerAction}
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="role" value={activeRole.role} />
          <input type="hidden" name="next" value={activeRole.next} />
          <input type="hidden" name="errorReturn" value="/signup" />
          <AuthInput
            id="name"
            name="name"
            label={t("name_label")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={(event) => validateField("name", event.target.value)}
            error={fieldErrors.name}
            placeholder={t("name_placeholder")}
            autoComplete="name"
            required
          />
          <AuthInput
            id="email"
            name="email"
            label={t("email_label")}
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={(event) => validateField("email", event.target.value)}
            error={fieldErrors.email}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <AuthInput
            id="password"
            name="password"
            label={t("password_label")}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onBlur={(event) => validateField("password", event.target.value)}
            error={fieldErrors.password}
            helper={t("password_helper")}
            autoComplete="new-password"
            required
          />

          {/* Role branch — sets the post-signup destination (next). */}
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-0.5 text-sm font-medium text-iw-ink">{t("role_label")}</legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {SIGNUP_ROLES.map((r) => {
                const active = r.id === roleId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoleId(r.id)}
                    aria-pressed={active}
                    className={`flex items-start gap-3 rounded-iw-card border-2 bg-iw-card p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg ${
                      active
                        ? "border-iw-primary bg-iw-accent-soft/50"
                        : "border-iw-border hover:border-iw-primary/50"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        active ? "bg-iw-primary text-iw-primary-fg" : "bg-iw-accent-soft text-iw-primary"
                      }`}
                    >
                      <AivoIcon name={r.icon} size={18} />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold text-iw-ink">{tr(r.labelKey)}</span>
                      <span className="mt-0.5 text-xs leading-relaxed text-iw-ink-muted">
                        {tr(r.descKey)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </form>

        <Button type="submit" form="signup-form" size="lg" className="w-full">
          {t("submit")}
        </Button>

        <p className="text-center text-sm text-iw-ink-muted">
          {t("already_have")}{" "}
          <Link
            href="/login"
            className="font-semibold text-iw-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg rounded"
          >
            {t("sign_in")}
          </Link>
          .
        </p>

        <AuthSecureFooter lead={ts("secure_signup")} sub={ts("encrypted")} />
      </div>
    </AuthSplitLayout>
  );
}
