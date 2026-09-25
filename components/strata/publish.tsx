"use client";
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
import { api, post, formatBytes } from "@/lib/api";
import { DlisClient } from "@/lib/dlis/client";
import {
  companyMatches,
  isDlisName,
  mayPublish,
  detectChannel,
  metersFactor,
  numericRange,
} from "@/lib/dlis/core.js";
import { Pick } from "./controls";
export function Publication() {
  const [user, setUser] = useState<any>(null),
    [accountLoaded, setAccountLoaded] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [meta, setMeta] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [progress, setProgress] = useState(0),
    [stage, setStage] = useState(1),
    [confirmed, setConfirmed] = useState(false),
    [authorized, setAuthorized] = useState(false),
    [result, setResult] = useState<any>(null),
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
    stop = useRef(false);
  useEffect(() => {
    api("me")
      .then((d) => setUser(d.user))
      .catch((e) => setError(e.message))
      .finally(() => setAccountLoaded(true));
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
    setError("");
    setResult(null);
    setStage(1);
    setMeta(null);
    setConfirmed(false);
    setAuthorized(false);
    if (!isDlisName(f.name)) {
      setError("Selecione um arquivo .DLIS.");
      return;
    }
    if (f.size > 512 * 1024 * 1024) {
      setError("O limite de envio é 512 MB por arquivo.");
      return;
    }
    setFile(f);
    setBusy("Lendo metadados e validando os frames…");
    parser.current?.destroy();
    parser.current = new DlisClient();
    try {
      const m = await parser.current.parse(f),
        ranges: number[][] = [];
      m.validation = [];
      for (const lf of m.logicalFiles) {
        for (const frame of lf.frames) {
          try {
            const r = await parser.current.decode(lf.index, frame.key);
            const ds = frame.channels.filter(
              (c: any) => detectChannel(c, r.strides[c.name]) === "DEPTH",
            );
            let range = null;
            if (ds.length === 1) {
              const raw = numericRange(r.data[ds[0].name]);
              const factor = metersFactor(ds[0].units);
              if (raw && factor !== null) {
                range = raw.map((v: number) => v * factor);
                ranges.push(range);
              }
            }
            m.validation.push({
              lf: lf.index,
              frame: frame.key,
              samples: r.frameCount,
              depthRangeMeters: range,
              ok: true,
            });
          } catch (e: any) {
            m.validation.push({
              lf: lf.index,
              frame: frame.key,
              ok: false,
              error: e.message,
            });
            m.warnings.push(frame.name + ": " + e.message);
          }
        }
      }
      const origins = m.logicalFiles.map((l: any) => l.origin).filter(Boolean),
        origin = origins[0] || {};
      const unique = (k: string) => {
        const v = [
          ...new Set(
            origins
              .map((o: any) => o[k])
              .filter((v: any) => v !== null && v !== "" && v !== undefined),
          ),
        ];
        return v.length === 1 ? String(v[0]) : "";
      };
      const label = ranges.length
        ? `${Math.min(...ranges.map((r) => r[0])).toFixed(3)}–${Math.max(...ranges.map((r) => r[1])).toFixed(3)} m`
        : "";
      setForm({
        well: unique("wellName"),
        field: unique("fieldName"),
        company: unique("company"),
        collection: "",
        run: unique("runNumber"),
        location: "unknown",
        visibility: "public",
        depthLabel: label,
      });
      setMeta(m);
      setStage(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function submit() {
    if (!file || !meta || !confirmed || !authorized) return;
    setBusy("Enviando arquivo…");
    setError("");
    setProgress(0);
    let uploadId = "";
    try {
      const d = await post("uploads", {
        name: file.name,
        size: file.size,
        hash: meta.hash,
      });
      uploadId = d.id;
      const parts = [];
      const size = 8 * 1024 * 1024;
      for (let offset = 0, n = 1; offset < file.size; offset += size, n++) {
        if (stop.current) throw new Error("Envio interrompido.");
        const part = await api("uploads/" + uploadId + "/part?n=" + n, {
          method: "PUT",
          body: file.slice(offset, offset + size),
        });
        parts.push(part);
        setProgress(
          Math.round((Math.min(offset + size, file.size) / file.size) * 95),
        );
      }
      setBusy("Conferindo integridade e registrando publicação…");
      const r = await post("uploads/" + uploadId + "/complete", {
        ...form,
        metadata: meta,
        authorized,
        confirmed,
        parts,
      });
      setProgress(100);
      setResult(r);
      setStage(4);
    } catch (e: any) {
      setError(e.message);
      if (uploadId)
        api("uploads/" + uploadId, { method: "DELETE" }).catch(() => {});
    } finally {
      setBusy("");
    }
  }
  if (accountLoaded && !mayPublish(user?.role))
    return (
      <div className="standard-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">CONTRIBUIR COM DADOS</div>
            <h1>Publicar DLIS</h1>
          </div>
        </div>
        <div className="panel prose">
          <ShieldCheck size={32} />
          <h2>Acesso de publicador necessário</h2>
          <p>
            Sua conta pode visualizar arquivos e salvar análises. Um
            administrador deve atribuir o papel de publicador para habilitar
            envios.
          </p>
          <a className="button" href="/account" style={{ marginTop: 20 }}>
            Ver minha conta
          </a>
        </div>
      </div>
    );
  const detected =
      meta?.logicalFiles.map((lf: any) => lf.origin?.company).filter(Boolean) ||
      [],
    matches =
      detected.length > 0 &&
      detected.every((c: string) => companyMatches(c, form.company));
  return (
    <div className="standard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CONTRIBUIR COM DADOS</div>
          <h1>
            Publicar DLIS<span className="title-period">.</span>
          </h1>
          <p>
            Confirme a origem. Revise o conteúdo. Compartilhe com autorização.
          </p>
        </div>
        <span className="badge">
          <ShieldCheck size={14} /> Revisão antes da publicação
        </span>
      </div>
      <div className="step-line">
        {["Arquivo", "Metadados", "Revisão", "Enviado"].map((s, i) => (
          <span key={s} className={stage === i + 1 ? "current" : ""}>
            <b>{stage > i + 1 ? <Check size={12} /> : i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <div className="notice" role="status">
          {busy}
          {progress > 0 && <Progress value={progress} className="mt-3" />}
        </div>
      )}
      {result ? (
        <div className="panel stack">
          <FileCheck2 size={40} color="#237a74" />
          <h2>Arquivo recebido para revisão.</h2>
          <p>
            Ele ainda não aparece na biblioteca pública. Um administrador
            conferirá os metadados e a autorização.
          </p>
          <div className="row">
            <span className="badge warning">
              {result.status === "review" ? "Revisão necessária" : "Pendente"}
            </span>
            <a className="button primary" href={"/viewer?file=" + result.id}>
              Abrir arquivo <ArrowRight size={16} />
            </a>
            <a className="button" href="/account">
              Acompanhar na minha conta
            </a>
          </div>
        </div>
      ) : stage === 1 ? (
        <label
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) read(e.dataTransfer.files[0]);
          }}
        >
          <Upload size={35} />
          <strong>Selecione seu arquivo DLIS</strong>
          <p>RP66 V1 · até 512 MB · nenhuma publicação automática</p>
          <input
            disabled={!!busy || !accountLoaded}
            ref={input}
            type="file"
            accept=".dlis,.DLIS"
            onChange={(e) => read(e.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="stack">
          <div className="panel">
            <div className="row spaced">
              <h2>
                {stage === 2 ? "Confirme os metadados" : "Prévia da publicação"}
              </h2>
              <span className="file-kind">
                {file && formatBytes(file.size)}
              </span>
            </div>
            <p className="status-label">{file?.name}</p>
            <div className="notice">
              <b>Empresa encontrada no arquivo:</b>{" "}
              {[...new Set(detected)].join(" / ") || "Não informada"}
            </div>
            {!matches && (
              <div className="notice warning">
                <AlertTriangle size={17} /> Os metadados do arquivo não
                correspondem à empresa selecionada, ou não informam a empresa. A
                divergência ficará registrada para revisão.
              </div>
            )}
            {meta?.warnings.length > 0 && (
              <div className="notice warning">
                {meta.warnings.map((w: string, i: number) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
            <div className="form-grid">
              {[
                ["well", "Nome do poço"],
                ["field", "Campo"],
                ["company", "Empresa confirmada *"],
                ["collection", "Coleção / fonte de dados *"],
                ["run", "Run"],
                ["depthLabel", "Profundidade disponível (extraída)"],
              ].map(([k, label]) => (
                <label className="form-field" key={k}>
                  {label}
                  <input
                    disabled={stage === 3 || k === "depthLabel"}
                    value={(form as any)[k]}
                    onChange={(e) => update(k, e.target.value)}
                    placeholder={
                      k === "collection"
                        ? "Ex.: VOLVE ou ANP – TERRESTRE"
                        : "Não informado"
                    }
                  />
                  {k === "collection" && (
                    <small>
                      A fonte é confirmada por você. Empresa, prestador e
                      coleção são campos diferentes.
                    </small>
                  )}
                </label>
              ))}
              <label className="form-field">
                Ambiente
                <Pick
                  label="Ambiente do poço"
                  value={form.location}
                  onChange={(v) => update("location", v)}
                  options={[
                    { value: "unknown", label: "Não informado" },
                    { value: "onshore", label: "Terrestre / Onshore" },
                    { value: "offshore", label: "Marítimo / Offshore" },
                  ]}
                />
              </label>
              <label className="form-field">
                Visibilidade desejada
                <Pick
                  label="Visibilidade do arquivo"
                  value={form.visibility}
                  onChange={(v) => update("visibility", v)}
                  options={[
                    { value: "public", label: "Público após aprovação" },
                    { value: "unlisted", label: "Não listado após aprovação" },
                    {
                      value: "private",
                      label: "Privado: somente autor e administradores",
                    },
                  ]}
                />
              </label>
            </div>
            <div className="section-heading">
              <h3>Conteúdo do arquivo</h3>
              <span className="badge">
                {meta?.logicalFiles.length} Logical file(s)
              </span>
            </div>
            <Table className="technical-table">
              <TableHeader>
                <TableRow>
                  {[
                    "LF",
                    "Frame",
                    "Canais",
                    "Amostras",
                    "Intervalo (m)",
                    "Leitura",
                  ].map((x) => (
                    <TableHead key={x}>{x}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta?.validation.map((v: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{v.lf + 1}</TableCell>
                    <TableCell>{v.frame}</TableCell>
                    <TableCell>
                      {
                        meta.logicalFiles[v.lf].frames.find(
                          (f: any) => f.key === v.frame,
                        )?.channels.length
                      }
                    </TableCell>
                    <TableCell>{v.samples ?? "—"}</TableCell>
                    <TableCell>
                      {v.depthRangeMeters
                        ?.map((n: number) => n.toFixed(3))
                        .join("–") || "Não disponível"}
                    </TableCell>
                    <TableCell>{v.ok ? "Decodificado" : v.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="hash" style={{ marginTop: 20, color: "#78909f" }}>
              SHA-256 · {meta?.hash}
            </div>
          </div>
          <div className="panel stack">
            <label className="check-row">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
              />{" "}
              Conferi o poço, a empresa e a coleção. Confirmo as informações
              acima.
            </label>
            <label className="check-row">
              <Checkbox
                checked={authorized}
                onCheckedChange={(v) => setAuthorized(v === true)}
              />{" "}
              Confirmo que possuo autorização para publicar este arquivo com a
              visibilidade selecionada.
            </label>
            <div className="row spaced">
              <button
                className="button"
                disabled={!!busy}
                onClick={() => setStage(stage === 3 ? 2 : 1)}
              >
                Voltar
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
                  Revisar publicação <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="button primary"
                  disabled={!!busy || !confirmed || !authorized}
                  onClick={submit}
                >
                  <Upload size={16} /> Enviar para aprovação
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
