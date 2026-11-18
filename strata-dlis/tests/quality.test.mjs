import test from "node:test";
import assert from "node:assert/strict";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { sha256 } from "../lib/dlis/core.js";
import { makeTrack } from "../lib/dlis/plotting.ts";
import { curveQuality } from "../lib/dlis/quality.ts";
import { makeFixture } from "./fixtures/dlis.mjs";

const hash = "a".repeat(64);
function track(depth, samples, kind = "CBL", units = "mV") {
  const stride = samples.length / depth.length;
  const channel = { name: kind, key: "signal", units, dimension: [stride] };
  const frame = {
    key: "frame",
    channels: [channel, { name: "DEPTH", units: "m" }],
  };
  const result = {
    frameCount: depth.length,
    frameNumbers: Int32Array.from(depth, (_, i) => i + 1),
    strides: { [kind]: stride, DEPTH: 1 },
    data: { [kind]: samples, DEPTH: depth },
  };
  return makeTrack("selection", kind, 0, frame, channel, result, "DEPTH");
}

test("encoded DLIS reaches quality calculation with original identities and samples", async () => {
  const bytes = makeFixture({ rows: 10 });
  const file = DLISFile.fromBuffer(bytes),
    frame = [...file.frames.values()][0];
  const channel = frame.channels.find((c) => c.name === "CBL");
  const t = makeTrack(
    "selection",
    "CBL",
    0,
    frame,
    channel,
    frame.decode(),
    "TDEP",
  );
  const q = curveQuality(t, await sha256(bytes));
  for (const metric of Object.values(q)) assert.equal(metric.fraction, 1);
});
test("sentinels, gaps and reversals affect distinct denominators", () => {
  const samples = [1, 1, -999.25, -2, 3, 4];
  const q = curveQuality(track([0, 1, 2, 10, 12, 11], samples), hash);
  assert.equal(q.completeness.fraction, 5 / 6);
  assert.equal(q.coverage.fraction, 3 / 12);
  assert.equal(q.consistency.fraction, 4 / 5);
  assert.equal(q.plausibility.fraction, 4 / 5);
  assert.deepEqual(samples, [1, 1, -999.25, -2, 3, 4]);
});
test("signed waveforms, incomplete provenance and single-depth data", () => {
  const t = track([2], [-1, NaN], "VDL", "");
  const q = curveQuality(t, "");
  assert.equal(q.completeness.fraction, 0.5);
  assert.equal(q.coverage.fraction, null);
  assert.equal(q.consistency.fraction, null);
  assert.equal(q.units.fraction, 0.5);
  assert.equal(q.traceability.fraction, 4 / 5);
  assert.equal(q.plausibility.fraction, null);
});
test("descending depth and duplicate rows do not double count coverage", () => {
  const q = curveQuality(track([3, 2, 2, 1, 0], [1, -999.25, 1, 1, 1]), hash);
  assert.equal(q.coverage.fraction, 1);
  assert.equal(q.consistency.fraction, 3 / 4);
  assert.equal(
    curveQuality(track([1], [-2000]), hash).plausibility.fraction,
    null,
  );
});
