import test from "node:test";
import assert from "node:assert/strict";
import { makeTrack, locate } from "../lib/dlis/plotting.ts";
const depth = { name: "TDEP", units: "0.1 in", dimension: [1] },
  cbl = { name: "CBL", units: "mV", dimension: [1] };
const frame = { channels: [depth, cbl] };
const result = {
  strides: { TDEP: 1, CBL: 1 },
  frameCount: 4,
  data: {
    TDEP: new Float64Array([100000, 100100, 200000, -999.25]),
    CBL: new Float64Array([2, 2, 2, -999.25]),
  },
};
test("plotting preserves source arrays, converts depth once and centers constant signals", () => {
  const t = makeTrack("x", "CBL", 0, frame, cbl, result, "TDEP");
  assert.ok(Math.abs(t.depth[0] - 254) < 1e-10);
  assert.ok(Number.isNaN(t.depth[3]));
  assert.equal(result.data.TDEP[0], 100000);
  assert.equal(t.result.data.CBL, result.data.CBL);
  assert.ok(t.range[0] < 2 && t.range[1] > 2);
  assert.equal(locate(t, 254, 0.5).value, 2);
});
test("incompatible channel units/dimensions cannot silently become a scientific track", () => {
  assert.throws(() => makeTrack("x", "USIT", 0, frame, cbl, result, "TDEP"));
  assert.throws(() => makeTrack("x", "GR", 0, frame, cbl, result, "TDEP"));
  assert.throws(() => makeTrack("x", "CBL", 0, frame, cbl, result, "NONE"));
});
