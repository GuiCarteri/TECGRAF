import test from "node:test";
import assert from "node:assert/strict";
import {
  usit,
  rawAt,
  validateHeader,
  isDlisName,
  companyMatches,
  mayPublish,
  mayRead,
  csvCell,
  pointsCSV,
  detectChannel,
  depthIndex,
  nearestSample,
  metersFactor,
  sha256,
} from "../lib/dlis/core.js";
test("USIT respeita fronteiras e cores constantes de gás/líquido", () => {
  assert.equal(usit(0).color, "#FF0000");
  assert.equal(usit(0.299999).color, "#FF0000");
  assert.equal(usit(0.3).color, "#00FFFF");
  assert.equal(usit(2.599999).color, "#00FFFF");
  assert.equal(usit(2.6).zone, "Cimento");
  assert.equal(usit(10).color, "#000000");
  assert.equal(usit(-2000).color, "#008000");
  assert.equal(usit(-1).color, "#808080");
  assert.equal(usit(NaN).zone, "Inválido");
});
test("índices sample/component preservam o valor e rejeitam posições inválidas", () => {
  const data = new Float64Array([1.125, 2, 3, 4, 5, 6]);
  assert.equal(rawAt(data, 3, 1, 2), 6);
  assert.equal(rawAt(data, 3, 0, 0), 1.125);
  for (const [s, c] of [
    [-1, 0],
    [2, 0],
    [0, 3],
    [0.5, 0],
  ])
    assert.throws(() => rawAt(data, 3, s, c));
});
test("gaps não se tornam amostras", () => {
  const d = new Float64Array([100, 101, 200, 201]),
    i = depthIndex(d);
  assert.equal(nearestSample(d, i, 101.1, 0.75), 1);
  assert.equal(nearestSample(d, i, 150, 0.75), null);
});
test("assinatura RP66 é validada independentemente da extensão", () => {
  assert.equal(isDlisName("poço.DLIS"), true);
  assert.equal(isDlisName("a.dlis.exe"), false);
  assert.throws(() => validateHeader(new ArrayBuffer(100)));
  const b = new Uint8Array(84);
  b.set(new TextEncoder().encode("0001V1.00RECORD"));
  assert.equal(validateHeader(b.buffer), true);
});
test("metadados não equiparam nomes de empresas nem prestadores", () => {
  assert.equal(companyMatches("  Statoil ", "STATOIL"), true);
  assert.equal(companyMatches("Statoil", "Equinor"), false);
  assert.equal(companyMatches("", "Volve"), false);
});
test("detecção exige nome, dimensão e unidade compatíveis", () => {
  assert.equal(detectChannel({ name: "AIBK", units: "Mrayl" }, 36), "USIT");
  assert.equal(detectChannel({ name: "AIBK", units: "mV" }, 36), "OTHER");
  assert.equal(detectChannel({ name: "TDEP", units: "0.1 in" }, 1), "DEPTH");
  assert.equal(detectChannel({ name: "CBL", units: "" }, 1), "OTHER");
  assert.equal(metersFactor("0.1 in"), 0.00254);
});
test("autorizações protegem publicações, pendências e arquivos privados", () => {
  assert.equal(mayPublish("user"), false);
  assert.equal(mayPublish("publisher"), true);
  const f = { status: "pending", visibility: "public", owner_id: "a" };
  assert.equal(mayRead(f, { id: "b", role: "user" }), false);
  assert.equal(mayRead(f, { id: "a", role: "user" }), true);
  assert.equal(mayRead({ ...f, status: "validated" }, null), false);
  assert.equal(
    mayRead({ ...f, status: "validated" }, { id: "b", role: "user" }),
    true,
  );
  assert.equal(
    mayRead(
      { ...f, status: "validated", visibility: "private" },
      { id: "b", role: "user" },
    ),
    false,
  );
});
test("CSV mantém números, aspas e vírgulas e neutraliza fórmulas textuais", () => {
  assert.equal(csvCell(-2000), '"-2000"');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  const text = pointsCSV([
    {
      rawValue: 0.12345678901234567,
      observation: "linha\nseguinte",
      reference: { source: "manual" },
    },
  ]);
  assert.ok(text.includes(String(0.12345678901234567)));
  assert.ok(!text.includes("[object Object]"));
});
test("SHA-256 é estável e sensível ao conteúdo", async () => {
  const a = new TextEncoder().encode("abc").buffer,
    b = new TextEncoder().encode("abd").buffer;
  assert.equal(
    await sha256(a),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.notEqual(await sha256(a), await sha256(b));
});
