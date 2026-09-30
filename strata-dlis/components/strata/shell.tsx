"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
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
import { api } from "@/lib/api";
import { LanguageSelector } from "./language-selector";
import { Toaster } from "@/components/ui/sonner";
export function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: string;
}) {
  const { translate } = useI18n();
  const [user, setUser] = useState<any>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    api("me")
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a href="/" className="brand">
          <Layers3 size={28} />
          <span>
            STRATA<span className="brand-divider">/</span>
            <small>{translate("DLIS WORKSPACE")}</small>
          </span>
        </a>
        <nav
          aria-label={translate("Navegação principal")}
          className={menu ? "topnav open" : "topnav"}
        >
          <a className={active === "library" ? "active" : ""} href="/">
            <LibraryBig size={17} />
            {translate("Biblioteca")}
          </a>
          <a className={active === "viewer" ? "active" : ""} href="/viewer">
            <ScanLine size={17} />
            {translate("Visualizador")}
          </a>
          <a className={active === "publish" ? "active" : ""} href="/publish">
            <Upload size={17} />
            {translate("Publicar DLIS")}
          </a>
          {user?.role === "admin" && (
            <a href="/admin">
              <ShieldCheck size={17} />
              {translate("Administração")}
            </a>
          )}
        </nav>
        <div className="account-nav">
          <LanguageSelector />
          {user ? (
            <a className="user-link" href="/account">
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
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
        </div>
      </header>
      <main>{children}</main>
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
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
