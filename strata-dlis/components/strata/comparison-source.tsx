"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { DlisClient } from "@/lib/dlis/client";
import { defaultDepthChannel, metersFactor } from "@/lib/dlis/core.js";
import { curveFamily } from "@/lib/dlis/profile-curves";
import { makeTrack, type Track } from "@/lib/dlis/plotting";
import type { DlisMetadata, FrameMetadata } from "@/lib/dlis/types";
import { useI18n } from "@/lib/i18n/provider";

export type LoadedWell = { name: string; tracks: Track[] };
export function ComparisonSource({
  onChange,
}: {
  onChange: (well: LoadedWell | null) => void;
}) {
  const { translate: t, message } = useI18n();
  const client = useRef<DlisClient | null>(null);
  const [source, setSource] = useState<{
    file: File;
    meta: DlisMetadata;
  } | null>(null);
  const [frameKey, setFrame] = useState(""),
    [depth, setDepth] = useState(""),
    [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const frames = useMemo(
    () =>
      source?.meta.logicalFiles.flatMap((lf) =>
        lf.frames.map((frame) => ({
          lf,
          key: lf.index + "|" + frame.key,
          frame,
        })),
      ) || [],
    [source],
  );
  const current = frames.find((f) => f.key === frameKey);
  useEffect(
    () => () => {
      client.current?.destroy();
      client.current = null;
    },
    [],
  );
  function pickFrame(key: string, frame: FrameMetadata) {
    setFrame(key);
    const d = defaultDepthChannel(frame) || "";
    setDepth(d);
    const channels = frame.channels.filter(
      (c) => c.name !== d && c.dimension.filter((n) => n > 1).length <= 1,
    );
    const known = channels.filter(
      (c) => !["OTHER", "DEPTH"].includes(curveFamily(c)),
    );
    setNames((known.length ? known : channels).slice(0, 8).map((c) => c.name));
  }
  async function open(file?: File) {
    client.current?.destroy();
    client.current = null;
    setSource(null);
    onChange(null);
    setError("");
    setBusy(false);
    if (!file) return;
    const reader = new DlisClient();
    client.current = reader;
    setBusy(true);
    try {
      const meta = await reader.parse(file);
      if (client.current !== reader) return;
      const all = meta.logicalFiles.flatMap((lf) =>
        lf.frames.map((frame) => ({
          lf,
          key: lf.index + "|" + frame.key,
          frame,
        })),
      );
      const first =
        all.find(
          (f) =>
            defaultDepthChannel(f.frame) &&
            f.frame.channels.some(
              (c) => !["DEPTH", "OTHER"].includes(curveFamily(c)),
            ),
        ) || all[0];
      if (!first) throw Error("Nenhum frame disponível");
      setSource({ file, meta });
      pickFrame(first.key, first.frame);
    } catch (e) {
      if (client.current === reader)
        setError(e instanceof Error ? e.message : "UNKNOWN_ERROR");
    } finally {
      if (client.current === reader) setBusy(false);
    }
  }
  useEffect(() => {
    const reader = client.current;
    let active = true;
    onChange(null);
    if (!current || !reader || !source) return;
    if (!depth || !names.length) return;
    reader
      .decode(current.lf.index, current.frame.key, [
        ...new Set([depth, ...names]),
      ])
      .then((result) => {
        if (!active) return;
        const tracks = current.frame.channels
          .filter((c) => names.includes(c.name))
          .map((c) =>
            makeTrack(
              "comparison|" + current.key + "|" + c.key,
              curveFamily(c),
              current.lf.index,
              current.frame,
              c,
              result,
              depth,
            ),
          );
        onChange({
          name:
            (current.lf.origin?.wellName || source.file.name) +
            " · " +
            (current.frame.indexType || depth),
          tracks,
        });
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [current, source, depth, names, onChange]);
  return (
    <div className="comparison-settings">
      <label>
        {t("Segundo arquivo DLIS")}{" "}
        <input
          type="file"
          accept=".dlis,.DLIS"
          onChange={(e) => void open(e.target.files?.[0])}
        />
      </label>
      {source && current && (
        <>
          <label>
            {t("Arquivo lógico e frame")}{" "}
            <select
              value={frameKey}
              onChange={(e) => {
                const v = frames.find((f) => f.key === e.target.value)!;
                pickFrame(v.key, v.frame);
              }}
            >
              {frames.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.lf.index + 1} · {f.frame.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Canal de profundidade")}{" "}
            <select value={depth} onChange={(e) => setDepth(e.target.value)}>
              <option value="">—</option>
              {current.frame.channels
                .filter(
                  (c) =>
                    c.dimension.every((n) => n === 1) &&
                    metersFactor(c.units) !== null,
                )
                .map((c) => (
                  <option key={c.key}>{c.name}</option>
                ))}
            </select>
          </label>
          <details>
            <summary>{t("Curvas atuais")}</summary>
            <div className="comparison-channels">
              {current.frame.channels
                .filter(
                  (c) =>
                    c.dimension.filter((n) => n > 1).length <= 1 &&
                    c.name !== depth,
                )
                .map((c) => (
                  <label key={c.key}>
                    <input
                      type="checkbox"
                      checked={names.includes(c.name)}
                      onChange={(e) =>
                        setNames((v) =>
                          e.target.checked
                            ? [...v, c.name]
                            : v.filter((n) => n !== c.name),
                        )
                      }
                    />
                    {c.name} [{c.units || "—"}]
                  </label>
                ))}
            </div>
          </details>
        </>
      )}
      {busy && <span role="status">{t("Carregando…")}</span>}
      {error && <span role="alert">{message(error)}</span>}
    </div>
  );
}
