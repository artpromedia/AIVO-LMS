import { getRequestConfig } from "next-intl/server";
import { resolveServerLocale, loadServerMessages } from "./locale.server";

export default getRequestConfig(async () => {
  // Single source of truth (header from `?lang=` → cookie → default) so the
  // next-intl server messages never diverge from the layout's SSR locale.
  const locale = await resolveServerLocale();
  const messages = await loadServerMessages(locale);
  return { locale, messages, timeZone: "America/New_York" };
});
