import assert from "node:assert/strict";
import test from "node:test";
import { makeFixture } from "./fixtures/dlis.mjs";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { inspectFrames } from "../lib/dlis/inspect.js";
import {
  emptyTechnicalFilters,
  matchesTechnicalFilters,
  readCatalogFiles,
} from "../lib/catalog.ts";

test("physical index, measured preview and declared tools and dates", () => {
  const bytes = makeFixture({ rows: 601, catalogDetails: true });
  const m = inspectFrames(DLISFile.fromBuffer(bytes));
  assert.equal(m.validation[0].samples, 601);
  assert.deepEqual(m.validation[0].depthRangeMeters, [1000, 1060]);
  assert.equal(m.logicalFiles[0].tools[0].name, "QA-GR");
  assert.equal(
    m.logicalFiles[0].origin.creationTime,
    "2026-03-15T12:30:00.000Z",
  );
  assert.equal(m.thumbnail.unit, "gAPI");
  assert.deepEqual(m.thumbnail.points[0], [80, 1000]);
  assert.ok(m.thumbnail.points.includes(null));
  const position = bytes.indexOf(Buffer.from([126, 0x23, 15, 12, 30, 0, 0, 0]));
  assert.ok(position >= 0);
  bytes[position + 1] = 0x13;
  const local = inspectFrames(DLISFile.fromBuffer(bytes)).logicalFiles[0]
    .origin;
  assert.equal(local.creationTime, "2026-03-15T12:30:00.000");
  assert.equal(local.creationTimeZone, "local-daylight");
});
test("an unreadable frame stays isolated and a file without readable frames is rejected", () => {
  const empty = makeFixture({ rows: 0 });
  const valid = makeFixture({ rows: 8 });
  const reports = [];
  const m = inspectFrames(
    DLISFile.fromBuffer(Buffer.concat([valid, empty.subarray(80)])),
    (n, total) => reports.push([n, total]),
  );
  assert.deepEqual(
    m.validation.map((v) => v.ok),
    [true, false],
  );
  assert.equal(m.validation[1].lf, 1);
  assert.ok(m.warnings.length);
  assert.deepEqual(reports, [
    [1, 2],
    [2, 2],
  ]);
  assert.throws(() => inspectFrames(DLISFile.fromBuffer(empty)), /amostras/);
  assert.throws(() => DLISFile.fromBuffer(valid.subarray(0, -5)), /truncado/);
});
test("technical filters use measured frame ranges and support records without an index", () => {
  const [file, legacy] = readCatalogFiles({
    files: [
      {
        id: "a",
        well: "Aurora",
        collection: "QA",
        summary: {
          ranges: [
            [0, 10],
            [30, 40],
          ],
          tools: ["Gamma probe"],
          channels: [{ name: "GR", unit: "gAPI" }],
        },
      },
      { id: "b", collection: "QA" },
    ],
  });
  const match = (f, params) =>
    matchesTechnicalFilters(f, { ...emptyTechnicalFilters, ...params });
  assert.ok(
    match(file, {
      well: "aur",
      curve: "gr",
      tool: "probe",
      minDepth: "10",
      maxDepth: "10",
    }),
  );
  assert.equal(match(file, { minDepth: "11", maxDepth: "29" }), false);
  assert.equal(match(file, { minDepth: "11", maxDepth: "1" }), false);
  assert.equal(match(legacy, { minDepth: "1" }), false);
  assert.ok(match(legacy, {}));
});
