import {
  depthIndex,
  metersFactor,
  numericRange,
  nearestSample,
  rawAt,
  usit,
  validity,
  agcRow,
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
  if (kind === "USIT" && !/^mrayls?$/i.test(channel.units))
    throw new Error(
      "USIT exige unidade MRayl. Escolha outra curva para unidades diferentes.",
    );
  if (kind === "CBL" && (stride !== 1 || !/^mv$/i.test(channel.units)))
    throw new Error("CBL exige canal escalar em mV.");
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
    range: numericRange(array) || [0, 1],
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
  const width = canvas.clientWidth || 240,
    dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
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
        Math.max(track.index.step * 0.55, (span / height) * 0.5),
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
      const gain = agc ? agcRow(data, s * track.stride, track.stride) : 0;
      for (let c = 0; c < track.stride; c++) {
        const v = data[s * track.stride + c];
        let color = "#edf0f2";
        if (track.kind === "USIT") color = usit(v).color;
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
      else ctx.moveTo(x, y(d));
      started = true;
      previousDepth = d;
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "#6d8a9620";
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (i * height) / 10);
    ctx.lineTo(width, (i * height) / 10);
    ctx.stroke();
  }
}
