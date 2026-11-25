import { makeTrack, drawTrack } from "@/lib/dlis/plotting";
import { visiblePaths } from "@/lib/dlis/profile-curves";
import type { ChannelMetadata, FrameMetadata } from "@/lib/dlis/types";
export async function benchmark() {
  const rows = 2_000_000;
  const depth = Float64Array.from({ length: rows }, (_, i) => i * 0.01),
    data = Float64Array.from(depth, (d) => 50 + 35 * Math.sin(d * 0.02));
  const channels = [
    { name: "TDEP", units: "m" },
    { name: "GR", units: "gAPI" },
  ].map((c) => ({
    ...c,
    dimension: [1],
    kind: c.name,
    key: c.name,
    longName: c.name,
  })) as ChannelMetadata[];
  const frame = {
    name: "QA",
    key: "QA",
    channels,
    indexType: "BOREHOLE-DEPTH",
  } as FrameMetadata;
  const start = performance.now();
  const t = makeTrack(
    "GR",
    "GR",
    0,
    frame,
    channels[1],
    {
      data: { TDEP: depth, GR: data },
      strides: { TDEP: 1, GR: 1 },
      frameCount: rows,
      frameNumbers: new Int32Array(),
      channels,
    },
    "TDEP",
  );
  const c = document.createElement("canvas");
  c.dataset.exportWidth = "250";
  drawTrack(c, t, 0, 20000, false);
  const first = performance.now() - start,
    times = [];
  for (let i = 0; i < 50; i++) {
    await new Promise(requestAnimationFrame);
    const before = performance.now();
    drawTrack(c, t, 100 + i * 40, 7000 + i * 40, false);
    times.push(performance.now() - before);
  }
  times.sort((a, b) => a - b);
  return {
    rows,
    firstMs: Math.round(first),
    warmMedianMs: times[25],
    warmP95Ms: times[47],
    renderedIndices: visiblePaths(t, 100, 7100, 1240, "linear")[0].length,
  };
}
