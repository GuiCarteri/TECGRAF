"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useState, useEffect } from "react";
import {
  UserRound,
  ArrowUpRight,
  History,
  Bookmark,
  LogOut,
  Download,
  Upload,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { api } from "@/lib/api";
export function Account() {
  const { translate, message, locale } = useI18n();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api("me"),
      api("analyses"),
      api("history"),
      api("my-files"),
      api("exports"),
    ])
      .then(([me, a, h, f, e]) =>
        setData({
          user: me.user,
          analyses: a.analyses,
          history: h.history,
          files: f.files,
          exports: e.exports,
        }),
      )
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="standard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{translate("SEU TRABALHO")}</div>
          <h1>
            {translate("Minha conta")}
            <span className="title-period">.</span>
          </h1>
          <p>
            {translate("Análises, publicações e histórico em um só lugar.")}
          </p>
        </div>
        <a className="button primary" href="/viewer">
          {translate("Abrir visualizador")}
          <ArrowUpRight size={16} />
        </a>
      </div>
      {error && <div className="notice error">{message(error)}</div>}
      {!data && !error ? (
        <div className="notice">{translate("Carregando sua conta…")}</div>
      ) : (
        data && (
          <div className="account-grid">
            <aside className="panel">
              <div className="profile-icon">
                <UserRound size={27} />
              </div>
              <h2>{data.user.name}</h2>
              <p className="status-label" style={{ overflowWrap: "anywhere" }}>
                {data.user.email}
              </p>
              <span className="badge" style={{ marginTop: 16 }}>
                {
                  (
                    {
                      user: translate("Usuário"),
                      publisher: translate("Publicador"),
                      admin: translate("Administrador"),
                    } as any
                  )[data.user.role]
                }
              </span>
              <div className="stack" style={{ marginTop: 30 }}>
                {data.user.role === "admin" && (
                  <a className="button" href="/admin">
                    {translate("Administração")}
                  </a>
                )}
                <a className="button" href="/publish">
                  <Upload size={16} />
                  {translate("Publicar DLIS")}
                </a>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      await api("auth/logout", { method: "POST" });
                      window.location.assign("/");
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : translate("AUTH_FAILED"),
                      );
                    }
                  }}
                >
                  <LogOut size={16} />
                  {translate("Sair da conta")}
                </button>
                <p className="status-label">
                  {translate("Cadastro e recuperação de acesso por e-mail.")}
                </p>
              </div>
            </aside>
            <section>
              <Tabs defaultValue="analyses">
                <TabsList className="account-tabs">
                  <TabsTrigger value="analyses">
                    <Bookmark size={15} />
                    {translate("Análises")}
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History size={15} />
                    {translate("Histórico")}
                  </TabsTrigger>
                  <TabsTrigger value="files">
                    <Upload size={15} />
                    {translate("Publicações")}
                  </TabsTrigger>
                  <TabsTrigger value="exports">
                    <Download size={15} />
                    {translate("Exportações")}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="analyses">
                  <div className="panel">
                    <h2>{translate("Análises salvas")}</h2>
                    {!data.analyses.length ? (
                      <p className="status-label">
                        {translate(
                          "Nenhuma análise salva. Abra um DLIS, fixe pontos e salve.",
                        )}
                      </p>
                    ) : (
                      data.analyses.map((a: any) => {
                        const h = data.history.find(
                          (h: any) => h.hash === a.hash,
                        );
                        return (
                          <div className="account-item" key={a.id}>
                            <div>
                              <b>{a.name}</b>
                              <p>{a.file_name}</p>
                              <small>
                                {new Date(a.updated_at).toLocaleString(locale)}
                              </small>
                            </div>
                            {h?.file_id ? (
                              <a
                                className="button compact"
                                href={"/viewer?file=" + h.file_id}
                              >
                                {translate("Reabrir")}
                                <ArrowUpRight size={14} />
                              </a>
                            ) : (
                              <span className="status-label">
                                {translate(
                                  "Abra o mesmo arquivo local no visualizador para recuperar os pontos.",
                                )}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="history">
                  <div className="panel">
                    <h2>{translate("Arquivos acessados")}</h2>
                    {!data.history.length ? (
                      <p className="status-label">
                        {translate("Nenhum arquivo acessado.")}
                      </p>
                    ) : (
                      data.history.map((h: any) => (
                        <div className="account-item" key={h.id}>
                          <div>
                            <b>{h.file_name}</b>
                            <p>
                              {new Date(h.accessed_at).toLocaleString(locale)}
                            </p>
                            <small className="hash">{h.hash}</small>
                          </div>
                          {h.file_id && (
                            <a
                              className="button compact"
                              href={"/viewer?file=" + h.file_id}
                            >
                              {translate("Reabrir")}
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="files">
                  <div className="panel">
                    <h2>{translate("Minhas publicações")}</h2>
                    {!data.files.length ? (
                      <p className="status-label">
                        {translate("Nenhum arquivo enviado.")}
                      </p>
                    ) : (
                      data.files.map((f: any) => (
                        <div className="account-item" key={f.id}>
                          <div>
                            <b>{f.well || f.original_name}</b>
                            <p>
                              {f.collection} · {f.original_name}
                            </p>
                            <span className="badge">
                              {
                                (
                                  {
                                    pending: translate("Pendente"),
                                    review: translate("Revisão necessária"),
                                    validated: translate("Validado"),
                                    archived: translate("Arquivado"),
                                  } as any
                                )[f.status]
                              }
                            </span>
                            {f.review_note && <p>{f.review_note}</p>}
                          </div>
                          <a
                            className="button compact"
                            href={"/viewer?file=" + f.id}
                          >
                            {translate("Visualizar")}
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="exports">
                  <div className="panel">
                    <h2>{translate("Registro de exportações")}</h2>
                    {!data.exports.length ? (
                      <p className="status-label">
                        {translate("Nenhuma exportação registrada.")}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{translate("Data")}</TableHead>
                            <TableHead>{translate("Formato")}</TableHead>
                            <TableHead>{translate("Pontos")}</TableHead>
                            <TableHead>SHA-256</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.exports.map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell>
                                {new Date(e.created_at).toLocaleString(locale)}
                              </TableCell>
                              <TableCell>{e.format.toUpperCase()}</TableCell>
                              <TableCell>{e.count}</TableCell>
                              <TableCell className="hash">
                                {e.hash.slice(0, 16)}…
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </section>
          </div>
        )
      )}
    </div>
  );
}
