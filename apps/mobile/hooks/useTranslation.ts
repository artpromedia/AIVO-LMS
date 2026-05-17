import i18n from '@/lib/i18n';

export function useTranslation() {
  const t = (key: string, options?: Record<string, any>) => {
    return i18n.t(key, options) as string;
  };

  return { t, i18n };
}
