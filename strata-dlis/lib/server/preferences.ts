import { cache } from "react";
import { cookies, headers } from "next/headers";
import {
  browserLocale,
  locales,
  themes,
  type Locale,
  type Theme,
} from "../i18n";
import { currentUser } from "./auth";
import { providerUser } from "./provider";
import { query } from "./db";

type Preferences = { theme?: Theme | null; locale?: Locale | null };

export const interfaceSettings = cache(async function interfaceSettings() {
  const jar = await cookies();
  const syncAccount = jar.has("strata_access") || jar.has("strata_refresh");
  let saved: Preferences | null = null;
  if (jar.has("strata_access")) {
    try {
      const identity = await providerUser();
      if (identity)
        saved = await query(
          "SELECT locale, theme FROM interface_preferences WHERE user_id = ?",
          identity.userId,
        ).first<Preferences>();
    } catch {
      // Uma indisponibilidade da conta ainda permite abrir as páginas públicas.
    }
  }
  const selectedLocale = saved?.locale ?? jar.get("strata_locale")?.value;
  const selectedTheme = saved?.theme ?? jar.get("strata_theme")?.value;
  return {
    syncAccount,
    locale: locales.includes(selectedLocale as Locale)
      ? (selectedLocale as Locale)
      : browserLocale((await headers()).get("accept-language")),
    theme: themes.includes(selectedTheme as Theme)
      ? (selectedTheme as Theme)
      : ("system" as const),
  };
});

export async function savePreferences({ locale, theme }: Preferences) {
  const user = await currentUser();
  if (!user) return false;
  await query(
    `INSERT INTO interface_preferences (user_id, locale, theme) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET locale = COALESCE(excluded.locale, interface_preferences.locale),
       theme = COALESCE(excluded.theme, interface_preferences.theme)`,
    user.id,
    locale ?? null,
    theme ?? null,
  ).run();
  return true;
}
