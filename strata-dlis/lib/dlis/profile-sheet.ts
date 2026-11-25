import type { Track } from "./plotting";
import { drawTrack } from "./plotting.ts";
import {
  curveStyle,
  defaultScale,
  densityFactor,
  neutronFactor,
  scaleLimits,
  fraction,
  visiblePaths,
  type Scale,
} from "./profile-curves.ts";
import { nearestSample, validity } from "./core.js";
export type Mark = {
  id: string;
  name: string;
  from: number;
  to: number;
  lithology: string;
  legend?: string;
};
export type Column = { name: string; tracks: Track[]; marks: Mark[] };
export type SheetOptions = {
  from: number;
  to: number;
  dark: boolean;
  accessible: boolean;
  agc: boolean;
  scales: Record<string, Scale>;
  locale: string;
  crossover: boolean;
  depthLabel: string;
  crossLabel: string;
  indexLabel: string;
  linearLabel: string;
  logLabel: string;
};
type Primitive =
  | { kind: "rect"; x: number; y: number; w: number; h: number; color: string }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      color: string;
      size: number;
    }
  | {
      kind: "path";
      points: number[][];
      color: string;
      dash: number[];
      fill: boolean;
      clip?: number[];
    }
  | {
      kind: "image";
      x: number;
      y: number;
      w: number;
      h: number;
      canvas: HTMLCanvasElement;
    };
export type Sheet = { width: number; height: number; items: Primitive[] };
export const plotTop = 88,
  plotHeight = 600,
  laneWidth = 144,
  depthWidth = 94;
