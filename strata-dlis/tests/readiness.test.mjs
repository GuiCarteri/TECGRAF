import test from "node:test";
import assert from "node:assert/strict";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { makeTrack } from "../lib/dlis/plotting.ts";
import { assessReadiness } from "../lib/dlis/readiness.ts";
import { makeFixture } from "./fixtures/dlis.mjs";
const hash = "f".repeat(64);
function tracks() {
  const frame = [
    ...DLISFile.fromBuffer(makeFixture({ rows: 8 })).frames.values(),
  ][0];
  return Object.fromEntries(
    [
      ["USIT", "AIBK"],
      ["CBL", "CBL"],
      ["VDL", "VDL"],
    ].map(([kind, name]) => {
      const channel = frame.channels.find((c) => c.name === name);
      return [
        kind,
        makeTrack(name, kind, 0, frame, channel, frame.decode(), "TDEP"),
      ];
    }),
  );
}
test("separate readiness scores require their respective curves", () => {
  const t = tracks();
  t.USIT.result.data.AIBK.fill(2);
  assert.equal(assessReadiness({ USIT: t.USIT }, hash).usit, 100);
  assert.equal(assessReadiness({ CBL: t.CBL }, hash).cblVdl, null);
  assert.equal(assessReadiness({ CBL: t.CBL, VDL: t.VDL }, hash).cblVdl, 50);
  t.VDL.channel.units = "mV";
  const paired = assessReadiness({ CBL: t.CBL, VDL: t.VDL }, hash);
  assert.equal(paired.usit, null);
  assert.equal(paired.cblVdl, 100);
  t.USIT.result.data.AIBK.fill(-2);
  const scores = assessReadiness(t, hash);
  assert.equal(scores.usit, 0);
  assert.equal(scores.cblVdl, 100);
});
test("CBL and VDL score only jointly covered depth with compatible axes", () => {
  const t = tracks();
  t.VDL.depth = Float64Array.from(t.VDL.depth, (z) => z + 100);
  assert.equal(assessReadiness(t, hash).cblVdl, 0);
  t.VDL.lf++;
  assert.equal(assessReadiness(t, hash).cblVdl, null);
});
test("complementary internal gaps reduce joint coverage independently of signal quality", () => {
  const { CBL, VDL } = tracks();
  CBL.result.data.CBL[2] = -999.25;
  VDL.result.data.VDL.fill(-999.25, 5 * VDL.stride, 6 * VDL.stride);
  const z = CBL.depth;
  const expected =
    (100 * (z[1] - z[0] + z[4] - z[3] + z[7] - z[6])) / (z[7] - z[0]);
  assert.ok(
    Math.abs(assessReadiness({ CBL, VDL }, hash).cblVdl - expected) < 1e-8,
  );
});
