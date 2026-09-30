"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Database,
  FolderOpen,
  Layers3,
  ArrowUpRight,
  Upload,
  ShieldCheck,
  FileSearch,
  ArrowRight,
  Grid2X2,
  List,
  RefreshCw,
} from "lucide-react";
import { api, formatBytes } from "@/lib/api";
import { Pick } from "./controls";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
export function Library() {
  const { translate, message, locale } = useI18n();
  const [files, setFiles] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [source, setSource] = useState(""),
    [location, setLocation] = useState(""),
    [type, setType] = useState(""),
    [view, setView] = useState("grid");
  const load = () => {
    setLoading(true);
    setError("");
    api("files")
      .then((d) => setFiles(d.files))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const sources = [...new Set(files.map((f) => f.collection))].sort();
  const filtered = files.filter(
    (f) =>
      (!q ||
        [f.well, f.company, f.field, f.run, f.original_name, f.collection]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (!source || f.collection === source) &&
      (!location || f.location === location) &&
      (!type || f.types.includes(type)),
  );
  const clear = () => {
    setQ("");
    setSource("");
    setLocation("");
    setType("");
  };
  return (
    <div className="library-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{translate("EXPLORAR DADOS")}</div>
          <h1>
            {translate("Biblioteca pública")}
            <span className="title-period">.</span>
          </h1>
          <p>
            {translate(
              "Perfis de poços, organizados por fonte. Dados reais, do arquivo à análise.",
            )}
          </p>
        </div>
        <a className="button primary" href="/publish">
          <Upload size={17} />
          {translate("Publicar arquivo")}
        </a>
      </div>
      <div className="stats-strip">
        <div>
          <Database />
          <strong>{files.length.toString().padStart(2, "0")}</strong>
          <span>{translate("Arquivos publicados")}</span>
        </div>
        <div>
          <FolderOpen />
          <strong>{sources.length.toString().padStart(2, "0")}</strong>
          <span>{translate("Coleções disponíveis")}</span>
        </div>
        <div>
          <Layers3 />
          <strong>
            {new Set(files.map((f) => f.well).filter(Boolean)).size
              .toString()
              .padStart(2, "0")}
          </strong>
          <span>{translate("Poços na biblioteca")}</span>
        </div>
        <div className="stats-note">
          <ShieldCheck />
          <span>
            {translate("Apenas arquivos revisados")}
            <br />
            <b>{translate("e aprovados para publicação")}</b>
          </span>
        </div>
      </div>
      <div className="catalog-layout">
        <aside className="filter-panel">
          <div className="filter-heading">
            <span>
              <SlidersHorizontal size={16} />
              {translate("Filtros")}
            </span>
            <button onClick={clear}>{translate("Limpar")}</button>
          </div>
          <label className="field-label">{translate("EMPRESA / FONTE")}</label>
          <Pick
            label={translate("Empresa ou fonte")}
            value={source}
            onChange={setSource}
            options={[
              { value: "", label: translate("Todas as fontes") },
              ...sources.map((v) => ({ value: v, label: v })),
            ]}
          />
          <label className="field-label">{translate("AMBIENTE")}</label>
          <Pick
            label={translate("Ambiente")}
            value={location}
            onChange={setLocation}
            options={[
              { value: "", label: translate("Todos os ambientes") },
              { value: "onshore", label: translate("Terrestre / Onshore") },
              { value: "offshore", label: translate("Marítimo / Offshore") },
              { value: "unknown", label: translate("Não informado") },
            ]}
          />
          <label className="field-label">{translate("TIPO DE PERFIL")}</label>
          <div className="type-filters">
            {["", "CBL", "VDL", "USIT", "GR"].map((t) => (
              <button
                key={t}
                className={type === t ? "chosen" : ""}
                onClick={() => setType(t)}
              >
                {t || translate("Todos")}
                <span>
                  {files.filter((f) => !t || f.types.includes(t)).length}
                </span>
              </button>
            ))}
          </div>
          <div className="filter-note">
            <FileSearch size={21} />
            <b>{translate("Da fonte à amostra")}</b>
            <p>
              {translate(
                "Cada leitura mantém a referência ao arquivo, frame, canal e índice original.",
              )}
            </p>
            <a href="/help">
              {translate("Entenda a rastreabilidade")}
              <ArrowUpRight size={14} />
            </a>
          </div>
        </aside>
        <section className="catalog">
          <div className="catalog-toolbar">
            <div className="searchbox">
              <Search size={19} />
              <input
                aria-label={translate("Buscar arquivos")}
                placeholder={translate(
                  "Busque por poço, campo, empresa ou arquivo...",
                )}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="view-buttons">
              <button
                aria-label={translate("Exibir em cards")}
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <Grid2X2 size={18} />
              </button>
              <button
                aria-label={translate("Exibir em lista")}
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={19} />
              </button>
            </div>
          </div>
          <div className="results-heading">
            <h2>{source || translate("Todas as coleções")}</h2>
            <span>
              {filtered.length}
              {translate("arquivo")}
            </span>
          </div>
          {loading ? (
            <div className="loading-panels">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : error ? (
            <div className="notice error">
              <b>{translate("Biblioteca indisponível")}</b>
              <p>{message(error)}</p>
              <button className="button" onClick={load}>
                <RefreshCw size={16} />
                {translate("Tentar novamente")}
              </button>
            </div>
          ) : !filtered.length ? (
            <Empty className="catalog-empty">
              <EmptyHeader>
                <div className="empty-symbol">
                  <FolderOpen size={34} />
                </div>
                <div className="eyebrow">
                  {files.length
                    ? translate("NENHUM RESULTADO")
                    : translate("SUA PRÓXIMA ANÁLISE COMEÇA AQUI")}
                </div>
                <EmptyTitle className="empty-title">
                  {files.length
                    ? translate("Nenhum arquivo com esses filtros.")
                    : translate("Nenhum arquivo publicado.")}
                </EmptyTitle>
                <EmptyDescription>
                  {files.length
                    ? translate(
                        "Experimente buscar outro poço ou limpar os filtros.",
                      )
                    : translate(
                        "Os arquivos aprovados aparecerão aqui, organizados por empresa ou fonte de dados.",
                      )}
                </EmptyDescription>
              </EmptyHeader>
              {files.length ? (
                <button className="button" onClick={clear}>
                  {translate("Limpar filtros")}
                </button>
              ) : (
                <a className="button primary" href="/publish">
                  <Upload size={16} />
                  {translate("Publicar o primeiro DLIS")}
                </a>
              )}
              <div className="empty-bottom">
                <ShieldCheck size={15} />
                {translate("Publicação sujeita a validação e autorização.")}
              </div>
            </Empty>
          ) : (
            sources
              .filter((s) => filtered.some((f) => f.collection === s))
              .map((s) => (
                <section className="collection" key={s}>
                  <div className="collection-heading">
                    <FolderOpen size={19} />
                    <h3>{s}</h3>
                    <span>
                      {filtered.filter((f) => f.collection === s).length}
                    </span>
                  </div>
                  <div className={"files-grid " + view}>
                    {filtered
                      .filter((f) => f.collection === s)
                      .map((f) => (
                        <article className="file-card" key={f.id}>
                          <div className="file-card-top">
                            <span className="file-kind">DLIS</span>
                            <span className="badge valid">
                              <ShieldCheck size={12} />
                              {translate("Validado")}
                            </span>
                          </div>
                          <h3>{f.well || translate("Poço não informado")}</h3>
                          <p>
                            {f.field || translate("Campo não informado")} ·{" "}
                            {f.run || translate("Run não informado")}
                          </p>
                          <div className="channel-tags">
                            {f.types.map((t: string) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <dl>
                            <div>
                              <dt>{translate("Profundidade")}</dt>
                              <dd>
                                {f.depth_label || translate("Não disponível")}
                              </dd>
                            </div>
                            <div>
                              <dt>{translate("Arquivo")}</dt>
                              <dd>{formatBytes(f.size, locale)}</dd>
                            </div>
                          </dl>
                          <div className="card-publisher">
                            {new Date(f.published_at).toLocaleDateString(
                              locale,
                            )}{" "}
                            · {f.publisher}
                          </div>
                          <a
                            className="file-open"
                            href={"/viewer?file=" + f.id}
                          >
                            {translate("Visualizar DLIS")}
                            <ArrowUpRight size={18} />
                          </a>
                        </article>
                      ))}
                  </div>
                </section>
              ))
          )}
          <div className="catalog-tip">
            <div>
              <Layers3 size={24} />
              <span>
                <b>{translate("Já tem um arquivo DLIS?")}</b>
                <br />
                {translate(
                  "Abra um arquivo local para analisar sem publicá-lo.",
                )}
              </span>
            </div>
            <a href="/viewer">
              {translate("Abrir no visualizador")}
              <ArrowRight size={17} />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
