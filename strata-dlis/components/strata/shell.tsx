"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Layers3,
  LibraryBig,
  ScanLine,
  Upload,
  UserRound,
  ShieldCheck,
  ArrowUpRight,
  Menu,
} from "lucide-react";
import Link from "next/link";
import type { UserProfile } from "@/lib/api-types";
import { api } from "@/lib/api";
import { themes, themeLabels, type Theme } from "@/lib/i18n";
import { CommandPalette } from "./command-palette";
import { LanguageSelector } from "./language-selector";
import { Toaster } from "@/components/ui/sonner";
// A navegação de documento permite o aviso nativo quando há marcações sem salvar.
export function LibraryLink({
  children,
  className,
  preserveUnsaved = false,
}: {
  children: React.ReactNode;
  className: string;
  preserveUnsaved?: boolean;
}) {
  return (
    <Link
      aria-current={className === "active" ? "page" : undefined}
      href="/"
      prefetch={false}
      className={className}
      onNavigate={
        preserveUnsaved
          ? (event) => {
              event.preventDefault();
              window.location.assign(new URL("/", window.location.origin));
            }
          : undefined
      }
    >
      {children}
    </Link>
  );
}
const subscribeHydration = () => () => {};
export function Shell({
  children,
  active,
  initialUser,
}: {
  children: React.ReactNode;
  active: string;
  initialUser?: UserProfile;
}) {
  const { translate, theme, setTheme } = useI18n();
  const [fetchedUser, setUser] = useState<UserProfile | null>(initialUser ?? null);
  const user = initialUser ?? fetchedUser;
  const [menu, setMenu] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  useEffect(() => {
    if (initialUser) return;
    api<{ user: UserProfile | null }>("me")
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, [initialUser]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {translate("Pular para o conteúdo")}
      </a>
      <header className="topbar">
        <LibraryLink className="brand" preserveUnsaved={active === "viewer"}>
          <Layers3 size={28} />
          <span>
            STRATA<span className="brand-divider">/</span>
            <small>{translate("DLIS WORKSPACE")}</small>
          </span>
        </LibraryLink>
        <nav
          id="primary-navigation"
          aria-label={translate("Navegação principal")}
          className={menu ? "topnav open" : "topnav"}
        >
          <LibraryLink
            className={active === "library" ? "active" : ""}
            preserveUnsaved={active === "viewer"}
          >
            <LibraryBig size={17} />
            {translate("Biblioteca")}
          </LibraryLink>
          <a
            aria-current={active === "viewer" ? "page" : undefined}
            className={active === "viewer" ? "active" : ""}
            href="/viewer"
          >
            <ScanLine size={17} />
            {translate("Visualizador")}
          </a>
          <a
            aria-current={active === "publish" ? "page" : undefined}
            className={active === "publish" ? "active" : ""}
            href="/publish"
          >
            <Upload size={17} />
            {translate("Publicar DLIS")}
          </a>
          {user?.role === "admin" && (
            <a
              href="/admin"
              aria-current={active === "admin" ? "page" : undefined}
            >
              <ShieldCheck size={17} />
              {translate("Administração")}
            </a>
          )}
        </nav>
        <div className="account-nav">
          <CommandPalette admin={user?.role === "admin"} signedIn={!!user} />
          <LanguageSelector />
          <select
            className="theme-select"
            disabled={!hydrated}
            aria-label={translate("Aparência")}
            value={theme}
            onChange={(event) => setTheme(event.target.value as Theme)}
          >
            {themes.map((option) => (
              <option key={option} value={option}>
                {translate(themeLabels[option])}
              </option>
            ))}
          </select>
          {user ? (
            <a
              className="user-link"
              href="/account"
              aria-label={translate("Minha conta")}
            >
              <UserRound size={18} />
              <span>{translate("Minha conta")}</span>
            </a>
          ) : (
            <>
              <a href="/login">{translate("Entrar")}</a>
              <a className="button compact light" href="/register">
                {translate("Criar conta")}
                <ArrowUpRight size={15} />
              </a>
            </>
          )}
          <button
            className="menu-toggle"
            aria-label={translate("Abrir navegação")}
            aria-expanded={menu}
            aria-controls="primary-navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="footer">
        <span>
          STRATA{" "}
          <span className="muted">{translate("/ Dados de subsuperfície")}</span>
        </span>
        <span>
          DLIS RP66 V1 <span className="footer-sep">·</span>
          <a href="/help">{translate("Guia técnico")}</a>
        </span>
      </footer>
      <Toaster position="bottom-right" />
    </div>
  );
}
