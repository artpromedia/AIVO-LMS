"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import {
  type Locale,
  defaultLocale,
  detectBrowserLocale,
  getStoredLocale,
  setStoredLocale,
  locales,
  localeNames,
  localeFlags,
} from "@/i18n/config";

type Messages = Record<string, unknown>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  locales: readonly Locale[];
  localeNames: Record<string, string>;
  localeFlags: Record<string, string>;
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  locales,
  localeNames,
  localeFlags,
});

export function useLocale() {
  return useContext(I18nContext);
}

const messageCache: Partial<Record<Locale, Messages>> = {};

async function loadMessages(locale: Locale): Promise<Messages> {
  if (messageCache[locale]) return messageCache[locale]!;
  try {
    const mod = await import(`@/i18n/messages/${locale}.json`);
    messageCache[locale] = mod.default;
    return mod.default;
  } catch {
    if (locale !== defaultLocale) {
      return loadMessages(defaultLocale);
    }
    return {};
  }
}

export function I18nProvider({
  children,
  initialMessages,
}: {
  children: React.ReactNode;
  initialMessages: Messages;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = getStoredLocale();
    if (stored) return stored;
    return defaultLocale;
  });
  const [messages, setMessages] = useState<Messages>(initialMessages);
  const [initialized, setInitialized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (initialized) return;
    const stored = getStoredLocale();
    if (stored) {
      if (stored !== defaultLocale) {
        loadMessages(stored).then((msgs) => {
          setMessages(msgs);
          setLocaleState(stored);
        });
      }
    } else {
      const detected = detectBrowserLocale();
      if (detected !== defaultLocale) {
        loadMessages(detected).then((msgs) => {
          setMessages(msgs);
          setLocaleState(detected);
          setStoredLocale(detected);
          // Re-render Server Components with newly detected locale cookie.
          router.refresh();
        });
      }
    }
    setInitialized(true);
  }, [initialized, router]);

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setStoredLocale(newLocale);
      loadMessages(newLocale).then((msgs) => {
        setMessages(msgs);
        setLocaleState(newLocale);
        document.documentElement.lang = newLocale;
        if (newLocale === "ar") {
          document.documentElement.dir = "rtl";
        } else {
          document.documentElement.dir = "ltr";
        }
        // Re-render Server Components so server-rendered chunks pick up the cookie.
        router.refresh();
      });
    },
    [router],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    if (locale === "ar") {
      document.documentElement.dir = "rtl";
    }
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, locales, localeNames, localeFlags }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/New_York">
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}
