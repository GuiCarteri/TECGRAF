"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  labels,
  bounds,
  box,
  validateRegions,
  type Region,
} from "@/lib/dlis/regions";
import type { Track } from "@/lib/dlis/plotting";
import { useI18n } from "@/lib/i18n/provider";
export function RegionEditor({
  track,
  hash,
  from,
  to,
  regions,
  onChange,
}: {
  track: Track;
  hash: string;
  from: number;
  to: number;
  regions: Region[];
  onChange: (r: Region[]) => void;
}) {
  const { translate: t } = useI18n();
  const [mode, setMode] = useState("navigate"),
    [label, setLabel] = useState("Revisar"),
    [draft, setDraft] = useState<ReturnType<typeof bounds> | null>(null);
  const [undo, setUndo] = useState<Region[] | null>(null);
  const drag = useRef<[number, number] | null>(null);
  const scope = JSON.stringify([
    track.lf,
    track.frame.key || track.frame.name,
    track.channel.key || track.channel.name,
  ]);
  const selected = regions.filter(
    (r) =>
      r.track === scope &&
      r.depthName === track.depthName &&
      r.stride === track.stride,
  );
  const change = (next: Region[]) => {
    setUndo(regions);
    onChange(next);
  };
  const coords = (e: React.PointerEvent): [number, number] => {
    const b = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height];
  };
  const add = () => {
    if (!draft) return;
    try {
      if (
        !track.index.indices.some(
          (s: number) =>
            track.depth[s] >= draft.from && track.depth[s] <= draft.to,
        )
      )
        throw Error(t("Sem dados neste intervalo"));
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      change(
        validateRegions(
          [
            ...regions,
            {
              id,
              fileHash: hash,
              track: scope,
              depthName: track.depthName,
              stride: track.stride,
              ...draft,
              label,
              note: "",
            },
          ],
          hash,
        ),
      );
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };
  const save = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { schema: "strata-regions-v1", fileHash: hash, regions },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "strata-regions.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div
        className="annotation-overlay"
        style={{ pointerEvents: mode === "navigate" ? "none" : "auto" }}
        tabIndex={mode === "navigate" ? -1 : 0}
        aria-label={t("Marcar região")}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            drag.current = null;
            setDraft(null);
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = coords(e);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setDraft(
              bounds(
                from,
                to,
                track.stride,
                drag.current,
                coords(e),
                mode === "interval",
              ),
            );
        }}
        onPointerUp={(e) => {
          if (drag.current)
            setDraft(
              bounds(
                from,
                to,
                track.stride,
                drag.current,
                coords(e),
                mode === "interval",
              ),
            );
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDraft(null);
        }}
      >
        {[
          ...selected,
          ...(draft
            ? [{ ...draft, id: "draft", stride: track.stride, label } as Region]
            : []),
        ].map((r) => {
          const b = box(r, from, to);
          return (
            b && (
              <div
                key={r.id}
                className="annotation-box"
                style={{
                  left: b.left + "%",
                  top: b.top + "%",
                  width: b.width + "%",
                  height: b.height + "%",
                }}
              >
                <span>{t(r.label as "Bom")}</span>
              </div>
            )
          );
        })}
      </div>
      <div className="annotation-editor">
        <label>
          {t("Ferramenta")}
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setDraft(null);
            }}
          >
            <option value="navigate">{t("Navegar")}</option>
            <option value="interval">{t("Marcar intervalo")}</option>
            <option value="rectangle">{t("Marcar região")}</option>
          </select>
        </label>
        <label>
          {t("Classe manual")}
          <select value={label} onChange={(e) => setLabel(e.target.value)}>
            {labels.map((l) => (
              <option value={l} key={l}>
                {t(l as "Bom")}
              </option>
            ))}
          </select>
        </label>
        <details>
          <summary>{t("Limites da marcação")}</summary>
          {(["from", "to", "first", "last"] as const).map((k, i) => (
            <label key={k}>
              {
                [
                  t("De (m)"),
                  t("Até (m)"),
                  t("Primeiro componente"),
                  t("Último componente"),
                ][i]
              }
              <input
                type="number"
                step={i < 2 ? "any" : "1"}
                value={draft?.[k] ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...(draft || {
                      from,
                      to,
                      first: 0,
                      last: track.stride - 1,
                    }),
                    [k]: Number(e.target.value),
                  })
                }
              />
            </label>
          ))}
        </details>
        <button className="button compact" disabled={!draft} onClick={add}>
          {t("Adicionar marcação")}
        </button>
        <button
          className="button compact"
          disabled={!undo}
          onClick={() => {
            if (undo) onChange(undo);
            setUndo(null);
          }}
        >
          {t("Desfazer")}
        </button>
        <button className="button compact" onClick={save}>
          {t("Exportar marcações JSON")}
        </button>
        <label>
          {t("Importar marcações JSON")}
          <input
            type="file"
            accept=".json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                if (f.size > 5000000) throw Error("JSON > 5 MB");
                const v = JSON.parse(await f.text());
                if (v.schema !== "strata-regions-v1" || v.fileHash !== hash)
                  throw Error(t("Arquivo incompatível"));
                const added = validateRegions(v.regions, hash);
                change(
                  validateRegions(
                    [
                      ...regions,
                      ...added.filter(
                        (r) => !regions.some((o) => o.id === r.id),
                      ),
                    ],
                    hash,
                  ),
                );
              } catch (err) {
                toast.error(err instanceof Error ? err.message : String(err));
              }
            }}
          />
        </label>
        <p>
          {t(
            "Marcações manuais. Salve a análise ou exporte JSON para preservá-las.",
          )}
        </p>
        {selected.map((r) => (
          <div className="annotation-item" key={r.id}>
            <b>{t(r.label as "Bom")}</b> {r.from.toFixed(3)}–{r.to.toFixed(3)} m
            · [{r.first}–{r.last}]
            <select
              aria-label={t("Classe manual")}
              value={r.label}
              onChange={(e) =>
                change(
                  regions.map((o) =>
                    o.id === r.id ? { ...o, label: e.target.value } : o,
                  ),
                )
              }
            >
              {labels.map((l) => (
                <option value={l} key={l}>
                  {t(l as "Bom")}
                </option>
              ))}
            </select>
            <input
              aria-label={t("Observação")}
              maxLength={2000}
              value={r.note}
              onChange={(e) =>
                change(
                  regions.map((o) =>
                    o.id === r.id ? { ...o, note: e.target.value } : o,
                  ),
                )
              }
            />
            <button
              className="button compact"
              onClick={() => change(regions.filter((o) => o.id !== r.id))}
            >
              {t("Remover")}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
