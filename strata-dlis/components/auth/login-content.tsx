"use client";
import { useI18n } from "@/lib/i18n/provider";
import { EmailForm } from "@/components/auth/email-form";
import { Shell } from "@/components/strata/shell";
import { Layers3, Bookmark, ShieldCheck, History } from "lucide-react";
export function LoginContent({ p }: { p: { next?: string; mode?: string } }) {
  const { translate } = useI18n();
  return (
    <Shell active="login">
      <div className="auth-wrap">
        <div className="auth-story">
          <Layers3 size={38} />
          <h2>
            {translate("O arquivo é o começo.")}
            <br />
            {translate("A análise é sua.")}
          </h2>
          <p>
            {translate(
              "Explore curvas, fixe amostras e retome seu trabalho com a mesma rastreabilidade.",
            )}
          </p>
          <div className="auth-benefit">
            <Bookmark size={19} />
            {translate("Pontos e observações na sua conta")}
          </div>
          <div className="auth-benefit">
            <History size={19} />
            {translate("Histórico de arquivos e análises")}
          </div>
          <div className="auth-benefit">
            <ShieldCheck size={19} />
            {translate("Exportações com valores originais")}
          </div>
        </div>
        <div className="auth-form">
          <EmailForm
            initial={p.mode === "register" ? "register" : "login"}
            next={p.next || "/account"}
          />
        </div>
      </div>
    </Shell>
  );
}
