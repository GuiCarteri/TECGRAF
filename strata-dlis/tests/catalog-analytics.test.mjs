import assert from "node:assert/strict";
import test from "node:test";
import { catalogAnalytics } from "../lib/catalog-analytics.ts";
import { readCatalogFiles } from "../lib/catalog.ts";

test("filtered catalog counts each file once per profile and ranks only matching files", () => {
  const files = readCatalogFiles({
    files: [
      {
        id: "x",
        collection: "A",
        size: 10,
        location: "offshore",
        types: ["CBL", " cbl ", "VDL"],
        original_name: "Z",
      },
      {
        id: "y",
        collection: "A",
        size: 42,
        location: "future",
        types: [" "],
        original_name: "Y",
      },
      { id: "z", collection: "B", size: 100, types: ["USIT"] },
    ],
  });
  const s = catalogAnalytics(
    files.filter((f) => f.collection === "A"),
    "pt-BR",
  );
  assert.deepEqual(s.profiles, [
    ["CBL", 1],
    ["VDL", 1],
  ]);
  assert.equal(s.unclassified, 1);
  assert.equal(s.bytes, 52);
  assert.deepEqual(s.environments, { onshore: 0, offshore: 1, unknown: 1 });
  assert.deepEqual(s.collections, [["A", 2]]);
  assert.deepEqual(
    s.largest.map((f) => f.id),
    ["y", "x"],
  );
  assert.equal(catalogAnalytics([], "en").count, 0);
});
