import test from "node:test";
import assert from "node:assert/strict";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { makeTrack } from "../lib/dlis/plotting.ts";
import { makeFixture } from "./fixtures/dlis.mjs";
import {
  wellAssessment,
  readWellAssessment,
} from "../lib/model/well-assessment.ts";

test("well analysis preserves the selected LF, metrics and source without raw arrays", () => {
  const hash = "a".repeat(64);
  const frame = [
    ...DLISFile.fromBuffer(makeFixture({ rows: 8 })).frames.values(),
  ][0];
  const track = (lf, name) =>
    makeTrack(
      name,
      name,
      lf,
      frame,
      frame.channels.find((c) => c.name === name),
      frame.decode(),
      "TDEP",
    );
  const CBL = track(0, "CBL"),
    VDL = track(1, "VDL");
  const origins = [0, 1].map((index) => ({ index, origin: { wellName: "A" } }));
  const summary = wellAssessment({ CBL, VDL }, hash, origins);
  assert.deepEqual(
    summary.groups.map((g) => [g.well, g.lf, g.cblVdl]),
    [
      ["A", 0, null],
      ["A", 1, null],
    ],
  );
  const paired = wellAssessment({ CBL, VDL: track(0, "VDL") }, hash, origins);
  assert.ok(paired.groups[0].cblVdl > 0);
  const saved = JSON.stringify(paired);
  assert.deepEqual(readWellAssessment(JSON.parse(saved), hash), paired);
  assert.equal(saved.includes("frameNumbers"), false);
  assert.equal(readWellAssessment(paired, "b".repeat(64)), null);
  assert.equal(readWellAssessment(undefined, hash), null);
  CBL.result.data.CBL.fill(-2000);
  assert.equal(
    wellAssessment({ CBL }, hash, origins).groups[0].curves[0].quality
      .completeness.fraction,
    0,
  );
  assert.equal(paired.groups[0].curves[0].quality.completeness.fraction, 1);
});
