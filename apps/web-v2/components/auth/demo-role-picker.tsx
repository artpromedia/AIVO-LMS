import { MOCK_USERS } from "@/lib/auth/mock-session";
import { ROLE_LABEL, type Role } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";

const ROLES: Role[] = [
  "parent",
  "learner",
  "teacher",
  "school_admin",
  "district_admin",
  "platform_admin",
];

/**
 * Non-production demo role picker. Wrapped in a `<details>` so it stays
 * out of the way on the real form, but devs / reviewers can expand it
 * to jump into any role without typing credentials.
 *
 * Hidden entirely when NEXT_PUBLIC_AUTH_MODE === "production".
 */
export function DemoRolePicker({ action }: { action: (formData: FormData) => Promise<void> }) {
  return (
    <details className="group mt-6 rounded-iw-card border border-iw-border bg-iw-card/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-iw-ink-muted marker:hidden group-open:text-iw-ink">
        Demo accounts (preview only)
      </summary>
      <p className="mt-2 text-xs text-iw-ink-muted">
        Mock authentication for previews. Disabled in production.
      </p>
      <form action={action} className="mt-3 flex flex-col gap-2">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Demo role</legend>
          {ROLES.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-3 rounded-iw-card border border-iw-border bg-iw-raised px-3 py-2 text-sm hover:bg-iw-card"
            >
              <input
                type="radio"
                name="role"
                value={r}
                defaultChecked={r === "parent"}
                className="h-4 w-4 accent-iw-primary"
              />
              <span className="font-semibold text-iw-ink">{ROLE_LABEL[r]}</span>
              <span className="ml-auto text-xs text-iw-ink-muted">{MOCK_USERS[r].email}</span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" variant="outline" size="sm" className="mt-1 self-start">
          Continue with demo role
        </Button>
      </form>
    </details>
  );
}
