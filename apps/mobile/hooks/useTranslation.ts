import i18n from "@/lib/i18n";

export function useTranslation() {
  // Supports both i18next calling styles used across the app:
  //   t(key)                      → translate
  //   t(key, "Fallback copy")     → translate with an inline default
  //   t(key, { count, name })     → translate with interpolation options
  //   t(key, "Fallback", { ... }) → default + options
  const t = (
    key: string,
    defaultValueOrOptions?: string | Record<string, any>,
    options?: Record<string, any>,
  ) => {
    if (typeof defaultValueOrOptions === "string") {
      return i18n.t(key, { defaultValue: defaultValueOrOptions, ...(options ?? {}) }) as string;
    }
    return i18n.t(key, defaultValueOrOptions) as string;
  };

  return { t, i18n };
}
