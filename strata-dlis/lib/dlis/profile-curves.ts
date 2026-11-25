import { validity, detectChannel } from "./core.js";
import type { Track } from "./plotting";
import type { ChannelMetadata } from "./types";

export type Scale = "linear" | "log";
export function curveFamily(ch: ChannelMetadata) {
  const name = ch.name.toUpperCase(),
    unit = ch.units.toLowerCase().replace(/\s/g, "");
  const base = detectChannel(
    ch,
    ch.dimension.reduce((a, b) => a * b, 1),
  );
  if (base !== "OTHER") return base;
  if (ch.dimension.some((n) => n !== 1)) return "OTHER";
  if (/^(SP|SSP)$/.test(name) && unit === "mv") return "SP";
  if (
    /^(RT|ILD|ILM|LLD|LLS|RILD|RILM|AT\d+|MSFL|RXO|RES[SDM]?)$/.test(name) &&
    /^(ohm[.·*-]?m|ohmm|ω[.·]?m)$/.test(unit)
  )
    return /^(LLS|ILM|RILM|RXO|MSFL|RESS)$/.test(name) ? "RS" : "RT";
  if (/^(RHOB|RHOZ|ZDEN|DEN|RHO)$/.test(name) && densityFactor(unit))
    return "RHOB";
  if (/^(NPHI|TNPH|NPOR|CNL|PHIN)$/.test(name) && neutronFactor(unit))
    return "NPHI";
  if (/^(DT|DTC|DTS|DTCO|AC)$/.test(name) && /^(us|µs|μs)\/(m|ft)$/.test(unit))
    return "DT";
  if (
    /^(CALI|HCAL|CAL|CALS|CALD)$/.test(name) &&
    /^(in|inch|mm|cm|m)$/.test(unit)
  )
    return "CALI";
  return "OTHER";
}
export function densityFactor(unit: string) {
  const u = unit.toLowerCase().replace(/[\s^]/g, "");
  return /^(g\/cm[3³]|g\/cc)$/.test(u) ? 1 : /^kg\/m[3³]$/.test(u) ? 0.001 : 0;
}
export function neutronFactor(unit: string) {
  const u = unit.toLowerCase().trim();
  return ["v/v", "m3/m3", "m³/m³", "ft3/ft3", "dec", "fraction"].includes(u)
    ? 1
    : ["%", "pu", "p.u.", "%v/v"].includes(u)
      ? 0.01
      : 0;
}
export function curveStyle(track: Track, dark = false, accessible = false) {
  const kind = ["GR", "CBL"].includes(track.kind)
    ? track.kind
    : curveFamily(track.channel);
  const colors: Record<string, [string, string, string, number[]]> = {
    GR: ["#166b36", "#70df90", "#009e73", []],
    SP: ["#222222", "#ecf3f7", "#4f8b79", [6, 2]],
    RT: ["#bd2536", "#ff858e", "#d55e00", []],
    RS: ["#155aab", "#85baff", "#0072b2", [5, 2]],
    RHOB: ["#b22d35", "#ff9497", "#d55e00", []],
    NPHI: ["#2169aa", "#80beff", "#0072b2", [6, 2]],
    DT: ["#754493", "#d0a2f4", "#aa6599", [7, 2, 1, 2]],
    CALI: ["#202020", "#f1f4f5", "#555555", [5, 3]],
    CBL: ["#FF0000", "#FF0000", "#d55e00", []],
    OTHER: ["#326783", "#8cc9e5", "#0072b2", []],
  };
  const [light, night, alt, dash] = colors[kind] || colors.OTHER;
  return {
    color: accessible
      ? dark && kind === "CALI"
        ? "#dedede"
        : alt
      : dark
        ? night
        : light,
    dash,
    kind,
  };
}
export function defaultScale(track: Track): Scale {
  return ["RT", "RS"].includes(curveFamily(track.channel)) &&
    track.rawRange[1] > 0
    ? "log"
    : "linear";
}
const positives = new WeakMap<Float64Array, number>();
export function scaleLimits(track: Track, scale: Scale) {
  const [lo, hi] = track.range;
  if (scale === "linear" || lo > 0) return [lo, hi];
  const data = track.result.data[track.channel.name];
  let low = positives.get(data);
  if (low === undefined) {
    low = Infinity;
    for (const v of data) if (v > 0 && v < low) low = v;
    positives.set(data, low);
  }
  return low < hi ? [low, hi] : [hi > 0 ? hi / 10 : 1, hi > 0 ? hi : 10];
}
export function fraction(value: number, limits: number[], scale: Scale) {
  const [a, b] = limits;
  return scale === "log"
    ? (Math.log(value) - Math.log(a)) / (Math.log(b) - Math.log(a))
    : (value - a) / (b - a);
}
export function lowerBound(
  depth: Float64Array,
  ids: ArrayLike<number>,
  value: number,
  upper = false,
) {
  let a = 0,
    b = ids.length;
  while (a < b) {
    const m = Math.floor((a + b) / 2),
      d = depth[ids[m]];
    if (d < value || (upper && d === value)) a = m + 1;
    else b = m;
  }
  return a;
}
// Cada índice aponta para uma amostra original. As lacunas são separadas antes de reduzir.
export function lttb(
  ids: ArrayLike<number>,
  depth: Float64Array,
  values: Float64Array,
  limit: number,
  log = false,
): Uint32Array {
  if (ids.length <= limit || limit < 3) return Uint32Array.from(ids);
  const result = new Uint32Array(limit),
    stride = (ids.length - 2) / (limit - 2);
  const y = (i: number) => (log ? Math.log(values[i]) : values[i]);
  result[0] = ids[0];
  result[limit - 1] = ids[ids.length - 1];
  for (let k = 0; k < limit - 2; k++) {
    const start = Math.floor((k + 1) * stride) + 1,
      end = Math.min(ids.length, Math.floor((k + 2) * stride) + 1);
    let avgX = 0,
      avgY = 0;
    for (let i = start; i < end; i++) {
      avgX += depth[ids[i]];
      avgY += y(ids[i]);
    }
    avgX /= end - start;
    avgY /= end - start;
    const a = result[k],
      ax = depth[a],
      ay = y(a);
    let max = -1;
    for (let i = Math.floor(k * stride) + 1; i < start; i++) {
      const b = ids[i],
        area = Math.abs(
          (ax - avgX) * (y(b) - ay) - (ax - depth[b]) * (avgY - ay),
        );
      if (area > max) {
        max = area;
        result[k + 1] = b;
      }
    }
  }
  return result;
}
type Segment = { levels: Uint32Array[] };
const cache = new WeakMap<
  Float64Array,
  WeakMap<Float64Array, Partial<Record<Scale, Segment[]>>>
