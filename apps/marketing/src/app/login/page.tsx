import { redirect } from "next/navigation";
import { WEB_APP_URL } from "@/lib/constants";

/**
 * The marketing site no longer hosts a real or demo login form. Any direct
 * navigation to https://aivolearning.com/login (bookmarks, autocomplete,
 * older inbound links) is forwarded to the real app surface at
 * https://app.aivolearning.com/login so users land on the actual sign-in
 * flow against identity-svc.
 *
 * Implemented as a server component so the redirect happens at request
 * time without rendering any client UI.
 */
export default function MarketingLoginRedirect({
  searchParams,
}: {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Preserve any query string the marketing site received (e.g. ?notice=…,
  // utm_*, returnTo) so the app surface can use it.
  void searchParams;
  redirect(`${WEB_APP_URL}/login`);
}
