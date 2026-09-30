"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { languageNames, locales, parseLocale } from "@/lib/i18n";
export function LanguageSelector() {
  const { locale, setLocale, translate } = useI18n();
  const id = useId();
  return (
    <div className="language-selector">
      <label htmlFor={id} className="sr-only">
        {translate("language")}
      </label>
      <select
        id={id}
        value={locale}
        onChange={(e) => setLocale(parseLocale(e.target.value))}
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {languageNames[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
