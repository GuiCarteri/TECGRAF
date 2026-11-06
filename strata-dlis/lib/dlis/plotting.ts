import {
  depthIndex,
  metersFactor,
  numericRange,
  nearestSample,
  rawAt,
  usit,
  validity,
  agcRow,
  isMRayl,
  PALETTE,
} from "./core.js";
export type Track = {
  id: string;
  kind: string;
  lf: number;
  frame: any;
  channel: any;
  result: any;
  depthName: string;
  depth: Float64Array;
  index: any;
  stride: number;
  range: number[];
  rawRange: number[];
  timeName?: string;
  azimuthName?: string;
};
export function makeTrack(
  id: string,
  kind: string,
  lf: number,
  frame: any,
  channel: any,
  result: any,
  depthName: string,
): Track {
  const factor = metersFactor(
    frame.channels.find((c: any) => c.name === depthName)?.units,
  );
  if (factor === null || result.strides[depthName] !== 1)
    throw new Error(
      "Não foi possível identificar um canal de profundidade com unidade conhecida.",
    );
  const rawDepth = result.data[depthName];
  const depth = Float64Array.from(rawDepth, (v: number) =>
    validity(v) === "Válido" ? v * factor : NaN,
  );
  const stride = result.strides[channel.name],
    array = result.data[channel.name];
  if (!array || !stride || array.length !== stride * result.frameCount)
    throw new Error("Channel possui dimensão incompatível.");
  if (channel.dimension.filter((n: number) => n > 1).length > 1)
    throw new Error(
      "Canal com múltiplas dimensões: selecione um canal com um único eixo de amostras.",
    );
  if (kind === "GR" && (stride !== 1 || !/^(gapi|api)$/i.test(channel.units)))
    throw new Error("GR exige canal escalar em API.");
  if (["VDL", "USIT"].includes(kind) && stride < 2)
    throw new Error("Este track exige um canal com múltiplas amostras.");
  if (kind === "USIT" && !isMRayl(channel.units))
    throw new Error(
      "USIT exige unidade MRayl. Escolha outra curva para unidades diferentes.",
    );
  if (kind === "CBL" && (stride !== 1 || !/^mv$/i.test(channel.units)))
    throw new Error("CBL exige canal escalar em mV.");
  const rawRange = numericRange(array) || [0, 1];
  const range =
    rawRange[0] === rawRange[1]
      ? [
          rawRange[0] - Math.max(1, Math.abs(rawRange[0]) * 0.01),
          rawRange[1] + Math.max(1, Math.abs(rawRange[1]) * 0.01),
        ]
      : rawRange;
  return {
    id,
    kind,
    lf,
    frame,
    channel,
    result,
    depthName,
    depth,
    index: depthIndex(depth),
    stride,
    range: kind === "USIT" ? [0, 10] : range,
    rawRange,
  };
}
export function locate(track: Track, target: number, xRatio: number) {
  const sample = nearestSample(
    track.depth,
    track.index,
    target,
    track.index.step ? track.index.step * 0.75 : 1e-6,
  );
  if (sample === null) return null;
  const component = Math.max(
    0,
    Math.min(track.stride - 1, Math.floor(xRatio * track.stride)),
  );
  return {
    sample,
    component,
    value: rawAt(
      track.result.data[track.channel.name],
      track.stride,
      sample,
      component,
    ),
  };
}
export function drawTrack(
  canvas: HTMLCanvasElement,
  track: Track,
  from: number,
  to: number,
  agc: boolean,
  height = 620,
) {
  const width = Number(canvas.dataset.exportWidth) || canvas.clientWidth || 240,
    dpr = canvas.dataset.exportWidth
      ? 1
      : Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = track.stride > 1 ? PALETTE.invalid : "#fff";
  ctx.fillRect(0, 0, width, height);
  const span = to - from;
  if (!(span > 0)) return;
  const data = track.result.data[track.channel.name];
  const y = (depth: number) => ((depth - from) / span) * height;
  if (track.stride > 1) {
    for (let py = 0; py < height; py++) {
      const s = nearestSample(
        track.depth,
        track.index,
        from + ((py + 0.5) / height) * span,
        track.index.step ? track.index.step * 0.55 : 1e-6,
      );
      if (s === null) continue;
      let mean = 0,
        n = 0;
      if (agc && track.kind !== "USIT") {
        for (let c = 0; c < track.stride; c++) {
          const v = data[s * track.stride + c];
          if (validity(v) === "Válido") {
            mean += v;
            n++;
          }
        }
        mean = n ? mean / n : 0;
      }
      const gain =
        agc && track.kind !== "USIT"
          ? agcRow(data, s * track.stride, track.stride)
          : 0;
      for (let c = 0; c < track.stride; c++) {
        const v = data[s * track.stride + c];
        let color = PALETTE.invalid;
        if (track.kind === "USIT")
          color =
            validity(v) === "Válido" || v === -2000 ? usit(v).color : "#808080";
        else if (validity(v) === "Válido") {
          const lo = track.range[0],
            hi = track.range[1];
          const normalized = agc
            ? 0.5 + (v - mean) / (Math.max(gain, 1e-12) * 3)
            : (v - lo) / (hi - lo || 1);
          const gray = Math.round(
            255 * (1 - Math.max(0, Math.min(1, normalized))),
          );
          color = `rgb(${gray},${gray},${gray})`;
        }
        ctx.fillStyle = color;
        const x = (c / track.stride) * width;
        ctx.fillRect(x, py, Math.ceil(width / track.stride) + 0.2, 1);
      }
    }
  } else {
    ctx.strokeStyle = "#e9eff2";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo((i * width) / 5, 0);
      ctx.lineTo((i * width) / 5, height);
      ctx.stroke();
    }
    ctx.strokeStyle =
      track.kind === "CBL"
        ? "#FF0000"
        : track.kind === "GR"
          ? "#238544"
          : "#246b91";
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    let started = false,
      previousDepth = -Infinity;
    for (const s of track.index.indices) {
      const d = track.depth[s];
      if (d < from || d > to) continue;
      const value = data[s];
      if (validity(value) !== "Válido") {
        started = false;
        continue;
      }
      const x =
        8 +
        ((value - track.range[0]) / (track.range[1] - track.range[0] || 1)) *
          (width - 16);
      if (started && d - previousDepth <= track.index.step * 2.5)
        ctx.lineTo(x, y(d));
      else {
        ctx.moveTo(x, y(d));
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fillRect(x - 1, y(d) - 1, 2, 2);
      }
      started = true;
      previousDepth = d;
    }
    ctx.stroke();
  }
  if (track.stride > 1) return; // Never tint the prescribed heatmap colors with a grid.
  ctx.strokeStyle = "#6d8a9620";
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * height) / 10);
    ctx.lineTo(width, (i * height) / 10);
    ctx.stroke();
  }
}

