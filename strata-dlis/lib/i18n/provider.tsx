"use client";
import { createContext, useContext, useState, useMemo, useEffect } from "react";
import {
  parseLocale,
  translate,
  localizeMessage,
  type Locale,
  type MessageKey,
} from "./index";
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "pt-BR", setLocale: () => {} });
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, update] = useState(initialLocale);
  const value = useMemo(
    () => ({
      locale,
      setLocale: (next: Locale) => {
        const selected = parseLocale(next);
        document.cookie = `strata_locale=${selected}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        update(selected);
      },
    }),
    [locale],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
export function useI18n() {
  const { locale, setLocale } = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      setLocale,
      translate: (key: MessageKey, values?: Record<string, string | number>) =>
        translate(locale, key, values),
      message: (value: string) => localizeMessage(locale, value),
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, options).format(value),
      date: (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    }),
    [locale, setLocale],
  );
}
