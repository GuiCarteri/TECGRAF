import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STRATA · Biblioteca DLIS",
  description: "Biblioteca e análise rastreável de arquivos DLIS RP66 V1.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