>();
function segments(track: Track, scale: Scale) {
  const signal = track.result.data[track.channel.name],
    d = track.depth;
  let depths = cache.get(signal);
  if (!depths) {
    depths = new WeakMap();
    cache.set(signal, depths);
  }
  let scales = depths.get(d);
  if (!scales) {
    scales = {};
    depths.set(d, scales);
  }
  if (scales[scale]) return scales[scale]!;
  const result: Segment[] = [];
  let start = -1,
    previous = -Infinity;
  const ids = track.index.indices;
  const flush = (end: number) => {
    if (start >= 0) {
      result.push({ levels: [Uint32Array.from(ids.slice(start, end))] });
      start = -1;
    }
  };
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i],
      depth = d[id],
      v = signal[id];
    if (validity(v) !== "Válido" || (scale === "log" && v <= 0)) {
      flush(i);
      continue;
    }
    if (depth - previous > track.index.step * 2.5) flush(i);
    if (start < 0) start = i;
    previous = depth;
  }
  flush(ids.length);
  scales[scale] = result;
  return result;
}
export function visiblePaths(
  track: Track,
  from: number,
  to: number,
  budget: number,
  scale: Scale,
) {
  if (!(to > from)) return [];
  const signal = track.result.data[track.channel.name],
    depth = track.depth,
    paths: Uint32Array[] = [];
  for (const segment of segments(track, scale)) {
    let ids = segment.levels[0];
    if (depth[ids[0]] > to) break;
    if (depth[ids[ids.length - 1]] < from) continue;
    let level = 0,
      begin = 0,
      end = ids.length;
    for (;;) {
      begin = Math.max(0, lowerBound(depth, ids, from) - 1);
      end = Math.min(ids.length, lowerBound(depth, ids, to, true) + 1);
      if (end - begin <= budget * 4) break;
      level++;
      ids =
        segment.levels[level] ??
        (segment.levels[level] = lttb(
          ids,
          depth,
          signal,
          Math.max(3, Math.ceil(ids.length / 4)),
          scale === "log",
        ));
    }
    const slice = ids.subarray(begin, end);
    paths.push(
      slice.length > budget
        ? lttb(slice, depth, signal, budget, scale === "log")
        : slice,
    );
  }
  return paths;
}
