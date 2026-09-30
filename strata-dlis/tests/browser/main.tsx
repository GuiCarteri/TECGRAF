import React from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "@/lib/i18n/provider";
import { parseLocale } from "@/lib/i18n";
import { Shell } from "@/components/strata/shell";
import { Viewer } from "@/components/strata/viewer";
import { Library } from "@/components/strata/library";
import { Account } from "@/components/strata/account";
import { Admin } from "@/components/strata/admin";
import { Publication } from "@/components/strata/publish";
import { Help } from "@/components/strata/help";
import { LoginContent } from "@/components/auth/login-content";
import "@/app/globals.css";
const route = location.pathname.slice(1) || "library";
const pages: Record<string, React.ReactNode> = {
  library: <Library />,
  viewer: <Viewer />,
  account: <Account />,
  admin: <Admin />,
  publish: <Publication />,
};
const locale = parseLocale(
  document.cookie.match(/(?:^|; )strata_locale=([^;]+)/)?.[1],
);
createRoot(document.getElementById("root")!).render(
  <I18nProvider initialLocale={locale}>
    {route === "help" ? (
      <Help />
    ) : route === "login" ? (
      <LoginContent p={{}} />
    ) : (
      <Shell active={route}>{pages[route] || <Library />}</Shell>
    )}
  </I18nProvider>,
);
