// Reproducible local benchmark. The generated file and decoded arrays stay in memory.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { sha256 } from "../lib/dlis/core.js";
import { makeTrack } from "../lib/dlis/plotting.ts";
import { wellAssessment } from "../lib/model/well-assessment.ts";
import { makeFixture } from "./fixtures/dlis.mjs";

const modalities = { GR: "GR", CBL: "CBL", VDL: "VDL", USIT: "AIBK" };
async function measure(bytes, rows) {
  const start = performance.now();
  const hash = await sha256(bytes);
  const file = DLISFile.fromBuffer(bytes),
    frame = [...file.frames.values()][0];
  const decoded = frame.decode();
  const decodedAt = performance.now();
  const tracks = Object.fromEntries(
    Object.entries(modalities).map(([kind, name]) => {
      const channel = frame.channels.find((c) => c.name === name);
      return [kind, makeTrack(name, kind, 0, frame, channel, decoded, "TDEP")];
    }),
  );
  const result = wellAssessment(tracks, hash, [
    { index: 0, origin: file.logicalFiles[0].origin },
  ]);
  const finished = performance.now();
  assert.equal(decoded.frameCount, rows);
  const group = result.groups[0];
  // The generator omits 21 rows and shifts depth by 10 m after row 600.
  const depth = (i) => Math.fround(1000 + i * 0.1 + (i > 600 ? 10 : 0));
  const span = depth(rows - 1) - depth(0);
  const covered = span - (depth(421) - depth(399)) - (depth(601) - depth(600));
  const expectedUsit = 100 * Math.min((rows - 21) / rows, covered / span);
  assert.ok(Math.abs(group.usit - expectedUsit) < 1e-8);
  assert.equal(group.cblVdl, 50); // The synthetic VDL channel has no declared unit.
  for (const c of group.curves) {
    assert.equal(c.quality.completeness.fraction, (rows - 21) / rows);
    assert.ok(Math.abs(c.quality.coverage.passed - covered) < 1e-8);
  }
  return [decodedAt - start, finished - decodedAt, finished - start];
}
for (const rows of [1201, 4801]) {
  const bytes = makeFixture({ rows });
  await measure(bytes, rows);
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(await measure(bytes, rows));
  const median = (column) =>
    Number(
      runs
        .map((run) => run[column])
        .sort((a, b) => a - b)[2]
        .toFixed(2),
    );
  console.log(
    JSON.stringify({
      rows,
      bytes: bytes.length,
      numericCells: rows * 168,
      runs: 5,
      medianHashParseDecodeMs: median(0),
      medianTracksAssessmentMs: median(1),
      medianTotalMs: median(2),
    }),
  );
}
