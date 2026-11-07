import test from "node:test";
import assert from "node:assert/strict";
import { validateRegions, bounds, box } from "../lib/dlis/regions.ts";
import { usit } from "../lib/dlis/core.js";
const r = {
  id: "one",
  fileHash: "a".repeat(64),
  track: '[0,"frame","channel"]',
  depthName: "DEPTH",
  stride: 8,
  from: 100,
  to: 110,
  first: 1,
  last: 3,
  label: "Revisar",
  note: "",
};
test("palette preserves physical thresholds and special values", () => {
  for (const [v, c] of [
    [0, "#FF0000"],
    [0.2999, "#FF0000"],
    [0.3, "#00FFFF"],
    [2.599, "#00FFFF"],
    [2.6, "rgb(255, 255, 204)"],
    [10, "#000000"],
    [-2000, "#008000"],
    [-1, "#808080"],
    [NaN, "#808080"],
  ])
    assert.equal(usit(v).color, c);
});
test("reverse drag maps depth and inclusive components", () => {
  assert.deepEqual(bounds(100, 110, 8, [0.9, 0.8], [0.2, 0.1], false), {
    from: 101,
    to: 108,
    first: 1,
    last: 7,
  });
  assert.deepEqual(bounds(100, 110, 8, [0, 0], [1, 1], true), {
    from: 100,
    to: 110,
    first: 0,
    last: 7,
  });
});
test("zoom clips overlays without altering original region", () => {
  assert.deepEqual(box(r, 105, 115), {
    left: 12.5,
    top: 0,
    width: 37.5,
    height: 50,
  });
  assert.equal(r.from, 100);
  assert.equal(box(r, 120, 130), null);
});
test("region import rejects mismatched file, duplicate ID and malformed geometry", () => {
  assert.deepEqual(validateRegions([r], r.fileHash), [r]);
  for (const bad of [
    null,
    [null],
    [r, r],
    [{ ...r, fileHash: "other" }],
    [{ ...r, to: 99 }],
    [{ ...r, from: NaN }],
    [{ ...r, last: 8 }],
    [{ ...r, label: "unknown" }],
  ])
    assert.throws(() => validateRegions(bad, r.fileHash));
});
