import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { parseLocale } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n/provider";

export const metadata: Metadata = {
  title: "STRATA · Biblioteca DLIS",
  description: "Biblioteca e análise rastreável de arquivos DLIS RP66 V1.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = parseLocale((await cookies()).get("strata_locale")?.value);
  return (
    <html lang={locale}>
      <body className="antialiased">
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
