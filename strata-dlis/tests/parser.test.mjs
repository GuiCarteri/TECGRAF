import test from "node:test";
import assert from "node:assert/strict";
import { BinaryReader } from "../lib/vendor/dlis-parser/BinaryReader.js";
import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { defaultDepthChannel, boundedInterval } from "../lib/dlis/core.js";
import { makeFixture, cat, uv, ob } from "./fixtures/dlis.mjs";
test("RP66 primitives are bounded and use standard widths", () => {
  const reader = new BinaryReader(
    cat(ob("GR"), uv(200), Buffer.alloc(200, 65)),
  );
  assert.deepEqual(reader.obname(), { origin: 1, copy: 0, name: "GR" });
  assert.equal(reader.asciiStr(), "A".repeat(200));
  assert.equal(reader.rem, 0);
  assert.throws(() => reader.u8(), /truncado/);
  assert.throws(() => new BinaryReader(Buffer.from([128])).uvari(), /truncado/);
  const view = new Uint8Array([1, 2, 3, 4]).subarray(1, 2);
  const r = new BinaryReader(view);
  assert.equal(r.u8(), 2);
  assert.throws(() => r.u8());
  assert.equal(new BinaryReader(Buffer.from([0x40, 0x01])).fshort(), 1);
  assert.equal(new BinaryReader(Buffer.from([0xc0, 0x01])).fshort(), -1);
});
test("real encoded synthetic DLIS preserves dimensions, values, depth index and selected decode", () => {
  const f = DLISFile.fromBuffer(makeFixture({ rows: 10 }));
  assert.deepEqual(f.warnings, []);
  const frame = [...f.frames.values()][0],
    decoded = frame.decode();
  assert.equal(defaultDepthChannel(frame), "TDEP");
  assert.equal(decoded.frameCount, 10);
  assert.equal(decoded.strides.VDL, 128);
  assert.equal(decoded.strides.AIBK, 36);
  assert.equal(decoded.data.TDEP[9], Math.fround(1000.9));
  assert.equal(decoded.data.CBL[5], Math.fround(20 + 15 * Math.sin(5 / 90)));
  const selected = frame.decode({ channels: ["TDEP", "CBL"] });
  assert.deepEqual(Object.keys(selected.data), ["TDEP", "CBL"]);
  assert.deepEqual(selected.data.CBL, decoded.data.CBL);
  assert.throws(() => frame.decode({ channels: ["MISSING"] }));
});
test("opaque encrypted metadata does not hide readable channels; encrypted FDATA blocks fail closed", () => {
  const f = DLISFile.fromBuffer(makeFixture({ rows: 3, encrypted: true }));
  assert.equal(f.warnings.length, 1);
  assert.match(f.warnings[0], /criptografados/);
  assert.equal([...f.frames.values()][0].decode().frameCount, 3);
  const b = makeFixture({ rows: 3 });
  let p = 80,
    last;
  while (p < b.length) {
    last = p;
    p += b.readUInt16BE(p);
  }
  b[last + 6] |= 0x10;
  assert.throws(() => DLISFile.fromBuffer(b), /criptografados/);
});
test("truncated data is not returned as a partial successful frame", () => {
  const b = makeFixture({ rows: 5 });
  assert.throws(
    () => DLISFile.fromBuffer(b.subarray(0, b.length - 3)),
    /truncado/,
  );
});
test("zoom/pan stays finite, ordered and within the available interval", () => {
  assert.deepEqual(boundedInterval(90, 110, [100, 200]), [100, 120]);
  assert.deepEqual(boundedInterval(190, 210, [100, 200]), [180, 200]);
  assert.deepEqual(boundedInterval(-100, 999, [100, 200]), [100, 200]);
  assert.equal(boundedInterval(101, 100, [100, 200]), null);
  assert.equal(boundedInterval(NaN, 100, [100, 200]), null);
});
