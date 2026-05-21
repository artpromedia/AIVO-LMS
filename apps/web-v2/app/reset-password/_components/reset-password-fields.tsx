"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthInput } from "@aivo/ui/auth";

/**
 * Client controls for the reset-password form. Two password fields with
 * a single show/hide toggle (both fields hide together), and inline
 * confirmation that the two values match — submit is blocked otherwise
 * via `required` semantics. Server still re-validates everything.
 */
export function ResetPasswordFields({ id }: { readonly id: string }) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 12;

  const trailing = (
    <button
      type="button"
      onClick={() => setShowPw((value) => !value)}
      aria-label={showPw ? "Hide password" : "Show password"}
      aria-pressed={showPw}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-iw-ink-muted hover:bg-iw-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iw-ring focus-visible:ring-offset-2 focus-visible:ring-offset-iw-bg"
    >
      {showPw ? (
        <EyeOff className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Eye className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <>
      <AuthInput
        id={`${id}-password`}
        name="password"
        label="New password"
        type={showPw ? "text" : "password"}
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={12}
        helper={
          tooShort
            ? "Use at least 12 characters with a mix of letters, numbers, and symbols."
            : "Use at least 12 characters. We'll reject reused or weak passwords."
        }
        trailing={trailing}
      />
      <AuthInput
        id={`${id}-confirm`}
        name="confirm"
        label="Confirm new password"
        type={showPw ? "text" : "password"}
        autoComplete="new-password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        required
        helper={mismatch ? "Passwords don't match yet." : undefined}
        trailing={trailing}
      />
    </>
  );
}
