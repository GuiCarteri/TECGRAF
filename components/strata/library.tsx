"use client";
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
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    Promise.resolve(
      ctx.registerTool(
        {
          name: "filter_dlis_library",
          description: "Filtrar o catálogo público por busca e coleção.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              collection: { type: "string" },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: (input: any) => {
            if (
              (input.query !== undefined && typeof input.query !== "string") ||
              (input.collection !== undefined &&
                typeof input.collection !== "string")
            )
              throw new Error("Filtros inválidos");
            setQ(input.query || "");
            setSource(input.collection || "");
            return {
              query: input.query || "",
              collection: input.collection || "",
            };
          },
        },
        { signal: life.signal },
      ),
    ).catch(() => {});
    return () => life.abort();
  }, []);
  return (
    <div className="library-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EXPLORAR DADOS</div>
          <h1>
            Biblioteca pública<span className="title-period">.</span>
          </h1>
          <p>
            Perfis de poços, organizados por fonte. Dados reais, do arquivo à
            análise.
          </p>
        </div>
        <a className="button primary" href="/publish">
          <Upload size={17} /> Publicar arquivo
        </a>
      </div>
      <div className="stats-strip">
        <div>
          <Database />
          <strong>{files.length.toString().padStart(2, "0")}</strong>
          <span>Arquivos publicados</span>
        </div>
        <div>
          <FolderOpen />
          <strong>{sources.length.toString().padStart(2, "0")}</strong>
          <span>Coleções disponíveis</span>
        </div>
        <div>
          <Layers3 />
          <strong>
            {new Set(files.map((f) => f.well).filter(Boolean)).size
              .toString()
              .padStart(2, "0")}
          </strong>
          <span>Poços na biblioteca</span>
        </div>
        <div className="stats-note">
          <ShieldCheck />
          <span>
            Apenas arquivos revisados
            <br />
            <b>e aprovados para publicação</b>
          </span>
        </div>
      </div>
      <div className="catalog-layout">
        <aside className="filter-panel">
          <div className="filter-heading">
            <span>
              <SlidersHorizontal size={16} /> Filtros
            </span>
            <button onClick={clear}>Limpar</button>
          </div>
          <label className="field-label">EMPRESA / FONTE</label>
          <Pick
            label="Empresa ou fonte"
            value={source}
            onChange={setSource}
            options={[
              { value: "", label: "Todas as fontes" },
              ...sources.map((v) => ({ value: v, label: v })),
            ]}
          />
          <label className="field-label">AMBIENTE</label>
          <Pick
            label="Ambiente"
            value={location}
            onChange={setLocation}
            options={[
              { value: "", label: "Todos os ambientes" },
              { value: "onshore", label: "Terrestre / Onshore" },
              { value: "offshore", label: "Marítimo / Offshore" },
              { value: "unknown", label: "Não informado" },
            ]}
          />
          <label className="field-label">TIPO DE PERFIL</label>
          <div className="type-filters">
            {["", "CBL", "VDL", "USIT", "GR"].map((t) => (
              <button
                key={t}
                className={type === t ? "chosen" : ""}
                onClick={() => setType(t)}
              >
                {t || "Todos"}
                <span>
                  {files.filter((f) => !t || f.types.includes(t)).length}
                </span>
              </button>
            ))}
          </div>
          <div className="filter-note">
            <FileSearch size={21} />
            <b>Da fonte à amostra</b>
            <p>
              Cada leitura mantém a referência ao arquivo, frame, canal e índice
              original.
            </p>
            <a href="/help">
              Entenda a rastreabilidade <ArrowUpRight size={14} />
            </a>
          </div>
        </aside>
        <section className="catalog">
          <div className="catalog-toolbar">
            <div className="searchbox">
              <Search size={19} />
              <input
                aria-label="Buscar arquivos"
                placeholder="Busque por poço, campo, empresa ou arquivo..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="view-buttons">
              <button
                aria-label="Exibir em cards"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <Grid2X2 size={18} />
              </button>
              <button
                aria-label="Exibir em lista"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={19} />
              </button>
            </div>
          </div>
          <div className="results-heading">
            <h2>{source || "Todas as coleções"}</h2>
            <span>
              {filtered.length} arquivo{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
          {loading ? (
            <div className="loading-panels">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : error ? (
            <div className="notice error">
              <b>Biblioteca indisponível</b>
              <p>{error}</p>
              <button className="button" onClick={load}>
                <RefreshCw size={16} /> Tentar novamente
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
                    ? "NENHUM RESULTADO"
                    : "SUA PRÓXIMA ANÁLISE COMEÇA AQUI"}
                </div>
                <EmptyTitle className="empty-title">
                  {files.length
                    ? "Nenhum arquivo com esses filtros."
                    : "Nenhum arquivo publicado."}
                </EmptyTitle>
                <EmptyDescription>
                  {files.length
                    ? "Experimente buscar outro poço ou limpar os filtros."
                    : "Os arquivos aprovados aparecerão aqui, organizados por empresa ou fonte de dados."}
                </EmptyDescription>
              </EmptyHeader>
              {files.length ? (
                <button className="button" onClick={clear}>
                  Limpar filtros
                </button>
              ) : (
                <a className="button primary" href="/publish">
                  <Upload size={16} /> Publicar o primeiro DLIS
                </a>
              )}
              <div className="empty-bottom">
                <ShieldCheck size={15} /> Publicação sujeita a validação e
                autorização.
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
                              <ShieldCheck size={12} /> Validado
                            </span>
                          </div>
                          <h3>{f.well || "Poço não informado"}</h3>
                          <p>
                            {f.field || "Campo não informado"} ·{" "}
                            {f.run || "Run não informado"}
                          </p>
                          <div className="channel-tags">
                            {f.types.map((t: string) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <dl>
                            <div>
                              <dt>Profundidade</dt>
                              <dd>{f.depth_label || "Não disponível"}</dd>
                            </div>
                            <div>
                              <dt>Arquivo</dt>
                              <dd>{formatBytes(f.size)}</dd>
                            </div>
                          </dl>
                          <div className="card-publisher">
                            {new Date(f.published_at).toLocaleDateString(
                              "pt-BR",
                            )}{" "}
                            · {f.publisher}
                          </div>
                          <a
                            className="file-open"
                            href={"/viewer?file=" + f.id}
                          >
                            Visualizar DLIS <ArrowUpRight size={18} />
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
                <b>Já tem um arquivo DLIS?</b>
                <br />
                Abra um arquivo local para analisar sem publicá-lo.
              </span>
            </div>
            <a href="/viewer">
              Abrir no visualizador <ArrowRight size={17} />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