/** Export the displayed interval with depth/units and display transformation provenance. */
export async function exportTrackPNG(
  track: Track,
  from: number,
  to: number,
  agc: boolean,
) {
  const plot = document.createElement("canvas");
  plot.dataset.exportWidth = "640";
  drawTrack(plot, track, from, to, agc, 1000);
  const output = document.createElement("canvas");
  output.width = 800;
  output.height = 1180;
  const ctx = output.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 800, 1180);
  ctx.fillStyle = "#153a4d";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(
    `STRATA · ${track.channel.name} [${track.channel.units || "unit unspecified"}]`,
    24,
    32,
  );
  ctx.font = "13px sans-serif";
  ctx.fillText(
    `LF ${track.lf + 1} · ${track.frame.name} · ${from}–${to} m`,
    24,
    56,
  );
  ctx.fillText(
    track.stride > 1
      ? `Component index 0–${track.stride - 1}; physical axis not inferred`
      : `Amplitude ${track.range[0]}–${track.range[1]}`,
    24,
    78,
  );
  ctx.drawImage(plot, 115, 100);
  ctx.font = "12px monospace";
  for (let i = 0; i <= 10; i++)
    ctx.fillText((from + ((to - from) * i) / 10).toFixed(3), 20, 106 + i * 100);
  ctx.fillText("Depth [m]", 20, 90);
  ctx.font = "12px sans-serif";
  ctx.fillText(
    track.kind === "USIT"
      ? "MRayl: red <0.3 | cyan <2.6 | cream→black 2.6–10 | black ≥10"
      : `Intensity ${agc && track.stride > 1 ? "visual AGC (relative)" : `${track.range[0]}–${track.range[1]} ${track.channel.units || "raw units"}`}`,
    24,
    1132,
  );
  ctx.fillText(
    "Original samples · nearest-sample overview · no interpolation · interpretation is provisional",
    24,
    1157,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    output.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
      "image/png",
    ),
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `strata-${track.channel.name.replace(/[^a-z0-9_-]/gi, "_")}-${from.toFixed(2)}-${to.toFixed(2)}m.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
