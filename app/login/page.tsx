import { authMode } from "@/lib/server/provider";
import { EmailForm } from "@/components/auth/email-form";
import { Shell } from "@/components/strata/shell";
import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import {
  Layers3,
  Bookmark,
  ShieldCheck,
  ArrowUpRight,
  History,
} from "lucide-react";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const p = await searchParams;
  return (
    <Shell active="login">
      <div className="auth-wrap">
        <div className="auth-story">
          <Layers3 size={38} />
          <h2>
            O arquivo é o começo.
            <br />A análise é sua.
          </h2>
          <p>
            Explore curvas, fixe amostras e retome seu trabalho com a mesma
            rastreabilidade.
          </p>
          <div className="auth-benefit">
            <Bookmark size={19} /> Pontos e observações na sua conta
          </div>
          <div className="auth-benefit">
            <History size={19} /> Histórico de arquivos e análises
          </div>
          <div className="auth-benefit">
            <ShieldCheck size={19} /> Exportações com valores originais
          </div>
        </div>
        <div className="auth-form">
          {authMode() === "supabase" ? (
            <EmailForm
              initial={p.mode === "register" ? "register" : "login"}
              next={p.next || "/account"}
            />
          ) : (
            <>
              <div className="eyebrow">SEU ESPAÇO DE ANÁLISE</div>
              <h1>Entre no STRATA</h1>
              <p>
                Use sua conta ChatGPT para acessar o visualizador e salvar seus
                pontos.
              </p>
              <a
                className="button primary"
                href={chatGPTSignInPath(p.next || "/account")}
                target="_top"
              >
                Continuar com ChatGPT <ArrowUpRight size={17} />
              </a>
              <p className="auth-foot">
                Ainda não tem conta? O cadastro é realizado na tela de acesso do
                ChatGPT. A recuperação da conta e da senha também é feita pelo
                provedor.
              </p>
              <a className="status-label" href="/">
                Voltar à biblioteca pública
              </a>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
