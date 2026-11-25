import "./globals.css";
import { interfaceSettings } from "@/lib/server/preferences";
import { translate } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { locale, theme, syncAccount } = await interfaceSettings();
  return (
    <html lang={locale} data-theme={theme}>
      <head>
        <title>{"STRATA · " + translate(locale, "Biblioteca DLIS")}</title>
        <meta
          name="description"
          content={translate(locale, "Biblioteca e análise rastreável de arquivos DLIS RP66 V1.")}
        />
        <link rel="icon" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </head>
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
