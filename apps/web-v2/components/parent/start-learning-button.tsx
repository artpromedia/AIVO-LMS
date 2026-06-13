import { ArrowRight } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { enterLearnerHome } from "@/lib/learner/active-learner-actions";

/**
 * Parent CTA that switches into a learner's experience ("Open today's
 * mission"): sets the active-learner cookie and lands on `/learner/home`.
 *
 * Rendered as a form-bound Server Action rather than a `<Link>` to the
 * `/learner/select/auto` route handler so the cookie is set and the redirect is
 * followed deterministically — see `enterLearnerHome` for the full rationale.
 */
export function StartLearningButton({
  learnerId,
  label,
  size,
  variant,
  className,
  formClassName,
}: {
  learnerId: string;
  label: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  /** Class applied to the wrapping <form> (e.g. width control). */
  formClassName?: string;
}) {
  return (
    <form action={enterLearnerHome} className={formClassName}>
      <input type="hidden" name="learnerId" value={learnerId} />
      <Button
        type="submit"
        size={size}
        variant={variant}
        className={className}
        data-testid="enter-learner-cta"
        data-primary-cta="todays-mission"
      >
        {label}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </form>
  );
}
