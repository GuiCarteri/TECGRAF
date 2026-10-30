"use client";
import { useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n/provider";
import { exportTrackPNG, type Track } from "@/lib/dlis/plotting";
export function TrackTools({
  track,
  from,
  to,
  agc,
  onRange,
}: {
  track: Track;
  from: number;
  to: number;
  agc: boolean;
  onRange: (range: number[]) => void;
}) {
  const { translate, message } = useI18n();
  const [lo, setLo] = useState(String(track.range[0])),
    [hi, setHi] = useState(String(track.range[1]));
  const automatic = () => {
    const [a, b] = track.rawRange;
    const range = a === b ? [a - 1, b + 1] : [a, b];
    onRange(range);
    setLo(String(range[0]));
    setHi(String(range[1]));
  };
  return (
    <div className="track-tools">
      {track.stride > 1 && (
        <div className="intensity-legend">
          <span>
            {track.kind === "USIT"
              ? "0 · 0.3 · 2.6 · 10 MRayl"
              : agc
                ? translate("AGC relativo; não altera os dados")
                : `${track.range[0].toPrecision(3)} — ${track.range[1].toPrecision(3)} ${track.channel.units}`}
          </span>
          <i
            style={{
              background:
                track.kind === "USIT"
                  ? "linear-gradient(90deg,#ff0000 0% 3%,#00ffff 3% 26%,#ffffcc 26%,#000 100%)"
                  : "linear-gradient(90deg,#fff,#000)",
            }}
          />
          <small>
            {translate(
              "Cinza: sem dados. Eixo por índice quando não há coordenadas confirmadas.",
            )}
          </small>
        </div>
      )}
      {track.kind !== "USIT" && (
        <details>
          <summary>{translate("Escala visual")}</summary>
          <div className="range-fields">
            <label>
              Min
              <input
                aria-label={`${track.kind} min`}
                type="number"
                step="any"
                value={lo}
                onChange={(e) => setLo(e.target.value)}
              />
            </label>
            <label>
              Max
              <input
                aria-label={`${track.kind} max`}
                type="number"
                step="any"
                value={hi}
                onChange={(e) => setHi(e.target.value)}
              />
            </label>
          </div>
          <div className="row">
            <button
              className="button compact"
              onClick={() => {
                const a = Number(lo),
                  b = Number(hi);
                if (
                  lo !== "" &&
                  hi !== "" &&
                  Number.isFinite(a) &&
                  Number.isFinite(b) &&
                  b > a
                )
                  onRange([a, b]);
                else toast.error(translate("Limites de escala inválidos."));
              }}
            >
              {translate("Aplicar")}
            </button>
            <button
              className="icon-button"
              aria-label={translate("Restaurar escala")}
              onClick={automatic}
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </details>
      )}
      <button
        className="button compact"
        disabled={!(to > from)}
        onClick={() =>
          exportTrackPNG(track, from, to, agc).catch((e) =>
            toast.error(message(e.message)),
          )
        }
      >
        <Download size={14} />
        {translate("Exportar gráfico PNG")}
      </button>
    </div>
  );
}
