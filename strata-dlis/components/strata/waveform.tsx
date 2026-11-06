"use client";
import { useEffect, useRef } from "react";
import { type Track } from "@/lib/dlis/plotting";
import { validity } from "@/lib/dlis/core.js";
import { useI18n } from "@/lib/i18n/provider";
export function Waveform({ track, sample }: { track: Track; sample: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { translate } = useI18n();
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 440, 180);
    const a = track.result.data[track.channel.name],
      start = sample * track.stride;
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < track.stride; i++) {
      const v = a[start + i];
      if (validity(v) === "Válido") {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    if (!Number.isFinite(min)) return;
    ctx.strokeStyle = "#116f7c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let open = false;
    for (let i = 0; i < track.stride; i++) {
      const v = a[start + i];
      if (validity(v) !== "Válido") {
        open = false;
        continue;
      }
      const x = 8 + (i / (track.stride - 1)) * 424,
        y = 170 - ((v - min) / (max - min || 1)) * 160;
      if (open) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      open = true;
    }
    ctx.stroke();
  }, [track, sample]);
  return (
    <figure className="waveform">
      <figcaption>
        {translate("Forma de onda original")} · {track.depth[sample].toFixed(3)}{" "}
        m
      </figcaption>
      <canvas
        ref={ref}
        width={440}
        height={180}
        aria-label={translate("Forma de onda original")}
      />
      <small>
        {translate("Índice da amostra")} · 0–{track.stride - 1} ·{" "}
        {track.channel.units || translate("unidade não informada")}
      </small>
    </figure>
  );
}
