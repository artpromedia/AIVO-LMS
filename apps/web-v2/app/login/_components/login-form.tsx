"use client";

import * as React from "react";
import Link from "next/link";
import { AuthInput } from "@aivo/ui/auth";

/**
 * Client form fields for /login. The submit button lives in the parent
 * (server) page so it can drive the `mockSignIn` server action via the
 * `form="login-form"` attribute. The hidden `role` defaults to "parent"
 * — the DemoRolePicker sets a different value when used.
 */
export function LoginForm({
  id,
  action,
}: {
  readonly id: string;
  readonly action: ((formData: FormData) => Promise<void>) | undefined;
}) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);

  return (
    <form id={id} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="role" value="parent" />
      <AuthInput
        id="email"
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        required
      />
      <AuthInput
        id="password"
        name="password"
        label="Password"
        type={showPw ? "text" : "password"}
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        trailing={
          <button
            type="button"
            onClick={() => setShowPw((value) => !value)}
            className="text-xs font-semibold text-[var(--aivo-sensory-primary,#7c3aed)] hover:underline"
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? "Hide" : "Show"}
          </button>
        }
      />
      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-xs font-semibold text-[var(--aivo-sensory-primary,#7c3aed)] hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
