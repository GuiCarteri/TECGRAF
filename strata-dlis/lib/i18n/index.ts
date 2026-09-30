import pt from "./pt-BR.json";
import en from "./en.json";
import zh from "./zh-CN.json";
import es from "./es.json";
export const locales = ["pt-BR", "en", "zh-CN", "es"] as const;
export type Locale = (typeof locales)[number];
export type MessageKey = keyof typeof pt;
export const languageNames: Record<Locale, string> = {
  "pt-BR": "Português",
  en: "English",
  "zh-CN": "简体中文",
  es: "Español",
};
export function parseLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "pt-BR";
}
const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  "pt-BR": pt,
  en,
  "zh-CN": zh,
  es,
};
export function translate(
  locale: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  const text = dictionaries[locale]?.[key] ?? pt[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    String(values[name] ?? match),
  );
}
/** Only call for known UI messages/enums, never file metadata or user input. */
export function localizeMessage(locale: Locale, message: string): string {
  if (Object.hasOwn(pt, message))
    return translate(locale, message as MessageKey);
  for (const key of Object.keys(pt).filter(
    (key) =>
      key.endsWith("{detail}") && key.indexOf("{") === key.indexOf("{detail}"),
  )) {
    const prefix = key.slice(0, -8);
    if (message.startsWith(prefix))
      return translate(locale, key as MessageKey, {
        detail: message.slice(prefix.length),
      });
  }
  const lf = /^Logical file (\d+): metadados não decodificados: (.*)$/.exec(
    message,
  );
  if (lf)
    return translate(
      locale,
      "Logical file {index}: metadados não decodificados: {detail}",
      { index: lf[1], detail: localizeMessage(locale, lf[2]) },
    );
  const lrs = /^LRS at 0x([a-f0-9]+): bad length (\d+)$/.exec(message);
  if (lrs)
    return translate(locale, "LRS at 0x{offset}: bad length {length}", {
      offset: lrs[1],
      length: lrs[2],
    });
  return message;
}
