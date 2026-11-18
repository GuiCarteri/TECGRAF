import test from "node:test";
import assert from "node:assert/strict";
import { exportPoints } from "../lib/dlis/export.ts";
import { safeNext } from "../lib/auth-policy.ts";
import * as XLSX from "xlsx";
test("safe destination rejects foreign hosts, control chars and authentication loops", () => {
  for (const path of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/login",
    "/auth/refresh",
    "/api/auth/logout",
    "/\nevil",
  ])
    assert.equal(safeNext(path), "/account");
  assert.equal(safeNext("/viewer?file=abc#points"), "/viewer?file=abc#points");
});
test("CSV, JSON and XLSX retain raw values, identifiers, user text and canonical columns", async () => {
  const hash = "a".repeat(64),
    point = {
      fileHash: hash,
      fileName: "原始.dlis",
      channel: "Bom",
      sampleIndex: 1,
      componentIndex: 0,
      rawValue: 1.125,
      depth: 1000.25,
      unit: "mV",
      manualClassification: "Bom",
      observation: "Texto original 中文",
      reference: { value: 2.5 },
    };
  const formulaText = '=SUM(1,2) "nota", 中文';
  const points = [
    point,
    { ...point, sampleIndex: 2, rawValue: -2000, observation: formulaText },
  ];
  const original = JSON.stringify(points),
    blobs = [];
  const oldCreate = URL.createObjectURL,
    oldRevoke = URL.revokeObjectURL,
    oldDoc = globalThis.document;
  URL.createObjectURL = (blob) => {
    blobs.push(blob);
    return "blob:test";
  };
  URL.revokeObjectURL = () => {};
  globalThis.document = { createElement: () => ({ click() {} }) };
  try {
    for (const format of ["csv", "json", "xlsx"])
      await exportPoints(points, format, hash);
    const csv = await blobs[0].text();
    assert.match(csv, /1\.125/);
    assert.match(csv, /原始.dlis/);
    assert.match(csv, /rawValue/);
    assert.match(csv, /Texto original 中文/);
    const csvBook = XLSX.read(csv, { type: "string", raw: true });
    const csvRows = XLSX.utils.sheet_to_json(
      csvBook.Sheets[csvBook.SheetNames[0]],
    );
    assert.equal(csvRows[1].observation, "'" + formulaText);
    assert.equal(csvRows[1].rawValue, "-2000");
    assert.equal(csvRows[1].fileHash, hash);
    assert.deepEqual(JSON.parse(await blobs[1].text()).points, points);
    const workbook = XLSX.read(await blobs[2].arrayBuffer(), { type: "array" });
    const row = XLSX.utils.sheet_to_json(workbook.Sheets["Pontos brutos"])[0];
    assert.equal(row.rawValue, 1.125);
    assert.equal(row.channel, "Bom");
    assert.equal(row.manualClassification, "Bom");
    assert.equal(row.observation, point.observation);
    const sheet = workbook.Sheets["Pontos brutos"];
    const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0];
    const observation =
      sheet[
        XLSX.utils.encode_cell({ r: 2, c: headers.indexOf("observation") })
      ];
    assert.equal(observation.t, "s");
    assert.equal(observation.f, undefined);
    assert.equal(observation.v, formulaText);
    assert.equal(XLSX.utils.sheet_to_json(sheet)[1].rawValue, -2000);
    assert.equal(workbook.Sheets["Rastreabilidade"].B2.v, hash);
    assert.equal(JSON.stringify(points), original);
  } finally {
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
    globalThis.document = oldDoc;
  }
});
