"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { languageNames, locales, parseLocale } from "@/lib/i18n";

/**
 * Keep instantaneous React translation when hydration works.
 * The ordinary GET form remains usable if the browser's RSC bundle fails.
 */
export function LanguageSelector() {
  const { locale, setLocale, translate, syncAccount } = useI18n();
  const id = useId();
  return (
    <form
      className="language-selector"
      action="/api/locale"
      method={syncAccount ? "post" : "get"}
      onSubmit={(event) => {
        event.preventDefault();
        setLocale(
          parseLocale(String(new FormData(event.currentTarget).get("lang"))),
        );
      }}
    >
      <label htmlFor={id} className="sr-only">
        {translate("language")}
      </label>
      <select
        id={id}
        name="lang"
        value={locale}
        onChange={(e) => setLocale(parseLocale(e.target.value))}
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {languageNames[code]}
          </option>
        ))}
      </select>
      <button className="language-apply" type="submit">
        {translate("Aplicar")}
      </button>
    </form>
  );
}