export const faciesColors: Record<string, string> = {
  sandstone: "#d8b46a",
  shale: "#8590a1",
  limestone: "#6eb4bd",
  dolomite: "#a695c1",
  other: "#a7b39a",
};
export function compatiblePair(tracks: Track[]) {
  const densities = tracks.filter((t) => curveStyle(t).kind === "RHOB"),
    neutrons = tracks.filter((t) => curveStyle(t).kind === "NPHI");
  if (densities.length !== 1 || neutrons.length !== 1) return null;
  const [a] = densities,
    [b] = neutrons;
  return a.lf === b.lf &&
    a.frame.key === b.frame.key &&
    a.depthName === b.depthName
    ? ([a, b] as const)
    : null;
}
const pairedCache = new WeakMap<Track, WeakMap<Track, Uint32Array>>();
function pairedRuns(density: Track, neutron: Track) {
  let cache = pairedCache.get(density);
  if (!cache) {
    cache = new WeakMap();
    pairedCache.set(density, cache);
  }
  const cached = cache.get(neutron);
  if (cached) return cached;
  const result = new Uint32Array(density.depth.length);
  const a = density.result.data[density.channel.name],
    b = neutron.result.data[neutron.channel.name];
  let prev = -Infinity,
    run = 1;
  for (const id of density.index.indices) {
    const depth = density.depth[id];
    if (validity(a[id]) !== "Válido" || validity(b[id]) !== "Válido") {
      prev = -Infinity;
      continue;
    }
    if (depth - prev > density.index.step * 2.5) run++;
    result[id] = run;
    prev = depth;
  }
  cache.set(neutron, result);
  return result;
}
export function makeSheet(
  column: Column,
  opt: SheetOptions,
  resolution = 1,
): Sheet {
  const { from, to, dark, accessible, locale } = opt;
  const pair = opt.crossover ? compatiblePair(column.tracks) : null;
  const width =
    depthWidth + laneWidth * (column.tracks.length + (pair ? 1 : 0));
  const marks = column.marks.filter(
    (mark) => mark.to >= from && mark.from <= to,
  );
  const h = plotHeight,
    height = h + plotTop + 35 + marks.length * 18,
    items: Primitive[] = [];
  const bg = dark ? "#182a38" : "#fff",
    ink = dark ? "#edf5f7" : "#193747",
    muted = dark ? "#b6cbd4" : "#46616e",
    grid = dark ? "#405562" : "#d7e2e5";
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const rect = (x: number, y: number, w: number, h: number, color: string) =>
    items.push({ kind: "rect", x, y, w, h, color });
  const text = (x: number, y: number, value: string, color = ink, size = 11) =>
    items.push({ kind: "text", x, y, text: value, color, size });
  const path = (
    points: number[][],
    color: string,
    dash: number[] = [],
    fill = false,
    clip?: number[],
  ) => items.push({ kind: "path", points, color, dash, fill, clip });
  const py = (d: number) => plotTop + (h * (d - from)) / (to - from);
  rect(0, 0, width, height, bg);
  text(8, 20, column.name, ink, 14);
  text(8, 46, opt.depthLabel);
  text(8, 64, "m", muted);
  for (const mark of column.marks) {
    if (mark.to <= mark.from || mark.to < from || mark.from > to) continue;
    const top = py(Math.max(from, mark.from)),
      bottom = py(Math.min(to, mark.to));
    rect(
      0,
      top,
      8,
      bottom - top,
      faciesColors[mark.lithology] || faciesColors.other,
    );
  }
  for (let i = 0; i <= 10; i++) {
    const y = plotTop + (i * h) / 10;
    path(
      [
        [0, y],
        [width, y],
      ],
      grid,
    );
    text(
      10,
      Math.min(height - 5, y + 4),
      fmt.format(from + (i * (to - from)) / 10),
      muted,
    );
  }
  column.tracks.forEach((t, i) => {
    const x = depthWidth + i * laneWidth,
      style = curveStyle(t, dark, accessible),
      scale = opt.scales[t.id] || defaultScale(t),
      limits = scaleLimits(t, scale);
    path(
      [
        [x, 32],
        [x, height - 15],
      ],
      grid,
    );
    text(x + 6, 44, t.channel.name, ink, 13);
    text(
      x + 6,
      61,
      (t.channel.units || "—") +
        " · " +
        (t.stride > 1
          ? opt.indexLabel
          : scale === "log"
            ? opt.logLabel
            : opt.linearLabel),
      muted,
    );
    text(
      x + 6,
      78,
      t.stride > 1
        ? "0 – " + (t.stride - 1)
        : fmt.format(limits[0]) + " – " + fmt.format(limits[1]),
      muted,
    );
    if (t.stride > 1 && t.kind !== "USIT" && opt.agc)
      text(x + laneWidth - 32, 78, "AGC", muted);
    if (t.stride > 1) {
      const canvas = document.createElement("canvas");
      canvas.dataset.exportWidth = String(Math.round(laneWidth * resolution));
      drawTrack(canvas, t, from, to, opt.agc, Math.round(h * resolution), dark);
      items.push({
        kind: "image",
        x: x + 1,
        y: plotTop,
        w: laneWidth - 2,
        h,
        canvas,
      });
      return;
    }
    path(
      [
        [x + 6, 49],
        [x + 32, 49],
      ],
      style.color,
      style.dash,
    );
    for (let j = 1; j < 4; j++)
      path(
        [
          [x + (j * laneWidth) / 4, plotTop],
          [x + (j * laneWidth) / 4, plotTop + h],
        ],
        grid,
        [2, 4],
      );
    const data = t.result.data[t.channel.name],
      clip = [x + 1, plotTop, laneWidth - 2, h];
    for (const ids of visiblePaths(
      t,
      from,
      to,
      Math.floor(h * 1.5 * resolution),
      scale,
    )) {
      const pts = Array.from(ids, (id) => [
        x + 5 + fraction(data[id], limits, scale) * (laneWidth - 10),
        py(t.depth[id]),
      ]);
      if (pts.length === 1) pts.push([pts[0][0] + 0.8, pts[0][1]]);
      path(pts, style.color, style.dash, false, clip);
    }
  });
  if (pair) {
    const [density, neutron] = pair,
      x = width - laneWidth,
      w = laneWidth - 10;
    path(
      [
        [x, 32],
        [x, height - 15],
      ],
      grid,
    );
    text(x + 5, 44, opt.crossLabel);
    text(x + 5, 61, "1.95 → 2.95 g/cm³", muted);
    text(x + 5, 78, "0.45 → −0.15 v/v", muted);
    let previous:
      | { a: number; b: number; y: number; depth: number; run: number }
      | undefined;
    const aData = density.result.data[density.channel.name],
      bData = neutron.result.data[neutron.channel.name];
    const densityInk = curveStyle(density, dark, accessible).color,
      neutronInk = curveStyle(neutron, dark, accessible).color;
    const bands = pairedRuns(density, neutron);
    const df = densityFactor(density.channel.units),
      nf = neutronFactor(neutron.channel.units),
      clip = [x, plotTop, laneWidth, h];
    for (let row = 0; row <= h * resolution; row++) {
      const depth = from + ((to - from) * row) / (h * resolution),
        id = nearestSample(
          density.depth,
          density.index,
          depth,
          density.index.step * 0.55 || 1e-6,
        );
      if (
        id === null ||
        validity(aData[id]) !== "Válido" ||
        validity(bData[id]) !== "Válido"
      ) {
        previous = undefined;
        continue;
      }
      const a = x + 5 + (aData[id] * df - 1.95) * w,
        b = x + 5 + ((0.45 - bData[id] * nf) / 0.6) * w,
        y = py(density.depth[id]);
      if (
        previous &&
        previous.run === bands[id] &&
        previous.depth !== density.depth[id] &&
        density.depth[id] - previous.depth <=
          Math.max(density.index.step * 2.5, ((to - from) / h) * 1.5)
      ) {
        const p = previous,
          da = p.b - p.a,
          db = b - a;
        if (da > 0 && db > 0)
          path(
            [
              [p.a, p.y],
              [p.b, p.y],
              [b, y],
              [a, y],
            ],
            dark ? "#735f38" : "#f0cf85",
            [],
            true,
            clip,
          );
        else if (da > 0 !== db > 0) {
          const k = da / (da - db),
            inter = [p.a + (a - p.a) * k, p.y + (y - p.y) * k];
          path(
            da > 0 ? [[p.a, p.y], [p.b, p.y], inter] : [[a, y], [b, y], inter],
            dark ? "#735f38" : "#f0cf85",
            [],
            true,
            clip,
          );
        }
        path(
          [
            [p.a, p.y],
            [a, y],
          ],
          densityInk,
          [],
          false,
          clip,
        );
        path(
          [
            [p.b, p.y],
            [b, y],
          ],
          neutronInk,
          [],
          false,
          clip,
        );
      }
      previous = { a, b, y, depth: density.depth[id], run: bands[id] };
    }
  }
  for (const mark of column.marks) {
    if (mark.from < from || mark.from > to) continue;
    const y = py(mark.from);
    path(
      [
        [0, y],
        [width, y],
      ],
      dark ? "#ffd581" : "#78520e",
      [5, 3],
    );
    text(9, Math.min(y + 14, plotTop + h - 2), mark.name, ink);
  }
  text(
    8,
    h + plotTop + 19,
    fmt.format(from) + " – " + fmt.format(to) + " m",
    muted,
  );
  marks.forEach((m, i) => {
    const y = h + plotTop + 35 + i * 18;
    rect(8, y - 10, 8, 9, faciesColors[m.lithology] || muted);
    text(
      23,
      y,
      m.name +
        " · " +
        (m.legend || m.lithology) +
        " · " +
        fmt.format(m.from) +
        (m.to > m.from ? " – " + fmt.format(m.to) : "") +
        " m",
      ink,
    );
  });
  return { width, height, items };
}
export function paintSheet(ctx: CanvasRenderingContext2D, sheet: Sheet) {
  for (const item of sheet.items) {
    if (item.kind === "rect") {
      ctx.fillStyle = item.color;
      ctx.fillRect(item.x, item.y, item.w, item.h);
    } else if (item.kind === "text") {
      ctx.font = item.size + "px system-ui, sans-serif";
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    } else if (item.kind === "image") {
      ctx.drawImage(item.canvas, item.x, item.y, item.w, item.h);
    } else if (item.points.length) {
      ctx.save();
      if (item.clip) {
        const [x, y, w, h] = item.clip;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
      }
      ctx.beginPath();
      item.points.forEach(([x, y], i) =>
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y),
      );
      ctx.setLineDash(item.dash);
      if (item.fill) {
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
