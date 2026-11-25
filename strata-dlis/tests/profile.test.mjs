import test from "node:test";
import assert from "node:assert/strict";
import {
  curveFamily,
  curveStyle,
  defaultScale,
  densityFactor,
  neutronFactor,
  fraction,
  scaleLimits,
  visiblePaths,
  lttb,
} from "../lib/dlis/profile-curves.ts";
import { makeTrack, locate } from "../lib/dlis/plotting.ts";
import { compatiblePair, makeSheet } from "../lib/dlis/profile-sheet.ts";

function track(name, units, values, depth = values.map((_, i) => 1000 + i)) {
  const channel = { name, units, dimension: [1], key: name },
    index = { name: "TDEP", units: "m", dimension: [1] };
  const frame = {
    channels: [index, channel],
    key: "1/frame",
    name: "Test",
    indexType: "BOREHOLE-DEPTH",
  };
  return makeTrack(
    name,
    curveFamily(channel),
    0,
    frame,
    channel,
    {
      data: {
        TDEP: Float64Array.from(depth),
        [name]: Float64Array.from(values),
      },
      strides: { TDEP: 1, [name]: 1 },
      frameCount: depth.length,
    },
    "TDEP",
  );
}
test("curve families require compatible mnemonics, dimensions and declared units", () => {
  for (const [name, u, kind] of [
    ["GR", "gAPI", "GR"],
    ["SP", "mV", "SP"],
    ["LLD", "ohm.m", "RT"],
    ["LLS", "ohm-m", "RS"],
    ["RHOB", "kg/m3", "RHOB"],
    ["NPHI", "pu", "NPHI"],
    ["DT", "us/ft", "DT"],
    ["CALI", "in", "CALI"],
    ["RHOB", "mV", "OTHER"],
  ]) {
    const t = track(name, u, [1, 2]);
    assert.equal(curveFamily(t.channel), kind);
    if (kind === "CALI") assert.ok(curveStyle(t).dash.length);
  }
  assert.equal(densityFactor("kg/m³"), 0.001);
  assert.equal(neutronFactor("%"), 0.01);
  assert.equal(neutronFactor(""), 0);
});
test("LTTB preserves peaks and source indices across zoom and respects invalid samples, missing depth and logarithmic domain", () => {
  const n = 12000,
    d = Float64Array.from({ length: n }, (_, i) => i),
    v = new Float64Array(n);
  v[6011] = 100;
  const ids = Uint32Array.from(d),
    reduced = lttb(ids, d, v, 140);
  assert.deepEqual(
    [reduced[0], reduced.at(-1), reduced.length],
    [0, n - 1, 140],
  );
  assert.ok(reduced.includes(6011));
  const t = track(
    "ILD",
    "ohm.m",
    [1, 2, -999.25, 5, 0, 10, 100, 200],
    [9, 8, 7, 6, 5, 4, 2, 1],
  );
  assert.equal(defaultScale(t), "log");
  assert.deepEqual(scaleLimits(t, "log"), [1, 200]);
  assert.equal(fraction(10, [1, 100], "log"), 0.5);
  const parts = visiblePaths(t, 0, 10, 60, "log").map((ids) => Array.from(ids));
  assert.deepEqual(parts, [[7, 6, 5], [3], [1, 0]]);
  const gaps = track("GR", "gAPI", [0, 1, 2, 3, 4], [1, 2, 3, 70, 71]);
  assert.equal(visiblePaths(gaps, 1, 71, 60, "linear").length, 2);
  assert.equal(locate(gaps, 40, 0.5), null);
});
test("density-neutron crossover converts units and only pairs compatible data from the same frame and index", () => {
  const a = track("RHOB", "kg/m3", [2000, 2050, 2100]),
    b = track("NPHI", "%", [5, 8, 11]);
  assert.ok(compatiblePair([a, b]));
  assert.equal(compatiblePair([a, { ...b, lf: 1 }]), null);
  assert.equal(compatiblePair([a, { ...b, depthName: "TVD" }]), null);
  const options = {
    from: 1000,
    to: 1002,
    dark: false,
    accessible: false,
    agc: false,
    locale: "en",
    scales: {},
    crossover: true,
    depthLabel: "Depth",
    crossLabel: "Crossover",
    indexLabel: "Index",
    linearLabel: "Linear",
    logLabel: "Log",
  };
  const sheet = makeSheet({ name: "QA", tracks: [a, b], marks: [] }, options);
  assert.ok(sheet.items.some((i) => i.kind === "path" && i.fill));
  const incompatible = makeSheet(
    { name: "QA", tracks: [a], marks: [] },
    options,
  );
  assert.ok(!incompatible.items.some((i) => i.kind === "path" && i.fill));
});
