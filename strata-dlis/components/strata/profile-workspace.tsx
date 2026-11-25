"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Minus, Plus, Play, Pause, Ruler } from "lucide-react";
import { useI18n, useDarkTheme } from "@/lib/i18n/provider";
import { boundedInterval, nearestSample, validity } from "@/lib/dlis/core.js";
import type { Track } from "@/lib/dlis/plotting";
import type { DlisMetadata } from "@/lib/dlis/types";
import {
  defaultScale,
  visiblePaths,
  fraction,
  type Scale,
} from "@/lib/dlis/profile-curves";
import {
  compatiblePair,
  depthWidth,
  faciesColors,
  laneWidth,
  makeSheet,
  paintSheet,
  plotHeight,
  plotTop,
  type Column,
  type Mark,
  type SheetOptions,
} from "@/lib/dlis/profile-sheet";
import { ComparisonSource, type LoadedWell } from "./comparison-source";
import type { MessageKey } from "@/lib/i18n";
import { toast } from "sonner";

type WindowRange = [number, number];
const rocks: Record<string, MessageKey> = {
  sandstone: "Arenito",
  shale: "Folhelho",
  limestone: "Calcário",
  dolomite: "Dolomito",
  other: "Outra litologia",
};
function SheetView({
  column,
  options,
  cursor,
  onCursor,
  onPan,
  onZoom,
  onMeasure,
  ruler,
}: {
  column: Column;
  options: SheetOptions;
  cursor: number | null;
  onCursor: (d: number | null) => void;
  onPan: (d: number) => void;
  onZoom: (factor: number, ratio: number) => void;
  onMeasure: (d: number) => void;
  ruler: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    drag = useRef<{ y: number; moved: boolean } | null>(null);
  const { translate: t, number } = useI18n();
  const [componentRatio, setComponentRatio] = useState<{
    id: string;
    ratio: number;
  } | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const sheet = useMemo(() => makeSheet(column, options), [column, options]);
  const { from, to } = options,
    span = to - from;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    c.width = Math.round(sheet.width * ratio);
    c.height = Math.round(sheet.height * ratio);
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      paintSheet(ctx, sheet);
    }
  }, [sheet]);
  const handlers = useRef(onZoom);
  useEffect(() => {
    handlers.current = onZoom;
  }, [onZoom]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const wheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      e.preventDefault();
      handlers.current(
        e.deltaY > 0 ? 1.2 : 0.82,
        Math.min(
          1,
          Math.max(
            0,
            (e.clientY - c.getBoundingClientRect().top - plotTop) / plotHeight,
          ),
        ),
      );
    };
    c.addEventListener("wheel", wheel, { passive: false });
    return () => c.removeEventListener("wheel", wheel);
  }, []);
  function at(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect(),
      y = e.clientY - rect.top - plotTop,
      x = e.clientX - rect.left - depthWidth;
    if (y < 0 || y > plotHeight) return null;
    const track = column.tracks[Math.floor(x / laneWidth)];
    setComponentRatio(
      track?.stride > 1
        ? { id: track.id, ratio: (x % laneWidth) / laneWidth }
        : null,
    );
    return from + (y / plotHeight) * span;
  }
  return (
    <section className="profile-column" aria-label={column.name}>
      <div
        className="sheet-scroll"
        onScroll={(e) => setScrolled(e.currentTarget.scrollLeft > 2)}
      >
        <div style={{ width: sheet.width, position: "relative" }}>
          {scrolled && (
            <div
              className="fixed-depth"
              aria-hidden="true"
              style={{ width: depthWidth }}
            >
              <svg
                viewBox={
                  "0 0 " + depthWidth + " " + (plotTop + plotHeight + 20)
                }
                height={plotTop + plotHeight + 20}
                width={depthWidth}
              >
                <rect width="100%" height="100%" fill="var(--card)" />
                <text x="7" y="45">
                  {options.depthLabel}
                </text>
                <text x="7" y="64">
                  m
                </text>
                {Array.from({ length: 11 }, (_, i) => (
                  <text x="7" y={plotTop + (i * plotHeight) / 10 + 3} key={i}>
                    {number(from + (span * i) / 10, {
                      maximumFractionDigits: 2,
                    })}
                  </text>
                ))}
              </svg>
            </div>
          )}
          <canvas
            ref={ref}
            role="img"
            tabIndex={0}
            aria-label={t("Perfil por profundidade") + " · " + column.name}
            style={{
              width: sheet.width,
              height: sheet.height,
              touchAction: "pan-x",
            }}
            onKeyDown={(e) => {
              const step = span / 100;
              switch (e.key) {
                case "ArrowDown":
                case "ArrowUp":
                  e.preventDefault();
                  onCursor(
                    Math.max(
                      from,
                      Math.min(
                        to,
                        (cursor ?? (from + to) / 2) +
                          (e.key === "ArrowDown" ? step : -step),
                      ),
                    ),
                  );
                  break;
                case "PageDown":
                case "PageUp":
                  e.preventDefault();
                  onPan((e.key === "PageDown" ? 1 : -1) * span * 0.8);
                  break;
                case "+":
                case "=":
                case "-":
                  e.preventDefault();
                  onZoom(e.key === "-" ? 1.3 : 0.7, 0.5);
                  break;
                case "Enter":
                  if (ruler) {
                    e.preventDefault();
                    onMeasure(cursor ?? (from + to) / 2);
                  }
                  break;
              }
            }}
            onPointerDown={(e) => {
              if (at(e) === null) return;
              drag.current = { y: e.clientY, moved: false };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = at(e);
              if (d === null) return;
              if (drag.current && Math.abs(e.clientY - drag.current.y) > 2) {
                onPan((-(e.clientY - drag.current.y) / plotHeight) * span);
                drag.current = { y: e.clientY, moved: true };
              } else onCursor(d);
            }}
            onPointerUp={(e) => {
              const d = at(e);
              if (!drag.current?.moved && d !== null) {
                onCursor(d);
                if (ruler) onMeasure(d);
              }
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          />
          {cursor !== null && cursor >= from && cursor <= to && (
            <div
              className="profile-crosshair"
              style={{ top: plotTop + ((cursor - from) / span) * plotHeight }}
            />
          )}
        </div>
      </div>
      {cursor !== null && (
        <dl className="profile-readings">
          <div>
            <dt>{t("Profundidade")}</dt>
            <dd>{number(cursor, { maximumFractionDigits: 3 })} m</dd>
          </div>
          {column.tracks.map((track) => {
            const id = nearestSample(
              track.depth,
              track.index,
              cursor,
              track.index.step * 0.55 || 1e-6,
            );
            const c =
              track.stride === 1
                ? 0
                : componentRatio?.id === track.id
                  ? Math.min(
                      track.stride - 1,
                      Math.floor(componentRatio.ratio * track.stride),
                    )
                  : Math.floor(track.stride / 2);
            const value =
              id === null || c === null
                ? NaN
                : track.result.data[track.channel.name][id * track.stride + c];
            return (
              <div
                key={track.id}
                data-channel={track.channel.name}
                data-lf={track.lf}
                data-frame={track.frame.key}
                data-component={c}
                data-unit={track.channel.units}
              >
                <dt>
                  {track.channel.name}
                  {c !== null && track.stride > 1 ? " [" + c + "]" : ""}
                </dt>
                <dd>
                  {validity(value) === "Válido"
                    ? number(value, { maximumSignificantDigits: 8 }) +
                      " " +
                      track.channel.units
                    : "—"}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
}
function Minimap({
  track,
  full,
  range,
  onMove,
}: {
  track?: Track;
  full: WindowRange;
  range: WindowRange;
  onMove: (start: number) => void;
}) {
  const { translate: t } = useI18n(),
    size = full[1] - full[0],
    width = range[1] - range[0];
  const line = useMemo(() => {
    if (!track) return "";
    const data = track.result.data[track.channel.name];
    return visiblePaths(track, full[0], full[1], 400, "linear")
      .map((ids) =>
        Array.from(
          ids,
          (id, i) =>
            (i ? "L" : "M") +
            (((track.depth[id] - full[0]) / size) * 800).toFixed(1) +
            " " +
            (28 - fraction(data[id], track.range, "linear") * 25).toFixed(1),
        ).join(" "),
      )
      .join(" ");
  }, [track, full, size]);
  return (
    <label className="profile-minimap">
      <span>{t("Minimapa de profundidade")}</span>
      <svg viewBox="0 0 800 32" preserveAspectRatio="none" aria-hidden="true">
        <path d={line} fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect
          x={((range[0] - full[0]) / size) * 800}
          width={(width / size) * 800}
          y="1"
          height="30"
        />
      </svg>
      <input
        aria-label={t("Mover intervalo em profundidade")}
        type="range"
        min={full[0]}
        max={Math.max(full[0], full[1] - width)}
        step="any"
        value={range[0]}
        onChange={(e) => onMove(Number(e.target.value))}
      />
    </label>
  );
}
export function ProfileWorkspace({
  active,
  filename,
  metadata,
  tracks,
  initial,
  agc,
}: {
  active: boolean;
  filename: string;
  metadata: DlisMetadata;
  tracks: Record<string, Track>;
  initial: WindowRange;
  agc: boolean;
}) {
  const { translate: t } = useI18n(),
    [selected, setSelected] = useState("");
  const groups = useMemo(() => {
    const entries = new Map<
      string,
      { name: string; tracks: Record<string, Track> }
    >();
    for (const [kind, track] of Object.entries(tracks)) {
      const lf = metadata.logicalFiles.find((l) => l.index === track.lf);
      const well = lf?.origin?.wellName || filename + " · LF " + (track.lf + 1);
      const basis = track.frame.indexType || track.depthName,
        key = well + " · " + basis;
      if (!entries.has(key)) entries.set(key, { name: key, tracks: {} });
      entries.get(key)!.tracks[kind] = track;
    }
    return entries;
  }, [filename, metadata, tracks]);
  const key = groups.has(selected) ? selected : groups.keys().next().value;
  if (!key) return null;
  const group = groups.get(key)!;
  return (
    <>
      {groups.size > 1 && (
        <label className="form-field">
          {t("Poço e índice")}
          <select value={key} onChange={(e) => setSelected(e.target.value)}>
            {[...groups.keys()].map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      )}
      <ProfileControls
        active={active}
        key={key}
        name={group.name}
        tracks={group.tracks}
        initial={initial}
        agc={agc}
      />
    </>
  );
}
function ProfileControls({
  active,
  name,
  tracks,
  initial,
  agc,
}: {
  active: boolean;
  name: string;
  tracks: Record<string, Track>;
  initial: WindowRange;
  agc: boolean;
}) {
  const { translate: t, number, locale } = useI18n(),
    dark = useDarkTheme();
  const primary = useMemo(() => Object.values(tracks), [tracks]);
  const [second, setSecond] = useState<LoadedWell | null>(null),
    [compare, setCompare] = useState(false),
    [accessible, setAccessible] = useState(false),
    [cross, setCross] = useState(true);
  const [scales, setScales] = useState<Record<string, Scale>>({}),
    [cursor, setCursor] = useState<number | null>(null);
  const [targetDepth, setTargetDepth] = useState("");
  const [marks, setMarks] = useState<Mark[]>([]),
    [showMarks, setShowMarks] = useState(false),
    [rock, setRock] = useState(""),
    [markName, setMarkName] = useState("");
  const [markFrom, setMarkFrom] = useState(""),
    [markTo, setMarkTo] = useState("");
  const [ruler, setRuler] = useState(false),
    [measure, setMeasure] = useState<number[]>([]),
    [playing, setPlaying] = useState(false),
    [exporting, setExporting] = useState(false);
  const [chosen, setChosen] = useState<WindowRange | null>(
    initial[1] > initial[0] ? initial : null,
  );
  const columns = useMemo(
    () => [
      {
        name,
        tracks: primary,
        marks: marks.map((m) => ({
          ...m,
          legend: m.lithology ? t(rocks[m.lithology]) : t("Topo de formação"),
        })),
      },
      ...(compare && second ? [{ ...second, marks: [] }] : []),
    ],
    [name, primary, marks, compare, second, t],
  );
  const full = useMemo<WindowRange>(() => {
    let lo = Infinity,
      hi = -Infinity;
    for (const c of [primary, ...(compare && second ? [second.tracks] : [])])
      for (const t of c) {
        const ids = t.index.indices;
        if (ids.length) {
          lo = Math.min(lo, t.depth[ids[0]]);
          hi = Math.max(hi, t.depth[ids[ids.length - 1]]);
        }
      }
    return Number.isFinite(lo) ? [lo, hi > lo ? hi : lo + 1] : [0, 1];
  }, [primary, compare, second]);
  const primaryLimits = useMemo(() => {
    const bounds = primary
      .filter((t) => t.index.indices.length)
      .map((t) => [
        t.depth[t.index.indices[0]],
        t.depth[t.index.indices[t.index.indices.length - 1]],
      ]);
    return [
      Math.min(...bounds.map((b) => b[0])),
      Math.max(...bounds.map((b) => b[1])),
    ];
  }, [primary]);
  const range = ((chosen && boundedInterval(chosen[0], chosen[1], full)) ||
    full) as WindowRange;
  const [from, to] = range,
    span = to - from;
  const options = useMemo<SheetOptions>(
    () => ({
      from,
      to,
      dark,
      accessible,
      agc,
      scales,
      locale,
      crossover: cross,
      depthLabel: t("Profundidade"),
      crossLabel: t("Crossover"),
      indexLabel: t("Índice da amostra"),
      linearLabel: t("Linear"),
      logLabel: "log₁₀",
    }),
    [from, to, dark, accessible, agc, scales, locale, cross, t],
  );
  const move = (a: number, b: number) => {
    const next = boundedInterval(a, b, full);
    if (next) {
      setPlaying(false);
      setChosen(next as WindowRange);
    }
  };
  const zoom = (f: number, ratio = 0.5) => {
    const anchor = from + span * ratio;
    move(anchor - span * f * ratio, anchor + span * f * (1 - ratio));
  };
  const playRef = useRef({ from, to, full });
  useEffect(() => {
    playRef.current = { from, to, full };
  }, [from, to, full]);
  useEffect(() => {
    if (!active || !playing) return;
    let id = 0;
    const state = playRef.current,
      extent = state.full[1] - state.full[0],
      width =
        state.to - state.from >= extent * 0.999
          ? extent * 0.2
          : state.to - state.from;
    const start =
        state.from + width >= state.full[1] ? state.full[0] : state.from,
      started = performance.now();
    let last = 0;
    const tick = (now: number) => {
      if (now - last >= 40) {
        const a = Math.min(
          state.full[1] - width,
          start + ((now - started) * width) / 14000,
        );
        setChosen([a, a + width]);
        last = now;
        if (a >= state.full[1] - width) {
          setPlaying(false);
          return;
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing, active]);
  const loadSecond = useCallback((well: LoadedWell | null) => {
    setSecond(well);
    setPlaying(false);
    if (well) setChosen(null);
  }, []);
  function addMark() {
    const a = Number(markFrom),
      b = rock ? Number(markTo) : a;
    if (
      !markName.trim() ||
      !markFrom.trim() ||
      (rock && !markTo.trim()) ||
      !Number.isFinite(a) ||
      !Number.isFinite(b) ||
      (rock && b <= a) ||
      a < primaryLimits[0] ||
      b > primaryLimits[1]
    ) {
      toast.error(t("Confira o nome e os limites do marcador."));
      return;
    }
    setMarks((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        name: markName.trim(),
        from: a,
        to: b,
        lithology: rock,
      },
    ]);
    setMarkName("");
  }
  async function download(format: "svg" | "pdf" | "png") {
    setExporting(true);
    try {
      const { exportProfile } = await import("@/lib/dlis/profile-export");
      await exportProfile(columns, options, format);
    } catch {
      toast.error(t("Falha ao exportar o perfil."));
    } finally {
      setExporting(false);
    }
  }
  return (
    <section className="profile-panel" aria-label={t("Perfil composto")}>
      <div className="profile-actions">
        <button
          className="icon-button"
          aria-label={t("Aproximar perfil")}
          onClick={() => zoom(0.65)}
        >
          <Plus size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={t("Afastar perfil")}
          onClick={() => zoom(1.4)}
        >
          <Minus size={16} />
        </button>
        <button
          className="button compact"
          onClick={() => {
            setChosen(null);
            setPlaying(false);
          }}
        >
          {t("Toda a profundidade")}
        </button>
        <button
          className="button compact"
          aria-pressed={playing}
          onClick={() => setPlaying((v) => !v)}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}{" "}
          {t("Modo apresentação")}
        </button>
        <button
          className="button compact"
          aria-pressed={ruler}
          onClick={() => {
            setRuler((v) => !v);
            setMeasure([]);
          }}
        >
          <Ruler size={15} />
          {t("Régua")}
        </button>
        <button
          className="button compact"
          aria-pressed={compare}
          onClick={() => {
            setCompare((v) => !v);
            loadSecond(null);
          }}
        >
          {t("Comparar poços")}
        </button>
        <button
          className="button compact"
          aria-expanded={showMarks}
          onClick={() => setShowMarks((v) => !v)}
        >
          {t("Formações e litologia")}
        </button>
      </div>
      <form
        className="profile-depth-search"
        onSubmit={(e) => {
          e.preventDefault();
          const d = Number(targetDepth);
          if (
            !targetDepth.trim() ||
            !Number.isFinite(d) ||
            d < full[0] ||
            d > full[1]
          )
            return;
          if (d < from || d > to) move(d - span / 2, d + span / 2);
          setCursor(d);
        }}
      >
        <label>
          {t("Consultar profundidade (m)")}{" "}
          <input
            type="number"
            step="any"
            min={full[0]}
            max={full[1]}
            value={targetDepth}
            onChange={(e) => setTargetDepth(e.target.value)}
          />
        </label>
        <button className="button compact" type="submit">
          {t("Consultar")}
        </button>
      </form>
      <Minimap
        track={primary.find((t) => t.stride === 1)}
        full={full}
        range={range}
        onMove={(v) => move(v, v + span)}
      />
      {compare && (
        <>
          <ComparisonSource onChange={loadSecond} />
          <p className="status-label">
            {t(
              "Comparação pela profundidade numérica em metros. Confira o datum e o tipo de índice dos dois poços.",
            )}
          </p>
        </>
      )}
      {ruler && (
        <output className="profile-ruler">
          {measure.length === 2
            ? "Δ " +
              number(Math.abs(measure[1] - measure[0]), {
                maximumFractionDigits: 3,
              }) +
              " m · " +
              measure
                .map((n) => number(n, { maximumFractionDigits: 3 }))
                .join(" → ")
            : t("Marque duas profundidades com clique ou Enter.") +
              (measure.length ? " · " + number(measure[0]) + " m" : "")}
        </output>
      )}
      {showMarks && (
        <fieldset className="profile-fields">
          <legend>
            {t("Interpretação manual")} · {name}
          </legend>
          <label>
            {t("Nome da formação")}
            <input
              value={markName}
              maxLength={85}
              onChange={(e) => setMarkName(e.target.value)}
            />
          </label>
          <label>
            {t("Litologia")}
            <select
              aria-label={t("Litologia")}
              value={rock}
              onChange={(e) => setRock(e.target.value)}
            >
              <option value="">{t("Topo de formação")}</option>
              {Object.keys(rocks).map((k) => (
                <option key={k} value={k}>
                  {t(rocks[k])}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("De (m)")}
            <input
              type="number"
              step="any"
              value={markFrom}
              onChange={(e) => setMarkFrom(e.target.value)}
            />
          </label>
          {rock && (
            <label>
              {t("Até (m)")}
              <input
                type="number"
                step="any"
                value={markTo}
                onChange={(e) => setMarkTo(e.target.value)}
              />
            </label>
          )}
          <button className="button compact" onClick={addMark}>
            {t("Adicionar marcador")}
          </button>
          {marks.map((m) => (
            <div key={m.id}>
              <span
                style={{
                  borderLeft:
                    "5px solid " +
                    (faciesColors[m.lithology] || "currentColor"),
                  paddingLeft: 5,
                }}
              >
                {m.name} ·{" "}
                {m.lithology ? t(rocks[m.lithology]) : t("Topo de formação")} ·{" "}
                {number(m.from)}–{number(m.to)} m
              </span>{" "}
              <button
                onClick={() => setMarks((v) => v.filter((x) => x.id !== m.id))}
              >
                {t("Remover")}
              </button>
            </div>
          ))}
        </fieldset>
      )}
      <details className="profile-settings">
        <summary>{t("Escalas e paleta")}</summary>
        <label>
          <input
            type="checkbox"
            checked={accessible}
            onChange={(e) => setAccessible(e.target.checked)}
          />{" "}
          {t("Paleta para daltonismo")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={cross}
            onChange={(e) => setCross(e.target.checked)}
          />{" "}
          {t("Crossover densidade–nêutron")}
        </label>
        {cross && columns.some((c) => compatiblePair(c.tracks)) && (
          <p>
            {t(
              "Escalas de referência em calcário. Confira a matriz de calibração da ferramenta antes de interpretar o crossover.",
            )}
          </p>
        )}
        {cross && !columns.some((c) => compatiblePair(c.tracks)) && (
          <p>
            {t(
              "O crossover exige densidade e porosidade neutrônica com unidades compatíveis no mesmo frame.",
            )}
          </p>
        )}
        {columns.map((c) => (
          <div key={c.tracks[0]?.id} className="profile-fields">
            {c.tracks
              .filter((t) => t.stride === 1)
              .map((track) => (
                <label key={track.id}>
                  {track.channel.name} [{track.channel.units || "—"}]
                  <select
                    aria-label={
                      t("Escala visual") +
                      " " +
                      track.channel.name +
                      " · " +
                      c.name
                    }
                    value={scales[track.id] || defaultScale(track)}
                    onChange={(e) =>
                      setScales((v) => ({
                        ...v,
                        [track.id]: e.target.value as Scale,
                      }))
                    }
                  >
                    <option value="linear">{t("Linear")}</option>
                    <option value="log" disabled={track.rawRange[1] <= 0}>
                      {t("Logarítmica")}
                    </option>
                  </select>
                </label>
              ))}
          </div>
        ))}
      </details>
      <div className={"profile-columns" + (compare && second ? " paired" : "")}>
        {columns.map((col, i) => (
          <SheetView
            key={i}
            column={col}
            options={options}
            cursor={cursor}
            onCursor={setCursor}
            onPan={(d) => move(from + d, to + d)}
            onZoom={zoom}
            ruler={ruler}
            onMeasure={(d) =>
              setMeasure((v) => (v.length === 1 ? [v[0], d] : [d]))
            }
          />
        ))}
      </div>
      <div className="profile-exports">
        <Download size={16} />
        <span>{t("Exportar perfil")}</span>
        {(["png", "svg", "pdf"] as const).map((format) => (
          <button
            className="button compact"
            disabled={exporting || !primary.length}
            key={format}
            onClick={() => void download(format)}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
    </section>
  );
}
