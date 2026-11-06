"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useState, useRef, useEffect, useMemo } from "react";
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
import { api, post, formatBytes, authenticatedFetch } from "@/lib/api";
import { DlisClient } from "@/lib/dlis/client";
import {
  detectChannel,
  isDlisName,
  numericRange,
  metersFactor,
  defaultDepthChannel,
  boundedInterval,
} from "@/lib/dlis/core.js";
import { makeTrack, type Track } from "@/lib/dlis/plotting";
import { pointFromTrack } from "@/lib/dlis/points";
import { exportPoints } from "@/lib/dlis/export";
import { Pick } from "./controls";
import { validateRegions, type Region } from "@/lib/dlis/regions";
import { TrackCanvas } from "./track-canvas";
import { TrackTools } from "./track-tools";
import { Waveform } from "./waveform";
import { PointsTable } from "./points-table";
const kinds = ["GR", "CBL", "VDL", "USIT"];
const scalarKinds = ["GR", "CBL"];
export function Viewer({ file: remoteId }: { file?: string }) {
  const { translate, message, locale } = useI18n();
  const none = { value: "", label: translate("Nenhum canal selecionado") };
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
    [agc, setAgc] = useState(false),
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
    [remoteFile, setRemoteFile] = useState<any>(null),
    [trackErrors, setTrackErrors] = useState<Record<string, string>>({}),
    [decoding, setDecoding] = useState<Record<string, boolean>>({}),
    [progress, setProgress] = useState(""),
    [syncEnabled, setSyncEnabled] = useState(false),
    [closeRequested, setCloseRequested] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const parser = useRef<DlisClient | null>(null),
    cache = useRef(new Map<string, Promise<any>>()),
    generation = useRef(0),
    input = useRef<HTMLInputElement>(null),
    remoteAbort = useRef<AbortController | null>(null),
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
    const controller = new AbortController();
    remoteAbort.current = controller;
    setBusy("Carregando arquivo…");
    api("files/" + remoteId, { signal: controller.signal })
      .then(async (d) => {
        if (stopped) return;
        setRemoteFile(d.file);
        const r = await authenticatedFetch(
          "/api/files/" + remoteId + "/content",
          { signal: controller.signal },
        );
        if (!r.ok)
          throw new Error(translate("Não foi possível baixar o arquivo."));
        const blob = await r.blob();
        if (!stopped && !controller.signal.aborted)
          await loadFile(new File([blob], d.file.original_name), remoteId);
      })
      .catch((e) => {
        if (!stopped && !controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!stopped && !controller.signal.aborted) setBusy("");
      });
    return () => {
      stopped = true;
      controller.abort();
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
    setDecoding((d) => ({ ...d, [kind]: false }));
    setTracks((old) => {
      const next = { ...old };
      delete next[kind];
      return next;
    });
    if (!id) {
      setTracks((t) => {
        const v = { ...t };
        delete v[kind];
        return v;
      });
      return;
    }
    setTrackErrors((e) => ({ ...e, [kind]: "" }));
    const option = options(m).find((o: any) => o.value === id);
    if (!option) return;
    try {
      setDecoding((d) => ({ ...d, [kind]: true }));
      const depth = depthOverride || defaultDepthChannel(option.frame);
      const channels = option.frame.channels
        .filter(
          (c: any) =>
            c.name === option.channel.name ||
            c.name === depth ||
            c.dimension.reduce((a: number, b: number) => a * b, 1) === 1 ||
            /^(us|µs|μs|deg|degree|degrees|°)$/i.test(c.units),
        )
        .map((c: any) => c.name);
      const key = option.lf + "|" + option.frame.key + "|" + option.channel.key;
      if (!cache.current.has(key)) {
        const task = parser.current!.decode(
          option.lf,
          option.frame.key,
          channels,
        );
        cache.current.set(key, task);
        task.catch(() => {
          if (cache.current.get(key) === task) cache.current.delete(key);
        });
        // Bound retained derived frames; currently displayed tracks keep their own arrays.
        if (cache.current.size > 6)
          cache.current.delete(cache.current.keys().next().value!);
      }
      const result = await cache.current.get(key);
      if (selVersions.current[kind] !== n || currentMeta.current !== m) return;
      if (!depth)
        throw new Error(
          translate(
            "Escolha manualmente o canal de profundidade em “Configurar tracks”.",
          ),
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
      if (selVersions.current[kind] !== n || currentMeta.current !== m) return;
      setTrackErrors((errors) => ({ ...errors, [kind]: e.message }));
      setTracks((t) => {
        const v = { ...t };
        delete v[kind];
        return v;
      });
      toast.error(`${kind}: ${message(e.message)}`);
    } finally {
      if (selVersions.current[kind] === n && currentMeta.current === m)
        setDecoding((d) => ({ ...d, [kind]: false }));
    }
  }
  async function loadFile(f: File, fileId?: string) {
    if (!isDlisName(f.name)) {
      setError("Selecione um arquivo com extensão .DLIS.");
      return;
    }
    if (f.size > 512 * 1024 * 1024) {
      setError("Arquivo excede o limite de 512 MB.");
      return;
    }
    const g = ++generation.current;
    currentMeta.current = null;
    setTrackErrors({});
    setDecoding({});
    setProgress("");
    setBusy("Lendo estrutura e metadados do DLIS…");
    setError("");
    parser.current?.destroy();
    parser.current = new DlisClient((phase) => {
      if (generation.current === g) setProgress(phase);
    });
    cache.current.clear();
    selVersions.current = {};
    setTracks({});
    setChoices({});
    setPoint(null);
    setPoints([]);
    setRegions([]);
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
            o.channel.name === k ||
            (k === "GR" && /^GR_/.test(o.channel.name)) ||
            (k === "USIT" && o.channel.name === "AIBK"),
        );
        const chosen =
          exact.length === 1
            ? exact[0]
            : matches.length === 1
              ? matches[0]
              : null;
        if (g !== generation.current) return;
        if (chosen) await setTrack(k, chosen.value, m);
      }
      if (g !== generation.current) return;
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

      if (syncEnabled)
        post("history", { hash: m.hash, fileName: f.name, fileId }).catch((e) =>
          toast.error(message(e.message)),
        );
    } catch (e: any) {
      if (g === generation.current) setError(e.message);
    } finally {
      if (g === generation.current) setBusy("");
    }
  }
  useEffect(() => {
    if (!syncEnabled || !meta) return;
    let stopped = false;
    api("analyses?hash=" + meta.hash)
      .then((d) => {
        if (!stopped) setAnalyses(d.analyses);
      })
      .catch((e) => {
        if (!stopped) toast.error(message(e.message));
      });
    return () => {
      stopped = true;
    };
  }, [syncEnabled, meta]);
  function requestFile(f?: File) {
    if (!f) return;
    if (dirty) {
      setPendingFile(f);
      return;
    }
    remoteAbort.current?.abort();
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
      setFull([a, b > a ? b : a + 1]);
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
        toast.success(translate("Ponto fixado no array original."));
      }
    } catch (e: any) {
      toast.error(message(e.message));
    }
  }
  function changeInterval(a: number, b: number) {
    const interval = boundedInterval(a, b, full);
    if (interval) {
      setFrom(interval[0]);
      setTo(interval[1]);
    }
  }
  function zoom(f: number, r = 0.5) {
    const span = (to - from) * f,
      anchor = from + (to - from) * r;
    changeInterval(anchor - span * r, anchor + span * (1 - r));
  }
  function pan(d: number) {
    changeInterval(from + d, to + d);
  }
  function closeFile() {
    remoteAbort.current?.abort();
    generation.current++;
    currentMeta.current = null;
    parser.current?.destroy();
    parser.current = null;
    cache.current.clear();
    selVersions.current = {};
    setTracks({});
    setMeta(null);
    setFile(null);
    setPoint(null);
    setPoints([]);
    setRegions([]);
    setBusy("");
    setProgress("");
    setDecoding({});
    setDirty(false);
    setError("");
    setTrackErrors({});
    setRemoteFile(null);
    if (input.current) input.current.value = "";
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
        settings: { calibration, choices, from, to, agc, regions },
      });
      setAnalysisId(d.id);
      setDirty(false);
      setSavedAt(new Date().toISOString());
      const all = await api("analyses?hash=" + meta.hash);
      setAnalyses(all.analyses);
      toast.success(translate("Análise salva na sua conta."));
    } catch (e: any) {
      toast.error(message(e.message));
    } finally {
      setBusy("");
    }
  }
  async function restore(id: string) {
    const a = analyses.find((a) => a.id === id);
    if (!a) return;
    if (dirty) {
      toast.error(translate("Salve a análise atual antes de recuperar outra."));
      return;
    }
    try {
      setRegions(validateRegions(a.settings?.regions || [], meta.hash));
    } catch {
      toast.error("Marcações inválidas / Invalid annotations");
      return;
    }
    setPoints(a.points);
    setAnalysisId(a.id);
    setAnalysisName(a.name);
    setCalibration(a.settings.calibration || calibration);
    setDirty(false);
    setSavedAt(a.updated_at);
    toast.success(translate("Pontos recuperados."));
  }
  async function exportData() {
    try {
      await exportPoints(
        points.map((p) => ({ ...p, analysisId: analysisId || null })),
        exportFormat,
        meta.hash,
      );
      if (syncEnabled)
        await post("exports", {
          hash: meta.hash,
          analysisId,
          format: exportFormat,
          count: points.length,
        });
      toast.success(translate("Arquivo exportado."));
    } catch (e: any) {
      toast.error(message(e.message));
    }
  }
  const trackKinds = [...kinds, ...extra],
    opts = useMemo(() => options(), [meta]);
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
            <ArrowLeft size={13} />
            {translate("Biblioteca / Visualizador")}
          </a>
          <h1>
            {meta?.logicalFiles[0]?.origin?.wellName ||
              translate("Visualizador DLIS")}
          </h1>
          <p>
            {file
              ? file.name
              : translate(
                  "Abra um arquivo para explorar curvas e amostras originais.",
                )}
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
            <Upload size={16} />
            {translate("Abrir DLIS")}
          </button>
          {file && (
            <button
              className="button"
              onClick={() => (dirty ? setCloseRequested(true) : closeFile())}
            >
              <X size={16} />
              {translate("Fechar arquivo")}
            </button>
          )}
          {meta && (
            <button className="button" onClick={() => setMetadataOpen(true)}>
              <FileSearch size={16} />
              {translate("Metadados")}
            </button>
          )}
        </div>
      </div>
      {busy && (
        <div className="notice" role="status">
          <span>
            {message(busy)} {progress && <small>{message(progress)}</small>}
          </span>
          {busy.includes("DLIS") && (
            <button className="button compact" onClick={closeFile}>
              {translate("Cancelar leitura")}
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {message(error)}
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
            <h2>{translate("Seu arquivo. Cada amostra.")}</h2>
            <p>
              {translate("Arraste um DLIS RP66 V1 ou selecione no computador.")}
            </p>
            <button
              className="button primary"
              onClick={() => input.current?.click()}
            >
              <Upload size={16} />
              {translate("Selecionar arquivo DLIS")}
            </button>
            <span className="status-label">
              {translate(
                "O arquivo local é processado no seu navegador. Ele não é publicado.",
              )}
            </span>
          </div>
          <div className="track-preview-labels">
            {[translate("PROFUNDIDADE"), "GR", "CBL", "VDL", "USIT"].map(
              (k) => (
                <div key={k}>
                  {k}
                  <span>{translate("Aguardando dados")}</span>
                </div>
              ),
            )}
          </div>
        </div>
      ) : (
        meta && (
          <>
            <div className="viewer-summary">
              <span className="badge valid">
                {translate("Dados originais")}
              </span>
              <span>
                {meta.logicalFiles.length} {translate("arquivos lógicos")} ·{" "}
                {opts.length} {translate("canais disponíveis")}
              </span>
              <span>{formatBytes(file?.size || 0, locale)}</span>
              <label className="row">
                <Switch
                  checked={syncEnabled}
                  onCheckedChange={setSyncEnabled}
                />
                {translate("Sincronizar histórico na conta")}
              </label>
            </div>
            <p className="privacy-note">
              {translate(
                "Salvar análise envia pontos e metadados à sua conta. Publicar envia o arquivo somente após confirmação.",
              )}
            </p>
            <p className="privacy-note">
              {translate(
                "Visão geral por amostras próximas; amplie para inspecionar detalhes.",
              )}
            </p>
            <div className="viewer-toolbar">
              <div className="row">
                <label className="inline-field">
                  {translate("De")}{" "}
                  <input
                    aria-label={translate("Profundidade inicial em metros")}
                    type="number"
                    step="any"
                    value={from}
                    onChange={(e) => setFrom(Number(e.target.value))}
                  />{" "}
                  m
                </label>
                <label className="inline-field">
                  {translate("Até")}{" "}
                  <input
                    aria-label={translate("Profundidade final em metros")}
                    type="number"
                    step="any"
                    value={to}
                    onChange={(e) => setTo(Number(e.target.value))}
                  />{" "}
                  m
                </label>
                <button
                  className="icon-button"
                  aria-label={translate("Aproximar profundidade")}
                  onClick={() => zoom(0.7)}
                >
                  <Plus size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={translate("Afastar profundidade")}
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
                  <RotateCcw size={14} />
                  {translate("Toda a profundidade")}
                </button>
              </div>
              <div className="row">
                <label className="row status-label">
                  <Switch checked={agc} onCheckedChange={setAgc} />
                  {translate("AGC visual")}
                </label>
                <button
                  className="button compact"
                  onClick={() => setMappingOpen(true)}
                >
                  <SlidersHorizontal size={14} />
                  {translate("Configurar tracks")}
                </button>
                <button
                  className="button compact"
                  onClick={() => setCalibrationOpen(true)}
                >
                  {translate("Referência CBL")}
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
                {translate(
                  "A profundidade final deve ser maior que a inicial.",
                )}
              </div>
            )}
            {meta.warnings.length > 0 && (
              <div className="notice warning">
                {translate("O parser registrou")}
                {meta.warnings.length}
                {translate(
                  "aviso(s). Consulte os metadados antes de interpretar os dados.",
                )}
              </div>
            )}
            <div className="viewer-workspace">
              <div className="tracks-scroll">
                <div className="tracks-row">
                  <div className="depth-track">
                    <div className="track-header">
                      <strong>{translate("PROF.")}</strong>
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
                            {k.startsWith("OTHER")
                              ? translate("OUTRA CURVA")
                              : k}
                          </strong>
                          <small title={t?.channel.longName}>
                            {t
                              ? `${t.channel.name} · ${t.channel.units || translate("unidade não informada")}`
                              : translate("Nenhum canal correspondente")}
                          </small>
                          <Pick
                            label={translate("Canal ") + k}
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
                                  ? translate("Componente 0")
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
                              fileHash={meta.hash}
                              regions={regions}
                              onRegions={(r) => {
                                if (currentMeta.current?.hash !== meta.hash)
                                  return;
                                setRegions(r);
                                setDirty(true);
                              }}
                              hoverDepth={point?.depth ?? null}
                              onHover={(s, c) => choosePoint(t, s, c)}
                              onPin={(s, c) => choosePoint(t, s, c, true)}
                              onZoom={zoom}
                              onPan={pan}
                            />
                            <TrackTools
                              key={t.id}
                              track={t}
                              from={from}
                              to={to}
                              agc={agc}
                              onRange={(range) =>
                                setTracks((old) => ({
                                  ...old,
                                  [k]: { ...old[k], range },
                                }))
                              }
                            />
                            <div className="track-source">
                              LF {t.lf + 1}
                              {translate("· Frame")} {t.frame.name} ·{" "}
                              {t.result.frameCount} {translate("amostras")}
                            </div>
                          </>
                        ) : (
                          <div className="track-unavailable">
                            <FileSearch size={24} />
                            {decoding[k] ? (
                              <p role="status">
                                {translate(
                                  "Decodificando canais selecionados…",
                                )}
                              </p>
                            ) : (
                              <p role={trackErrors[k] ? "alert" : undefined}>
                                {trackErrors[k]
                                  ? message(trackErrors[k])
                                  : choices[k]
                                    ? translate(
                                        "Canal não pôde ser desenhado. Confira a configuração de profundidade.",
                                      )
                                    : `${k.startsWith("OTHER") ? translate("Canal") : k} — ${translate("Nenhum canal selecionado")}`}
                              </p>
                            )}
                            <small>
                              {translate("Escolha um canal real do arquivo.")}
                            </small>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <aside className="reading-panel">
                <div className="eyebrow">{translate("LEITURA DO PONTO")}</div>
                {point ? (
                  <>
                    <h3>{point.channel}</h3>
                    <div className="reading-value">
                      {point.rawValue ?? point.rawRepresentation}
                      <small>{point.unit}</small>
                    </div>
                    {point.curve === "VDL" &&
                      tracks.VDL &&
                      point.channelKey === tracks.VDL.channel.key && (
                        <Waveform
                          track={tracks.VDL}
                          sample={point.sampleIndex}
                        />
                      )}
                    <span className="badge">
                      {translate("Valor bruto original")}
                    </span>
                    <dl className="reading-dl">
                      {Object.entries({
                        Profundidade: Number(point.depth).toFixed(4) + " m",
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
                            ? translate("Tempo não disponível nos metadados")
                            : point.timeUs + " µs",
                        Azimute:
                          point.azimuth === null
                            ? translate("Azimute não disponível")
                            : point.azimuth + "°",
                        "Zona USIT": point.zone || translate("Não se aplica"),
                        "Micro-debonding":
                          point.microDebonding ||
                          translate("Não disponível neste arquivo"),
                        "Classificação automática":
                          point.automaticClassification ||
                          translate("Não classificado"),
                      })
                        .filter(
                          ([k]) =>
                            !(
                              (k === "Tempo VDL" && point.curve !== "VDL") ||
                              ([
                                "Azimute",
                                "Zona USIT",
                                "Micro-debonding",
                              ].includes(k) &&
                                point.curve !== "USIT") ||
                              (k === "Classificação automática" &&
                                point.curve !== "CBL")
                            ),
                        )
                        .map(([k, v]) => (
                          <div key={k}>
                            <dt>{message(k)}</dt>
                            <dd>
                              {[
                                "Validade",
                                "Zona USIT",
                                "Micro-debonding",
                                "Classificação automática",
                              ].includes(k)
                                ? message(String(v))
                                : String(v)}
                            </dd>
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
                      <Pin size={15} />
                      {translate("Fixar ponto")}
                    </button>
                  </>
                ) : (
                  <div className="reading-empty">
                    <Pin size={27} />
                    <h3>{translate("Explore uma amostra")}</h3>
                    <p>
                      {translate("Passe o cursor para ler.")}
                      <br />
                      {translate("Clique na curva para fixar.")}
                    </p>
                    <small>
                      {translate(
                        "A leitura vem do array original, antes do ganho visual.",
                      )}
                    </small>
                  </div>
                )}
                <div className="usit-legend">
                  <b>USIT · MRayl</b>
                  <p className="status-label">
                    {translate(
                      "Interpretação provisória; requer validação especializada.",
                    )}
                  </p>
                  {[
                    ["#FF0000", translate("Gás"), translate("0 ≤ Z < 0,3")],
                    [
                      "#00FFFF",
                      translate("Líquido"),
                      translate("0,3 ≤ Z < 2,6"),
                    ],
                    [
                      "linear-gradient(90deg,#FFFFCC,#000)",
                      translate("Cimento"),
                      translate("2,6 ≤ Z < 10"),
                    ],
                    ["#000000", translate("Elevada"), "Z ≥ 10"],
                    ["#008000", translate("Sem leitura"), "−2000"],
                    [
                      "#808080",
                      translate("Inválido"),
                      translate("Z < 0; exceto −2000"),
                    ],
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
              <span>{translate("Selecionar por índice:")}</span>
              <Pick
                label={translate("Track para seleção por índice")}
                value={manualTrack}
                onChange={setManualTrack}
                options={[
                  { value: "", label: translate("Escolha o track") },
                  ...Object.entries(tracks).map(([k, t]) => ({
                    value: k,
                    label: k + " · " + t.channel.name,
                  })),
                ]}
              />
              <label>
                {translate("Sample")}{" "}
                <input
                  type="number"
                  min="0"
                  value={sample}
                  onChange={(e) => setSample(Number(e.target.value))}
                />
              </label>
              <label>
                {translate("Component")}{" "}
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
                {translate("Fixar amostra")}
              </button>
            </div>
            <div className="section-heading">
              <div>
                <h2>
                  {translate("Pontos selecionados")}{" "}
                  <span className="badge">{points.length}</span>
                </h2>
                <span className="status-label">
                  {dirty
                    ? translate("Alterações ainda não salvas")
                    : savedAt
                      ? translate("Salvo em ") +
                        new Date(savedAt).toLocaleString(locale)
                      : translate("Fixe pontos e salve sua análise na conta.")}
                </span>
              </div>
              <div className="row">
                <Pick
                  label={translate("Formato de exportação")}
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
                  <Download size={16} />
                  {translate("Exportar")}
                </button>
                <button
                  className="button primary"
                  disabled={!!busy}
                  onClick={save}
                >
                  <Save size={16} />
                  {translate("Salvar análise")}
                </button>
              </div>
            </div>
            <div className="analysis-toolbar">
              <label className="inline-field">
                {translate("Nome da análise")}{" "}
                <input
                  value={analysisName}
                  onChange={(e) => {
                    setAnalysisName(e.target.value);
                    setDirty(true);
                  }}
                />
              </label>
              <Pick
                label={translate("Recuperar análise salva")}
                value={analysisId}
                onChange={restore}
                options={[
                  { value: "", label: translate("Recuperar análise salva") },
                  ...analyses.map((a) => ({
                    value: a.id,
                    label:
                      a.name + " · " + a.points.length + translate(" pontos"),
                  })),
                ]}
              />
              <button
                className="button compact"
                disabled={dirty}
                onClick={() => {
                  setPoints([]);
                  setRegions([]);
                  setAnalysisId("");
                  setAnalysisName("Nova análise");
                  setSavedAt("");
                  setDirty(false);
                }}
              >
                {translate("Nova análise")}
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
                  {translate(
                    "Nenhum ponto fixado. Clique em uma curva ou selecione por índice.",
                  )}
                </p>
              )}
            </div>
            <div className="viewer-audit">
              <Info size={14} />
              <span>
                SHA-256 <span className="hash">{meta.hash}</span>
                {translate(
                  "· Índices base 0 · Profundidade em metros, convertida da unidade declarada no arquivo.",
                )}
              </span>
            </div>
          </>
        )
      )}
      <Dialog open={metadataOpen} onOpenChange={setMetadataOpen}>
        <DialogContent className="large-dialog">
          <DialogHeader>
            <DialogTitle>{translate("Metadados e auditoria")}</DialogTitle>
            <DialogDescription>
              {file?.name} · {file && formatBytes(file.size, locale)} · RP66{" "}
              {meta?.version}
            </DialogDescription>
          </DialogHeader>
          {meta?.warnings.map((w: string, i: number) => (
            <div className="notice warning" key={i}>
              {message(w)}
            </div>
          ))}
          {meta?.logicalFiles.map((lf: any) => (
            <section key={lf.index}>
              <h3>
                {translate("Logical file")}
                {lf.index + 1} · {lf.id || translate("ID não informado")}
              </h3>
              <dl className="meta-grid">
                {Object.entries(lf.origin || {}).map(([k, v]) => (
                  <div key={k}>
                    <dt>{message(k)}</dt>
                    <dd>
                      {v === null || v === ""
                        ? translate("Não informado")
                        : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
              {lf.frames.map((f: any) => (
                <details key={f.key}>
                  <summary>
                    {translate("Frame")}
                    {f.name} · {f.channels.length}
                    {translate("canais ·")}
                    {f.indexType}
                  </summary>
                  <Table className="technical-table">
                    <TableHeader>
                      <TableRow>
                        {[
                          translate("Canal"),
                          translate("Descrição"),
                          translate("Unidade"),
                          translate("Dimensão"),
                          translate("Chave"),
                          translate("Sugestão"),
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
                              : translate("Descrição estruturada")}
                          </TableCell>
                          <TableCell>
                            {c.units || translate("Não informada")}
                          </TableCell>
                          <TableCell>{c.dimension.join("×")}</TableCell>
                          <TableCell>{c.key}</TableCell>
                          <TableCell>
                            {c.kind === "OTHER"
                              ? translate("Não identificado")
                              : c.kind}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              ))}
              <details>
                <summary>
                  {translate("Parâmetros (")}
                  {lf.parameters.length})
                </summary>
                <pre>{JSON.stringify(lf.parameters, null, 2)}</pre>
              </details>
            </section>
          ))}
        </DialogContent>
      </Dialog>
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="large-dialog">
          <DialogHeader>
            <DialogTitle>{translate("Configurar tracks e eixos")}</DialogTitle>
            <DialogDescription>
              {translate(
                "Cada track pode usar seu próprio frame. Todos compartilham a profundidade em metros; não há interpolação entre frames.",
              )}
            </DialogDescription>
          </DialogHeader>
          {trackKinds.map((k) => {
            const o = opts.find((o: any) => o.value === choices[k]),
              t = tracks[k];
            return (
              <div className="panel stack" key={k}>
                <b>{k}</b>
                <Pick
                  label={translate("Canal ") + k}
                  value={choices[k] || ""}
                  onChange={(v) => setTrack(k, v)}
                  options={[none, ...opts]}
                />
                {o && (
                  <>
                    <label className="form-field">
                      {translate("Canal de profundidade")}{" "}
                      <Pick
                        label={translate("Profundidade ") + k}
                        value={t?.depthName || ""}
                        onChange={(v) => setTrack(k, choices[k], meta, v)}
                        options={[
                          {
                            value: "",
                            label: translate("Selecione a profundidade"),
                          },
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
                          ? translate(
                              "Canal do tempo (um valor por componente, em µs)",
                            )
                          : translate(
                              "Canal de azimute (um valor por setor, em graus)",
                            )}
                        <Pick
                          label={translate("Eixo ") + k}
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
                              label: translate(
                                "Não disponível / sem associação",
                              ),
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
                          {translate(
                            "Associe somente se a documentação do arquivo confirmar a correspondência componente a componente.",
                          )}
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
            <Plus size={16} />
            {translate("Adicionar outra curva")}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={calibrationOpen} onOpenChange={setCalibrationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {translate("Referência de free pipe · CBL")}
            </DialogTitle>
            <DialogDescription>
              {translate(
                "Não existem limites universais. A referência e os limiares abaixo ficam registrados com cada ponto classificado.",
              )}
            </DialogDescription>
          </DialogHeader>
          <label className="form-field">
            {translate("Amplitude de referência (mV)")}
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
          <div className="status-label">
            {translate("Origem:")}
            {calibration.source}
          </div>
          <div className="form-grid">
            <label className="form-field">
              {translate("Bom: amplitude / referência ≤")}
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
              {translate("Ruim: amplitude / referência ≥")}
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
            {translate(
              "Moderado entre os limiares. Sem referência e limiares válidos, a classificação automática fica indisponível. Novos parâmetros afetam apenas os próximos pontos.",
            )}
          </p>
        </DialogContent>
      </Dialog>
      <AlertDialog open={closeRequested} onOpenChange={setCloseRequested}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{translate("Fechar arquivo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {translate(
                "Há pontos ou alterações não salvos. Salve a análise para recuperá-los depois.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {translate("Voltar e salvar")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCloseRequested(false);
                closeFile();
              }}
            >
              {translate("Descartar e fechar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!pendingFile}
        onOpenChange={(open) => {
          if (!open) setPendingFile(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {translate("Trocar de arquivo?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {translate(
                "Há pontos ou alterações não salvos. Salve a análise para recuperá-los depois.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {translate("Voltar e salvar")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingFile) loadFile(pendingFile);
                setPendingFile(null);
              }}
            >
              {translate("Descartar e abrir")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
