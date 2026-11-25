import type { Metadata } from "next";
import "./globals.css";
import { interfaceSettings } from "@/lib/server/preferences";
import { translate } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await interfaceSettings();
  return {
    title: "STRATA · " + translate(locale, "Biblioteca DLIS"),
    description: translate(
      locale,
      "Biblioteca e análise rastreável de arquivos DLIS RP66 V1.",
    ),
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, theme, syncAccount } = await interfaceSettings();
  return (
    <html lang={locale} data-theme={theme}>
      <body className="antialiased">
        <I18nProvider
          initialLocale={locale}
          initialTheme={theme}
          syncAccount={syncAccount}
        >
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
