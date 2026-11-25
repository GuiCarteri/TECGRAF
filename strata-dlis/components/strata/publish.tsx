"use client";
import { useHydrated } from "./use-hydrated";
import { useI18n } from "@/lib/i18n/provider";
import { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileCheck2,
  Check,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { UserProfile } from "@/lib/api-types";
import type { InspectedDlis, OriginMetadata } from "@/lib/dlis/types";
import { api, post, formatBytes } from "@/lib/api";
import { DlisClient } from "@/lib/dlis/client";
import {
  companyMatches,
  catalogDepthLabel,
  isDlisName,
  mayPublish,
} from "@/lib/dlis/core.js";
import { Thumbnail } from "./thumbnail";
import { Pick } from "./controls";
export function Publication({ initialUser: user }: { initialUser: UserProfile }) {
  const hydrated = useHydrated();
  const { translate, message, locale, number } = useI18n();
  const [file, setFile] = useState<File | null>(null),
    [meta, setMeta] = useState<InspectedDlis | null>(null),
    [queue, setQueue] = useState<File[]>([]),
    [reports, setReports] = useState<{ name: string; reason: string }[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [progress, setProgress] = useState(0),
    [stage, setStage] = useState(1),
    [confirmed, setConfirmed] = useState(false),
    [authorized, setAuthorized] = useState(false),
    [result, setResult] = useState<{ id: string; status: string } | null>(null),
    [form, setForm] = useState({
      well: "",
      field: "",
      company: "",
      collection: "",
      run: "",
      location: "unknown",
      visibility: "public",
      depthLabel: "",
    });
  const parser = useRef<DlisClient | null>(null),
    input = useRef<HTMLInputElement>(null),
    stop = useRef(false),
    staged = useRef<{
      id: string;
      parts: { etag: string; partNumber: number }[];
    } | null>(null);
  useEffect(() => {
    stop.current = false;
    return () => {
      stop.current = true;
      parser.current?.destroy();
    };
  }, []);
  const update = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setConfirmed(false);
  };
  async function read(f?: File) {
    if (!f) return;
    if (staged.current) {
      void api("uploads/" + staged.current.id, { method: "DELETE" }).catch(
        () => {},
      );
      staged.current = null;
    }
    setFile(f);
    setProgress(0);
    setError("");
    setResult(null);
    setStage(1);
    setMeta(null);
    setConfirmed(false);
    setAuthorized(false);
    if (!isDlisName(f.name)) {
      fileError(f, "Selecione um arquivo .DLIS.");
      return;
    }
    if (f.size > 512 * 1024 * 1024) {
      fileError(f, "O limite de envio é 512 MB por arquivo.");
      return;
    }
    setBusy("Lendo metadados e validando os frames…");
    parser.current?.destroy();
    parser.current = new DlisClient((phase, percent) => {
      setBusy(phase);
      setProgress(percent ?? 0);
    });
    try {
      const m = await parser.current.inspect(f);
      const origins = m.logicalFiles.flatMap((l) =>
        l.origins?.length ? l.origins : l.origin ? [l.origin] : [],
      );
      const unique = (k: keyof OriginMetadata) => {
        const v = [
          ...new Set(
            origins
              .map((o) => o[k])
              .filter((v) => v !== null && v !== "" && v !== undefined),
          ),
        ];
        return v.length === 1 ? String(v[0]) : "";
      };
      setForm({
        well: unique("wellName"),
        field: unique("fieldName"),
        company: unique("company"),
        collection: unique("fileSetName"),
        run: unique("runNumber"),
        location: "unknown",
        visibility: "public",
        depthLabel: catalogDepthLabel(m.validation),
      });
      setMeta(m);
      setStage(2);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      fileError(f, reason);
    } finally {
      parser.current?.destroy();
      parser.current = null;
      setBusy("");
    }
  }
  function fileError(f: File, reason: string) {
    setError(reason);
    setReports((prev) => [...prev, { name: f.name, reason }]);
  }
  function selectFiles(list: FileList | null) {
    if (!list?.length) return;
    const [first, ...rest] = Array.from(list);
    setQueue(rest);
    setReports([]);
    void read(first);
  }
  function nextFile() {
    const [first, ...rest] = queue;
    setQueue(rest);
    void read(first);
  }
  async function submit() {
    if (!file || !meta || !confirmed || !authorized) return;
    setBusy("Enviando arquivo…");
    setError("");
    setProgress(0);
    let uploadId = staged.current?.id || "";
    try {
      const parts = staged.current?.parts || [];
      if (!staged.current) {
        const d = await post<{ id: string }>("uploads", {
          name: file.name,
          size: file.size,
          hash: meta.hash,
        });
        uploadId = d.id;
        const size = 8 * 1024 * 1024;
        for (let offset = 0, n = 1; offset < file.size; offset += size, n++) {
          if (stop.current) throw new Error(translate("Envio interrompido."));
          const part = await api<{ etag: string; partNumber: number }>(
            "uploads/" + uploadId + "/part?n=" + n,
            {
              method: "PUT",
              body: file.slice(offset, offset + size),
            },
          );
          parts.push(part);
          setProgress(
            Math.round((Math.min(offset + size, file.size) / file.size) * 95),
          );
        }
        staged.current = { id: uploadId, parts };
      }
      setBusy("Conferindo integridade e registrando publicação…");
      const r = await post<{ id: string; status: string }>(
        "uploads/" + uploadId + "/complete",
        {
          ...form,
          metadata: meta,
          authorized,
          confirmed,
          parts,
        },
      );
      staged.current = null;
      setProgress(100);
      setResult(r);
      setStage(4);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      fileError(file, reason);
      if (uploadId && !staged.current)
        api("uploads/" + uploadId, { method: "DELETE" }).catch(() => {});
    } finally {
      setBusy("");
    }
  }
  if (!mayPublish(user.role))
    return (
      <div className="standard-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">{translate("CONTRIBUIR COM DADOS")}</div>
            <h1>{translate("Publicar DLIS")}</h1>
          </div>
        </div>
        <div className="panel prose">
          <ShieldCheck size={32} />
          <h2>{translate("Acesso de publicador necessário")}</h2>
          <p>
            {translate(
              "Sua conta pode visualizar arquivos e salvar análises. Um administrador deve atribuir o papel de publicador para habilitar envios.",
            )}
          </p>
          <a className="button" href="/account" style={{ marginTop: 20 }}>
            {translate("Ver minha conta")}
          </a>
        </div>
      </div>
    );
  const detected =
      meta?.logicalFiles
        .map((lf) => lf.origin?.company)
        .filter((company): company is string => Boolean(company)) || [],
    matches =
      detected.length > 0 &&
      detected.every((c: string) => companyMatches(c, form.company));
  return (
    <div className="standard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{translate("CONTRIBUIR COM DADOS")}</div>
          <h1>
            {translate("Publicar DLIS")}
            <span className="title-period">.</span>
          </h1>
          <p>
            {translate(
              "Confirme a origem. Revise o conteúdo. Compartilhe com autorização.",
            )}
          </p>
        </div>
        <span className="badge">
          <ShieldCheck size={14} />
          {translate("Revisão antes da publicação")}
        </span>
      </div>
      <div className="step-line">
        {[
          translate("Arquivo"),
          translate("Metadados"),
          translate("Revisão"),
          translate("Enviado"),
        ].map((s, i) => (
          <span key={s} className={stage === i + 1 ? "current" : ""}>
            <b>{stage > i + 1 ? <Check size={12} /> : i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {message(error)}
        </div>
      )}
      {reports.length > 0 && (
        <details open className="notice">
          <summary>{translate("Relatório por arquivo")}</summary>
          <ul>
            {reports.map((r, i) => (
              <li key={i}>
                {r.name} · {message(r.reason)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {queue.length > 0 && !busy && (
        <button className="button" onClick={nextFile}>
          {translate("Próximo arquivo")} · {queue[0].name} ({queue.length})
        </button>
      )}
      {busy && (
        <div className="notice" role="status">
          {message(busy)}
          {progress > 0 && <Progress value={progress} className="mt-3" />}
        </div>
      )}
      {result ? (
        <div className="panel stack">
          <FileCheck2 size={40} color="var(--primary)" />
          <h2>{translate("Arquivo recebido para revisão.")}</h2>
          <p>
            {translate(
              "Ele ainda não aparece na biblioteca pública. Um administrador conferirá os metadados e a autorização.",
            )}
          </p>
          <div className="row">
            <span className="badge warning">
              {result.status === "review"
                ? translate("Revisão necessária")
                : translate("Pendente")}
            </span>
            <a className="button primary" href={"/viewer?file=" + result.id}>
              {translate("Abrir arquivo")}
              <ArrowRight size={16} />
            </a>
            <a className="button" href="/account">
              {translate("Acompanhar na minha conta")}
            </a>
          </div>
        </div>
      ) : stage === 1 ? (
        <label
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (hydrated && !busy) selectFiles(e.dataTransfer.files);
          }}
        >
          <Upload size={35} />
          <strong>{hydrated ? translate("Selecione seu arquivo DLIS") : translate("Carregando…")}</strong>
          <p>
            {translate("RP66 V1 · até 512 MB · nenhuma publicação automática")}
          </p>
          <input
            disabled={!hydrated || !!busy}
            ref={input}
            type="file"
            accept=".dlis,.DLIS"
            multiple
            onChange={(e) => selectFiles(e.target.files)}
          />
        </label>
      ) : (
        <div className="stack">
          <div className="panel">
            <div className="row spaced">
              <h2>
                {stage === 2
                  ? translate("Confirme os metadados")
                  : translate("Prévia da publicação")}
              </h2>
              <span className="file-kind">
                {file && formatBytes(file.size, locale)}
              </span>
            </div>
            <p className="status-label">{file?.name}</p>
            {meta?.thumbnail && <Thumbnail trace={meta.thumbnail} />}
            {meta && (
              <p>
                {meta.logicalFiles
                  .flatMap((l) => l.tools || [])
                  .map((t) => t.name)
                  .join(" · ")}{" "}
                {meta.logicalFiles
                  .flatMap((l) => l.origins || [])
                  .map((o) => o.creationTime)
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <div className="notice">
              <b>{translate("Empresa encontrada no arquivo:")}</b>{" "}
              {[...new Set(detected)].join(" / ") || translate("Não informada")}
            </div>
            {!matches && (
              <div className="notice warning">
                <AlertTriangle size={17} />
                {translate(
                  "Os metadados do arquivo não correspondem à empresa selecionada, ou não informam a empresa. A divergência ficará registrada para revisão.",
                )}
              </div>
            )}
            {meta && meta.warnings.length > 0 && (
              <div className="notice warning">
                {meta.warnings.map((w: string, i: number) => (
                  <p key={i}>{message(w)}</p>
                ))}
              </div>
            )}
            <div className="form-grid">
              {(
                [
                  ["well", translate("Nome do poço")],
                  ["field", translate("Campo")],
                  ["company", translate("Empresa confirmada *")],
                  ["collection", translate("Coleção / fonte de dados *")],
                  ["run", "Run"],
                  [
                    "depthLabel",
                    translate("Profundidade disponível (extraída)"),
                  ],
                ] as const
              ).map(([k, label]) => (
                <label className="form-field" key={k}>
                  {label}
                  <input
                    disabled={stage === 3 || k === "depthLabel"}
                    value={form[k]}
                    onChange={(e) => update(k, e.target.value)}
                    placeholder={
                      k === "collection"
                        ? translate("Ex.: VOLVE ou ANP – TERRESTRE")
                        : translate("Não informado")
                    }
                  />
                  {k === "collection" && (
                    <small>
                      {translate(
                        "A fonte é confirmada por você. Empresa, prestador e coleção são campos diferentes.",
                      )}
                    </small>
                  )}
                </label>
              ))}
              <label className="form-field">
                {translate("Ambiente")}
                <Pick
                  label={translate("Ambiente do poço")}
                  value={form.location}
                  onChange={(v) => update("location", v)}
                  options={[
                    { value: "unknown", label: translate("Não informado") },
                    {
                      value: "onshore",
                      label: translate("Terrestre / Onshore"),
                    },
                    {
                      value: "offshore",
                      label: translate("Marítimo / Offshore"),
                    },
                  ]}
                />
              </label>
              <label className="form-field">
                {translate("Visibilidade desejada")}
                <Pick
                  label={translate("Visibilidade do arquivo")}
                  value={form.visibility}
                  onChange={(v) => update("visibility", v)}
                  options={[
                    {
                      value: "public",
                      label: translate("Público após aprovação"),
                    },
                    {
                      value: "unlisted",
                      label: translate("Não listado após aprovação"),
                    },
                    {
                      value: "private",
                      label: translate(
                        "Privado: somente autor e administradores",
                      ),
                    },
                  ]}
                />
              </label>
            </div>
            <div className="section-heading">
              <h3>{translate("Conteúdo do arquivo")}</h3>
              <span className="badge">
                {meta?.logicalFiles.length}
                {translate("Logical file(s)")}
              </span>
            </div>
            <Table className="technical-table">
              <TableHeader>
                <TableRow>
                  {[
                    "LF",
                    translate("Frame"),
                    translate("Canais"),
                    translate("Amostras"),
                    translate("Intervalo (m)"),
                    translate("Leitura"),
                  ].map((x) => (
                    <TableHead key={x}>{x}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta?.validation.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell>{v.lf + 1}</TableCell>
                    <TableCell>{v.frame}</TableCell>
                    <TableCell>
                      {
                        meta.logicalFiles[v.lf].frames.find(
                          (f) => f.key === v.frame,
                        )?.channels.length
                      }
                    </TableCell>
                    <TableCell>{v.samples ?? "—"}</TableCell>
                    <TableCell>
                      {v.depthRangeMeters
                        ?.map((n: number) =>
                          number(n, {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          }),
                        )
                        .join("–") || translate("Não disponível")}
                    </TableCell>
                    <TableCell>
                      {v.ok ? translate("Decodificado") : v.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div
              className="hash"
              style={{ marginTop: 20, color: "var(--muted-foreground)" }}
            >
              SHA-256 · {meta?.hash}
            </div>
          </div>
          <div className="panel stack">
            <label className="check-row">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
              />{" "}
              {translate(
                "Conferi o poço, a empresa e a coleção. Confirmo as informações acima.",
              )}
            </label>
            <label className="check-row">
              <Checkbox
                checked={authorized}
                onCheckedChange={(v) => setAuthorized(v === true)}
              />{" "}
              {translate(
                "Confirmo que possuo autorização para publicar este arquivo com a visibilidade selecionada.",
              )}
            </label>
            <div className="row spaced">
              <button
                className="button"
                disabled={!!busy}
                onClick={() => setStage(stage === 3 ? 2 : 1)}
              >
                {translate("Voltar")}
              </button>
              {stage === 2 ? (
                <button
                  className="button primary"
                  disabled={
                    !confirmed ||
                    !authorized ||
                    !form.company ||
                    !form.collection ||
                    !!busy
                  }
                  onClick={() => setStage(3)}
                >
                  {translate("Revisar publicação")}
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={!!busy || !confirmed || !authorized}
                  onClick={submit}
                >
                  <Upload size={16} />
                  {translate("Enviar para aprovação")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
