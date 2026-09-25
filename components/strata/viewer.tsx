"use client";
import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileSearch,
  RotateCcw,
  Plus,
  Minus,
  Save,
  Download,
  Pin,
  SlidersHorizontal,
  ArrowLeft,
  X,
  Info,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
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
  detectChannel,
  isDlisName,
  numericRange,
  metersFactor,
} from "@/lib/dlis/core.js";
import { makeTrack, type Track } from "@/lib/dlis/plotting";
import { pointFromTrack } from "@/lib/dlis/points";
import { exportPoints } from "@/lib/dlis/export";
import { Pick } from "./controls";
import { TrackCanvas } from "./track-canvas";
import { PointsTable } from "./points-table";
const kinds = ["GR", "CBL", "VDL", "USIT"];
const scalarKinds = ["GR", "CBL"];
const none = { value: "", label: "Nenhum canal selecionado" };
export function Viewer({ file: remoteId }: { file?: string }) {
  const [file, setFile] = useState<File | null>(null),
    [meta, setMeta] = useState<any>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [choices, setChoices] = useState<Record<string, string>>({}),
    [tracks, setTracks] = useState<Record<string, Track>>({}),
    [from, setFrom] = useState(0),
    [to, setTo] = useState(1),
    [full, setFull] = useState([0, 1]),
    [point, setPoint] = useState<any>(null),
    [points, setPoints] = useState<any[]>([]),
    [agc, setAgc] = useState(true),
    [metadataOpen, setMetadataOpen] = useState(false),
    [mappingOpen, setMappingOpen] = useState(false),
    [calibrationOpen, setCalibrationOpen] = useState(false),
    [calibration, setCalibration] = useState<any>({
      reference: "",
      goodMax: "",
      badMin: "",
      source: "Informado pelo usuário",
    }),
    [analyses, setAnalyses] = useState<any[]>([]),
    [analysisId, setAnalysisId] = useState(""),
    [analysisName, setAnalysisName] = useState("Minha análise"),
    [dirty, setDirty] = useState(false),
    [savedAt, setSavedAt] = useState(""),
    [exportFormat, setExportFormat] = useState("csv"),
    [extra, setExtra] = useState<string[]>([]),
    [manualTrack, setManualTrack] = useState(""),
    [sample, setSample] = useState(0),
    [component, setComponent] = useState(0),
    [pendingFile, setPendingFile] = useState<File | null>(null),
    [remoteFile, setRemoteFile] = useState<any>(null);
  const parser = useRef<DlisClient | null>(null),
    cache = useRef(new Map<string, Promise<any>>()),
    generation = useRef(0),
    input = useRef<HTMLInputElement>(null),
    currentMeta = useRef<any>(null),
    selVersions = useRef<Record<string, number>>({});
  useEffect(() => () => parser.current?.destroy(), []);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  useEffect(() => {
    if (!remoteId) return;
    let stopped = false;
    setBusy("Carregando arquivo…");
    api("files/" + remoteId)
      .then(async (d) => {
        if (stopped) return;
        setRemoteFile(d.file);
        const r = await fetch("/api/files/" + remoteId + "/content");
        if (!r.ok) throw new Error("Não foi possível baixar o arquivo.");
        const blob = await r.blob();
        if (!stopped)
          await loadFile(new File([blob], d.file.original_name), remoteId);
      })
      .catch((e) => setError(e.message))
      .finally(() => setBusy(""));
    return () => {
      stopped = true;
    };
  }, [remoteId]);
  function options(m = meta) {
    if (!m) return [];
    return m.logicalFiles.flatMap((lf: any) =>
      lf.frames.flatMap((frame: any) =>
        frame.channels.map((channel: any) => ({
          value: lf.index + "|" + frame.key + "|" + channel.key,
          label: `LF ${lf.index + 1} · ${frame.name} · ${channel.name} [${channel.units || "s/u"}; ${channel.dimension.join("×")}]`,
          lf: lf.index,
          frame,
          channel,
        })),
      ),
    );
  }
  function depthNames(frame: any) {
    return frame.channels.filter(
      (c: any) =>
        c.dimension.reduce((a: number, b: number) => a * b, 1) === 1 &&
        metersFactor(c.units) !== null,
    );
  }
  async function setTrack(
    kind: string,
    id: string,
    m = meta,
    depthOverride?: string,
  ) {
    const n = (selVersions.current[kind] || 0) + 1;
    selVersions.current[kind] = n;
    setChoices((c) => ({ ...c, [kind]: id }));
    if (!id) {
      setTracks((t) => {
        const v = { ...t };
        delete v[kind];
        return v;
      });
      return;
    }
    const option = options(m).find((o: any) => o.value === id);
    if (!option) return;
    try {
      const key = option.lf + "|" + option.frame.key;
      if (!cache.current.has(key))
        cache.current.set(
          key,
          parser.current!.decode(option.lf, option.frame.key),
        );
      const result = await cache.current.get(key);
      if (selVersions.current[kind] !== n || currentMeta.current !== m) return;
      const depths = depthNames(option.frame);
      const detected = depths.filter(
        (d: any) => detectChannel(d, 1) === "DEPTH",
      );
      const depth =
        depthOverride || (detected.length === 1 ? detected[0].name : null);
      if (!depth)
        throw new Error(
          "Escolha manualmente o canal de profundidade em “Configurar tracks”.",
        );
      const tr = makeTrack(
        id,
        kind,
        option.lf,
        option.frame,
        option.channel,
        result,
        depth,
      );
      setTracks((t) => ({ ...t, [kind]: tr }));
    } catch (e: any) {
      setTracks((t) => {
        const v = { ...t };
        delete v[kind];
        return v;
      });
      toast.error(`${kind}: ${e.message}`);
    }
  }
  async function loadFile(f: File, fileId?: string) {
    if (!isDlisName(f.name)) {
      setError("Selecione um arquivo com extensão .DLIS.");
      return;
    }
    const g = ++generation.current;
    setBusy("Lendo estrutura e metadados do DLIS…");
    setError("");
    parser.current?.destroy();
    parser.current = new DlisClient();
    cache.current.clear();
    selVersions.current = {};
    setTracks({});
    setChoices({});
    setPoint(null);
    setPoints([]);
    setAnalyses([]);
    setAnalysisId("");
    setSavedAt("");
    setDirty(false);
    setMeta(null);
    setFile(f);
    setExtra([]);
    try {
      const m = await parser.current.parse(f);
      if (g !== generation.current) return;
      currentMeta.current = m;
      setMeta(m);
      const opts = options(m);
      for (const k of kinds) {
        const matches = opts.filter(
          (o: any) =>
            detectChannel(
              o.channel,
              o.channel.dimension.reduce((a: number, b: number) => a * b, 1),
            ) === k,
        );
        const exact = matches.filter(
          (o: any) =>
            o.channel.name === k || (k === "USIT" && o.channel.name === "AIBK"),
        );
        const chosen =
          exact.length === 1
            ? exact[0]
            : matches.length === 1
              ? matches[0]
              : null;
        if (chosen) await setTrack(k, chosen.value, m);
      }
      const cblRefs = m.logicalFiles.flatMap((lf: any) =>
        lf.parameters.filter(
          (p: any) =>
            /free.?pipe.*(amplitude|reference)/i.test(
              p.longName + " " + p.name,
            ) &&
            /^mv$/i.test(p.units) &&
            p.values?.length === 1 &&
            p.values[0] > 0,
        ),
      );
      if (cblRefs.length === 1)
        setCalibration({
          reference: String(cblRefs[0].values[0]),
          source: "Parâmetro DLIS: " + cblRefs[0].name,
          goodMax: "",
          badMin: "",
        });
      else
        setCalibration({
          reference: "",
          source: "Informado pelo usuário",
          goodMax: "",
          badMin: "",
        });
      api("analyses?hash=" + m.hash)
        .then((d) => setAnalyses(d.analyses))
        .catch((e) => toast.error(e.message));
      post("history", { hash: m.hash, fileName: f.name, fileId }).catch((e) =>
        toast.error(e.message),
      );
    } catch (e: any) {
      if (g === generation.current) setError(e.message);
    } finally {
      if (g === generation.current) setBusy("");
    }
  }
  function requestFile(f?: File) {
    if (!f) return;
    if (dirty) {
      setPendingFile(f);
      return;
    }
    setRemoteFile(null);
    loadFile(f);
  }
  useEffect(() => {
    const ranges = Object.values(tracks)
      .map((t) => numericRange(t.depth))
      .filter(Boolean) as number[][];
    if (ranges.length) {
      const a = Math.min(...ranges.map((r) => r[0])),
        b = Math.max(...ranges.map((r) => r[1]));
      setFull([a, b]);
      setFrom(a);
      setTo(b > a ? b : a + 1);
    }
  }, [
    Object.keys(tracks)
      .map((k) => tracks[k].id + tracks[k].depthName)
      .join(";"),
  ]);
  function choosePoint(track: Track, s: number, c: number, pin = false) {
    try {
      const cal = {
        ...calibration,
        reference: Number(calibration.reference),
        goodMax: calibration.goodMax === "" ? NaN : Number(calibration.goodMax),
        badMin: calibration.badMin === "" ? NaN : Number(calibration.badMin),
      };
      const p = pointFromTrack(track, s, c, file, meta, cal);
      setPoint(p);
      if (pin) {
        setPoints((old) => [...old, p]);
        setDirty(true);
        toast.success("Ponto fixado no array original.");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  function zoom(f: number, r = 0.5) {
    const span = (to - from) * f,
      anchor = from + (to - from) * r;
    setFrom(anchor - span * r);
    setTo(anchor + span * (1 - r));
  }
  function pan(d: number) {
    setFrom((x) => x + d);
    setTo((x) => x + d);
  }
  async function save() {
    if (!meta) return;
    setBusy("Salvando análise…");
    try {
      const d = await post("analyses", {
        id: analysisId || undefined,
        hash: meta.hash,
        fileName: file?.name,
        name: analysisName,
        points,
        settings: { calibration, choices, from, to, agc },
      });
      setAnalysisId(d.id);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("pt-BR"));
      const all = await api("analyses?hash=" + meta.hash);
      setAnalyses(all.analyses);
      toast.success("Análise salva na sua conta.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy("");
    }
  }
  async function restore(id: string) {
    const a = analyses.find((a) => a.id === id);
    if (!a) return;
    if (dirty) {
      toast.error("Salve a análise atual antes de recuperar outra.");
      return;
    }
    setPoints(a.points);
    setAnalysisId(a.id);
    setAnalysisName(a.name);
    setCalibration(a.settings.calibration || calibration);
    setDirty(false);
    setSavedAt(new Date(a.updated_at).toLocaleString("pt-BR"));
    toast.success("Pontos recuperados.");
  }
  async function exportData() {
    try {
      await exportPoints(
        points.map((p) => ({ ...p, analysisId: analysisId || null })),
        exportFormat,
        meta.hash,
      );
      await post("exports", {
        hash: meta.hash,
        analysisId,
        format: exportFormat,
        count: points.length,
      });
      toast.success("Arquivo exportado.");
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  const trackKinds = [...kinds, ...extra],
    opts = options();
  const volve = meta?.logicalFiles.some(
    (lf: any) =>
      String(lf.origin?.fieldName).toLowerCase() === "volve" &&
      lf.origin?.wellName === "15/9-F-15 C" &&
      lf.origin?.runNumber === 2 &&
      /main pass up/i.test(
        [
          lf.origin?.fileSetName,
          ...lf.frames.map((f: any) => f.description),
        ].join(" "),
      ),
  );
  return (
    <div className="viewer-page">
      <div className="viewer-heading">
        <div>
          <a className="breadcrumb" href="/">
            <ArrowLeft size={13} /> Biblioteca / Visualizador
          </a>
          <h1>
            {meta?.logicalFiles[0]?.origin?.wellName || "Visualizador DLIS"}
          </h1>
          <p>
            {file
              ? file.name
              : "Abra um arquivo para explorar curvas e amostras originais."}
          </p>
        </div>
        <div className="row">
          <input
            ref={input}
            type="file"
            accept=".dlis,.DLIS"
            className="sr-only"
            onChange={(e) => requestFile(e.target.files?.[0])}
          />
          <button className="button" onClick={() => input.current?.click()}>
            <Upload size={16} /> Abrir DLIS
          </button>
          {meta && (
            <button className="button" onClick={() => setMetadataOpen(true)}>
              <FileSearch size={16} /> Metadados
            </button>
          )}
        </div>
      </div>
      {busy && (
        <div className="notice" role="status">
          {busy}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {!meta && !busy ? (
        <div className="viewer-empty">
          <div
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              requestFile(e.dataTransfer.files[0]);
            }}
          >
            <ScanLine size={40} />
            <h2>Seu arquivo. Cada amostra.</h2>
            <p>Arraste um DLIS RP66 V1 ou selecione no computador.</p>
            <button
              className="button primary"
              onClick={() => input.current?.click()}
            >
              <Upload size={16} /> Selecionar arquivo DLIS
            </button>
            <span className="status-label">
              O arquivo local é processado no seu navegador. Ele não é
              publicado.
            </span>
          </div>
          <div className="track-preview-labels">
            {["PROFUNDIDADE", "GR", "CBL", "VDL", "USIT"].map((k) => (
              <div key={k}>
                {k}
                <span>Aguardando dados</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        meta && (
          <>
            <div className="viewer-toolbar">
              <div className="row">
                <label className="inline-field">
                  De{" "}
                  <input
                    aria-label="Profundidade inicial em metros"
                    type="number"
                    step="any"
                    value={from}
                    onChange={(e) => setFrom(Number(e.target.value))}
                  />{" "}
                  m
                </label>
                <label className="inline-field">
                  Até{" "}
                  <input
                    aria-label="Profundidade final em metros"
                    type="number"
                    step="any"
                    value={to}
                    onChange={(e) => setTo(Number(e.target.value))}
                  />{" "}
                  m
                </label>
                <button
                  className="icon-button"
                  aria-label="Aproximar profundidade"
                  onClick={() => zoom(0.7)}
                >
                  <Plus size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Afastar profundidade"
                  onClick={() => zoom(1.3)}
                >
                  <Minus size={17} />
                </button>
                <button
                  className="button compact"
                  onClick={() => {
                    setFrom(full[0]);
                    setTo(full[1]);
                  }}
                >
                  <RotateCcw size={14} /> Toda a profundidade
                </button>
              </div>
              <div className="row">
                <label className="row status-label">
                  <Switch checked={agc} onCheckedChange={setAgc} /> AGC visual
                </label>
                <button
                  className="button compact"
                  onClick={() => setMappingOpen(true)}
                >
                  <SlidersHorizontal size={14} /> Configurar tracks
                </button>
                <button
                  className="button compact"
                  onClick={() => setCalibrationOpen(true)}
                >
                  Referência CBL
                </button>
              </div>
            </div>
            {volve && (
              <div className="row presets">
                {[
                  [2743, 2800],
                  [2800, 2900],
                  [2900, 3000],
                  [3000, 3038],
                ].map(([a, b]) => (
                  <button
                    className="button compact"
                    key={a}
                    onClick={() => {
                      setFrom(a);
                      setTo(b);
                    }}
                  >
                    {a}–{b} m
                  </button>
                ))}
              </div>
            )}
            {to <= from && (
              <div className="notice error">
                A profundidade final deve ser maior que a inicial.
              </div>
            )}
            {meta.warnings.length > 0 && (
              <div className="notice warning">
                O parser registrou {meta.warnings.length} aviso(s). Consulte os
                metadados antes de interpretar os dados.
              </div>
            )}
            <div className="viewer-workspace">
              <div className="tracks-scroll">
                <div className="tracks-row">
                  <div className="depth-track">
                    <div className="track-header">
                      <strong>PROF.</strong>
                      <small>m</small>
                    </div>
                    <div className="depth-axis">
                      {Array.from({ length: 11 }, (_, i) => (
                        <span key={i} style={{ top: i * 62 }}>
                          {(from + ((to - from) * i) / 10).toFixed(2)}
                        </span>
                      ))}
                      {point && point.depth >= from && point.depth <= to && (
                        <b
                          style={{
                            top: ((point.depth - from) / (to - from)) * 620,
                          }}
                        >
                          {point.depth.toFixed(2)}
                        </b>
                      )}
                    </div>
                  </div>
                  {trackKinds.map((k) => {
                    const t = tracks[k];
                    return (
                      <div
                        className={
                          "data-track " + (k === "CBL" ? "cbl-track" : "")
                        }
                        key={k}
                      >
                        <div className="track-header">
                          <strong>
                            {k.startsWith("OTHER") ? "OUTRA CURVA" : k}
                          </strong>
                          <small>
                            {t
                              ? `${t.channel.name} · ${t.channel.units || "unidade não informada"}`
                              : "Nenhum canal correspondente"}
                          </small>
                          <Pick
                            label={"Canal " + k}
                            value={choices[k] || ""}
                            onChange={(v) => setTrack(k, v)}
                            options={[
                              none,
                              ...opts.filter((o: any) => {
                                const n = o.channel.dimension.reduce(
                                  (a: number, b: number) => a * b,
                                  1,
                                );
                                return scalarKinds.includes(k)
                                  ? n === 1
                                  : k === "VDL" || k === "USIT"
                                    ? n > 1
                                    : true;
                              }),
                            ]}
                          />
                        </div>
                        {t ? (
                          <>
                            <div className="track-scale">
                              <span>
                                {t.stride > 1
                                  ? "Componente 0"
                                  : t.range[0].toPrecision(4)}
                              </span>
                              <span>
                                {t.stride > 1
                                  ? t.stride - 1
                                  : t.range[1].toPrecision(4)}
                              </span>
                            </div>
                            <TrackCanvas
                              track={t}
                              from={from}
                              to={to}
                              agc={agc}
                              hoverDepth={point?.depth ?? null}
                              onHover={(s, c) => choosePoint(t, s, c)}
                              onPin={(s, c) => choosePoint(t, s, c, true)}
                              onZoom={zoom}
                              onPan={pan}
                            />
                            <div className="track-source">
                              LF {t.lf + 1} · Frame {t.frame.name} ·{" "}
                              {t.result.frameCount} amostras
                            </div>
                          </>
                        ) : (
                          <div className="track-unavailable">
                            <FileSearch size={24} />
                            <p>
                              {choices[k]
                                ? "Canal não pôde ser desenhado. Confira a configuração de profundidade."
                                : `${k.startsWith("OTHER") ? "Canal" : k} não selecionado.`}
                            </p>
                            <small>Escolha um canal real do arquivo.</small>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <aside className="reading-panel">
                <div className="eyebrow">LEITURA DO PONTO</div>
                {point ? (
                  <>
                    <h3>{point.channel}</h3>
                    <div className="reading-value">
                      {point.rawValue ?? point.rawRepresentation}
                      <small>{point.unit}</small>
                    </div>
                    <span className="badge">Valor bruto original</span>
                    <dl className="reading-dl">
                      {Object.entries({
                        Profundidade: point.depth + " m",
                        "Prof. original":
                          point.depthRaw + " " + point.depthRawUnit,
                        "Logical file":
                          point.logicalFile || point.logicalFileIndex,
                        Frame: point.frame,
                        "Sample index": point.sampleIndex,
                        "Component index": point.componentIndex,
                        Validade: point.validity,
                        "Tempo VDL":
                          point.timeUs === null
                            ? "Tempo não disponível nos metadados"
                            : point.timeUs + " µs",
                        Azimute:
                          point.azimuth === null
                            ? "Azimute não disponível"
                            : point.azimuth + "°",
                        "Zona USIT": point.zone || "Não se aplica",
                        "Micro-debonding":
                          point.microDebonding ||
                          "Não disponível neste arquivo",
                        "Classificação automática":
                          point.automaticClassification || "Não classificado",
                      }).map(([k, v]) => (
                        <div key={k}>
                          <dt>{k}</dt>
                          <dd>{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                    <button
                      className="button primary"
                      style={{ width: "100%", marginTop: 18 }}
                      onClick={() => {
                        setPoints((p) => [
                          ...p,
                          { ...point, id: crypto.randomUUID() },
                        ]);
                        setDirty(true);
                      }}
                    >
                      <Pin size={15} /> Fixar ponto
                    </button>
                  </>
                ) : (
                  <div className="reading-empty">
                    <Pin size={27} />
                    <h3>Explore uma amostra</h3>
                    <p>
                      Passe o cursor para ler.
                      <br />
                      Clique na curva para fixar.
                    </p>
                    <small>
                      A leitura vem do array original, antes do ganho visual.
                    </small>
                  </div>
                )}
                <div className="usit-legend">
                  <b>USIT · MRayl</b>
                  {[
                    ["#FF0000", "Gás", "0 ≤ Z < 0,3"],
                    ["#00FFFF", "Líquido", "0,3 ≤ Z < 2,6"],
                    [
                      "linear-gradient(90deg,#FFFFCC,#000)",
                      "Cimento",
                      "2,6 ≤ Z < 10",
                    ],
                    ["#000000", "Elevada", "Z ≥ 10"],
                    ["#008000", "Sem leitura", "−2000"],
                    ["#808080", "Inválido", "Z < 0; exceto −2000"],
                  ].map(([c, l, v]) => (
                    <div key={l}>
                      <i style={{ background: c }} />
                      <span>{l}</span>
                      <small>{v}</small>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
            <div className="sample-picker">
              <span>Selecionar por índice:</span>
              <Pick
                label="Track para seleção por índice"
                value={manualTrack}
                onChange={setManualTrack}
                options={[
                  { value: "", label: "Escolha o track" },
                  ...Object.entries(tracks).map(([k, t]) => ({
                    value: k,
                    label: k + " · " + t.channel.name,
                  })),
                ]}
              />
              <label>
                Sample{" "}
                <input
                  type="number"
                  min="0"
                  value={sample}
                  onChange={(e) => setSample(Number(e.target.value))}
                />
              </label>
              <label>
                Component{" "}
                <input
                  type="number"
                  min="0"
                  value={component}
                  onChange={(e) => setComponent(Number(e.target.value))}
                />
              </label>
              <button
                className="button compact"
                disabled={!tracks[manualTrack]}
                onClick={() =>
                  choosePoint(tracks[manualTrack], sample, component, true)
                }
              >
                Fixar amostra
              </button>
            </div>
            <div className="section-heading">
              <div>
                <h2>
                  Pontos selecionados{" "}
                  <span className="badge">{points.length}</span>
                </h2>
                <span className="status-label">
                  {dirty
                    ? "Alterações ainda não salvas"
                    : savedAt
                      ? "Salvo em " + savedAt
                      : "Fixe pontos e salve sua análise na conta."}
                </span>
              </div>
              <div className="row">
                <Pick
                  label="Formato de exportação"
                  value={exportFormat}
                  onChange={setExportFormat}
                  options={["csv", "xlsx", "json"].map((v) => ({
                    value: v,
                    label: v.toUpperCase(),
                  }))}
                />
                <button
                  className="button"
                  disabled={!points.length}
                  onClick={exportData}
                >
                  <Download size={16} /> Exportar
                </button>
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={save}
                >
                  <Save size={16} /> Salvar análise
                </button>
              </div>
            </div>
            <div className="analysis-toolbar">
              <label className="inline-field">
                Nome da análise{" "}
                <input
                  value={analysisName}
                  onChange={(e) => {
                    setAnalysisName(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <Pick
                label="Recuperar análise salva"
                value={analysisId}
                onChange={restore}
                options={[
                  { value: "", label: "Recuperar análise salva" },
                  ...analyses.map((a) => ({
                    value: a.id,
                    label: a.name + " · " + a.points.length + " pontos",
                  })),
                ]}
              />
              <button
                className="button compact"
                disabled={dirty}
                onClick={() => {
                  setPoints([]);
                  setAnalysisId("");
                  setAnalysisName("Nova análise");
                  setSavedAt("");
                  setDirty(false);
                }}
              >
                Nova análise
              </button>
            </div>
            <div className="panel points-panel">
              {points.length ? (
                <PointsTable
                  points={points}
                  onChange={(p) => {
                    setPoints(p);
                    setDirty(true);
                  }}
                />
              ) : (
                <p className="status-label">
                  Nenhum ponto fixado. Clique em uma curva ou selecione por
                  índice.
                </p>
              )}
            </div>
            <div className="viewer-audit">
              <Info size={14} />
              <span>
                SHA-256 <span className="hash">{meta.hash}</span> · Índices base
                0 · Profundidade em metros, convertida da unidade declarada no
                arquivo.
              </span>
            </div>
          </>
        )
      )}
      <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
        <DialogContent className="large-dialog">
          <DialogHeader>
            <DialogTitle>Metadados e auditoria</DialogTitle>
            <DialogDescription>
              {file?.name} · {file && formatBytes(file.size)} · RP66{" "}
              {meta?.version}
            </DialogDescription>
          </DialogHeader>
          {meta?.warnings.map((w: string, i: number) => (
            <div className="notice warning" key={i}>
              {w}
            </div>
          ))}
          {meta?.logicalFiles.map((lf: any) => (
            <section key={lf.index}>
              <h3>
                Logical file {lf.index + 1} · {lf.id || "ID não informado"}
              </h3>
              <dl className="meta-grid">
                {Object.entries(lf.origin || {}).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>
                      {v === null || v === "" ? "Não informado" : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
              {lf.frames.map((f: any) => (
                <details key={f.key}>
                  <summary>
                    Frame {f.name} · {f.channels.length} canais · {f.indexType}
                  </summary>
                  <Table className="technical-table">
                    <TableHeader>
                      <TableRow>
                        {[
                          "Canal",
                          "Descrição",
                          "Unidade",
                          "Dimensão",
                          "Chave",
                          "Sugestão",
                        ].map((x) => (
                          <TableHead key={x}>{x}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {f.channels.map((c: any) => (
                        <TableRow key={c.key}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell>
                            {typeof c.longName === "string"
                              ? c.longName
                              : "Descrição estruturada"}
                          </TableCell>
                          <TableCell>{c.units || "Não informada"}</TableCell>
                          <TableCell>{c.dimension.join("×")}</TableCell>
                          <TableCell>{c.key}</TableCell>
                          <TableCell>
                            {c.kind === "OTHER" ? "Não identificado" : c.kind}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              ))}
              <details>
                <summary>Parâmetros ({lf.parameters.length})</summary>
                <pre>{JSON.stringify(lf.parameters, null, 2)}</pre>
              </details>
            </section>
          ))}
        </DialogContent>
      </Dialog>
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="large-dialog">
          <DialogHeader>
            <DialogTitle>Configurar tracks e eixos</DialogTitle>
            <DialogDescription>
              Cada track pode usar seu próprio frame. Todos compartilham a
              profundidade em metros; não há interpolação entre frames.
            </DialogDescription>
          </DialogHeader>
          {trackKinds.map((k) => {
            const o = opts.find((o: any) => o.value === choices[k]),
              t = tracks[k];
            return (
              <div className="panel stack" key={k}>
                <b>{k}</b>
                <Pick
                  label={"Canal " + k}
                  value={choices[k] || ""}
                  onChange={(v) => setTrack(k, v)}
                  options={[none, ...opts]}
                />
                {o && (
                  <>
                    <label className="form-field">
                      Canal de profundidade{" "}
                      <Pick
                        label={"Profundidade " + k}
                        value={t?.depthName || ""}
                        onChange={(v) => setTrack(k, choices[k], meta, v)}
                        options={[
                          { value: "", label: "Selecione a profundidade" },
                          ...depthNames(o.frame).map((c: any) => ({
                            value: c.name,
                            label: c.name + " · " + c.units,
                          })),
                        ]}
                      />
                    </label>
                    {t && t.stride > 1 && ["VDL", "USIT"].includes(k) && (
                      <label className="form-field">
                        {k === "VDL"
                          ? "Canal do tempo (um valor por componente, em µs)"
                          : "Canal de azimute (um valor por setor, em graus)"}
                        <Pick
                          label={"Eixo " + k}
                          value={
                            (k === "VDL" ? t.timeName : t.azimuthName) || ""
                          }
                          onChange={(v) =>
                            setTracks((old) => ({
                              ...old,
                              [k]: {
                                ...old[k],
                                [k === "VDL" ? "timeName" : "azimuthName"]: v,
                              },
                            }))
                          }
                          options={[
                            {
                              value: "",
                              label: "Não disponível / sem associação",
                            },
                            ...o.frame.channels
                              .filter(
                                (c: any) =>
                                  t.result.strides[c.name] === t.stride &&
                                  (k === "VDL"
                                    ? /^(us|µs|μs)$/i.test(c.units)
                                    : /^(deg|degree|degrees|°)$/i.test(
                                        c.units,
                                      )),
                              )
                              .map((c: any) => ({
                                value: c.name,
                                label: c.name + " · " + c.units,
                              })),
                          ]}
                        />
                        <small>
                          Associe somente se a documentação do arquivo confirmar
                          a correspondência componente a componente.
                        </small>
                      </label>
                    )}
                  </>
                )}
              </div>
            );
          })}
          <button
            className="button"
            onClick={() => setExtra((e) => [...e, "OTHER" + (e.length + 1)])}
          >
            <Plus size={16} /> Adicionar outra curva
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={calibrationOpen} onOpenChange={setCalibrationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Referência de free pipe · CBL</DialogTitle>
            <DialogDescription>
              Não existem limites universais. A referência e os limiares abaixo
              ficam registrados com cada ponto classificado.
            </DialogDescription>
          </DialogHeader>
          <label className="form-field">
            Amplitude de referência (mV)
            <input
              type="number"
              min="0"
              step="any"
              value={calibration.reference}
              onChange={(e) =>
                setCalibration({
                  ...calibration,
                  reference: e.target.value,
                  source: "Informado pelo usuário",
                })
              }
            />
          </label>
          <div className="status-label">Origem: {calibration.source}</div>
          <div className="form-grid">
            <label className="form-field">
              Bom: amplitude / referência ≤
              <input
                type="number"
                min="0"
                step="any"
                value={calibration.goodMax}
                onChange={(e) =>
                  setCalibration({ ...calibration, goodMax: e.target.value })
                }
              />
            </label>
            <label className="form-field">
              Ruim: amplitude / referência ≥
              <input
                type="number"
                min="0"
                step="any"
                value={calibration.badMin}
                onChange={(e) =>
                  setCalibration({ ...calibration, badMin: e.target.value })
                }
              />
            </label>
          </div>
          <p className="status-label">
            Moderado entre os limiares. Sem referência e limiares válidos, a
            classificação automática fica indisponível. Novos parâmetros afetam
            apenas os próximos pontos.
          </p>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!pendingFile}
        onOpenChange={(open) => {
          if (!open) setPendingFile(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar de arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Há pontos ou alterações não salvos. Salve a análise para
              recuperá-los depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e salvar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingFile) loadFile(pendingFile);
                setPendingFile(null);
              }}
            >
              Descartar e abrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
