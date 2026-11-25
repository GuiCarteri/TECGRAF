"use client";
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";
import { authenticatedFetch } from "../api";
import {
  translate,
  localizeMessage,
  type Theme,
  type Locale,
  type MessageKey,
} from "./index";

const LocaleContext = createContext<{
  locale: Locale;
  theme: Theme;
  syncAccount: boolean;
  setLocale: (value: Locale) => void;
  setTheme: (value: Theme) => void;
}>({
  locale: "pt-BR" as Locale,
  theme: "system" as Theme,
  syncAccount: false,
  setLocale: () => {},
  setTheme: () => {},
});

export function I18nProvider({
  initialLocale,
  initialTheme = "system",
  syncAccount = false,
  children,
}: {
  initialLocale: Locale;
  initialTheme?: Theme;
  syncAccount?: boolean;
  children: React.ReactNode;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const [theme, updateTheme] = useState(initialTheme);
  const pending = useRef(Promise.resolve());
  const persist = useCallback(
    (key: "theme" | "locale", value: Theme | Locale, language: Locale) => {
      try {
        document.cookie = `strata_${key}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      } catch {
        // A preferência também funciona na página quando os cookies são bloqueados.
      }
      if (!syncAccount) return;
      pending.current = pending.current
        .then(async () => {
          const response = await authenticatedFetch("/api/preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [key]: value }),
            keepalive: true,
          });
          if (!response.ok) throw new Error();
        })
        .catch(() => {
          toast.error(
            translate(
              language,
              "Preferência aplicada neste navegador. Falha ao sincronizar com a conta.",
            ),
          );
        });
    },
    [syncAccount],
  );
  const value = useMemo(
    () => ({
      locale,
      theme,
      syncAccount,
      setLocale: (next: Locale) => {
        updateLocale(next);
        persist("locale", next, next);
      },
      setTheme: (next: Theme) => {
        updateTheme(next);
        persist("theme", next, locale);
      },
    }),
    [locale, theme, syncAccount, persist],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = "STRATA · " + translate(locale, "Biblioteca DLIS");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        "content",
        translate(
          locale,
          "Biblioteca e análise rastreável de arquivos DLIS RP66 V1.",
        ),
      );
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}
export function useI18n() {
  const settings = useContext(LocaleContext);
  const { locale } = settings;
  return useMemo(
    () => ({
      ...settings,
      translate: (key: MessageKey, values?: Record<string, string | number>) =>
        translate(locale, key, values),
      message: (value: string) => localizeMessage(locale, value),
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        new Intl.NumberFormat(locale, options).format(value),
      date: (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat(locale, options).format(new Date(value)),
    }),
    [settings, locale],
  );
}
const query = "(prefers-color-scheme: dark)";
function subscribe(listener: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener("change", listener);
  return () => media?.removeEventListener("change", listener);
}
export function useDarkTheme() {
  const { theme } = useContext(LocaleContext);
  const dark = useSyncExternalStore(
    subscribe,
    () => !!window.matchMedia?.(query).matches,
    () => false,
  );
  return theme === "dark" || (theme === "system" && dark);
}
