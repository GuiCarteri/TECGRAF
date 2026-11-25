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
export function libraryTitle(locale: Locale): string {
  return "STRATA · " + translate(locale, "Biblioteca DLIS");
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

export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];
export const themeLabels = {
  system: "Tema automático",
  light: "Tema claro",
  dark: "Tema escuro",
} as const;
export function browserLocale(header: string | null): Locale {
  const choices = (header || "")
    .split(",")
    .map((item) => {
      const [tag, weight] = item
        .trim()
        .toLowerCase()
        .split(/\s*;\s*q=/);
      return {
        language: tag.split("-")[0],
        weight: weight === undefined ? 1 : Number(weight),
      };
    })
    .filter((item) => item.weight > 0 && item.weight <= 1)
    .sort((a, b) => b.weight - a.weight);
  for (const choice of choices) {
    const match = locales.find(
      (locale) => locale.toLowerCase().split("-")[0] === choice.language,
    );
    if (match) return match;
  }
  return "pt-BR";
}
